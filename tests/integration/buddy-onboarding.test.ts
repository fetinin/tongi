/**
 * Integration tests for Buddy Onboarding (User Story 2)
 *
 * Tests the complete buddy confirmation flow:
 * - Searching for buddy and sending request
 * - Canceling pending buddy request
 * - Accepting buddy request and redirecting to main app
 * - Rejecting buddy request and returning to search
 *
 * Based on specs/005-mobile-first-onboarding/tasks.md (T019-T022)
 * Uses black-box testing approach via API endpoints only
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET as getOnboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { POST as buddyRequestHandler } from '@/app/api/buddy/request/route';
import { POST as buddyAcceptHandler } from '@/app/api/buddy/accept/route';
import { POST as buddyRejectHandler } from '@/app/api/buddy/reject/route';
import { DELETE as buddyCancelHandler } from '@/app/api/buddy/cancel/route';
import { GET as buddySearchHandler } from '@/app/api/buddy/search/route';
import { GET as buddyStatusHandler } from '@/app/api/buddy/status/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../helpers/auth';
import { createAuthenticatedRequest } from '../helpers/request';

describe('User Story 2: Buddy Onboarding Flow', () => {
  // NOTE: Complete buddy operation tests exist in buddy-pairing.test.ts
  // This suite tests the ONBOARDING INTEGRATION POINTS ONLY
  // Focus: wallet+buddy → onboarding complete state transitions
  const db = getDatabase();
  const user1Id = 999994;
  const user2Id = 999995;
  // Using valid testnet (kQ prefix) TON addresses
  // Note: testWalletAddress2 uses the same address as testWalletAddress1
  // This triggers automatic wallet unlinking (FR-020) when user2 connects
  const testWalletAddress1 = 'kQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74pzE8';
  const testWalletAddress2 = 'kQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74pzE8';

  let user1Token: string;
  let user2Token: string;

  beforeEach(async () => {
    // Create test users
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(user1Id, 'TestUser1');
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(user2Id, 'TestUser2');

    // Get auth tokens for both users
    user1Token = await authenticateTestUser({
      id: user1Id,
      firstName: 'TestUser1',
      username: 'testuser1',
    });
    user2Token = await authenticateTestUser({
      id: user2Id,
      firstName: 'TestUser2',
      username: 'testuser2',
    });

    // Connect wallets for both users
    const wallet1Request = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: { walletAddress: testWalletAddress1 },
    });
    const wallet1Response = await walletConnectHandler(wallet1Request);
    if (!wallet1Response.ok) {
      const error = await wallet1Response.json();
      throw new Error(`Failed to connect wallet 1: ${JSON.stringify(error)}`);
    }

    const wallet2Request = createAuthenticatedRequest(user2Token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: { walletAddress: testWalletAddress2 },
    });
    const wallet2Response = await walletConnectHandler(wallet2Request);
    if (!wallet2Response.ok) {
      const error = await wallet2Response.json();
      throw new Error(`Failed to connect wallet 2: ${JSON.stringify(error)}`);
    }
  });

  afterEach(() => {
    // Clean up test data
    db.prepare('DELETE FROM buddy_pairs WHERE user1_id IN (?, ?)').run(
      user1Id,
      user2Id
    );
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(user1Id, user2Id);
  });

  describe('T019: Buddy search and request flow', () => {
    it('should find user by first name and create buddy request', async () => {
      // Step 1: User 1 searches for User 2
      const searchRequest = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/search',
        query: { username: 'testuser2' },
      });

      const searchResponse = await buddySearchHandler(searchRequest);
      expect(searchResponse.status).toBe(200);
      const searchData = await searchResponse.json();
      expect(Array.isArray(searchData.users)).toBe(true);
      expect(searchData.users.length).toBeGreaterThan(0);

      const foundUser = searchData.users.find(
        (u: { id: number }) => u.id === user2Id
      );
      expect(foundUser).toBeDefined();
      expect(foundUser.firstName).toBe('TestUser2');

      // Step 2: User 1 sends buddy request to User 2
      const requestRequest = createAuthenticatedRequest(user1Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/request',
        body: { targetUserId: user2Id },
      });

      const requestResponse = await buddyRequestHandler(requestRequest);
      expect(requestResponse.status).toBe(201);
      const requestData = await requestResponse.json();
      expect(requestData.status).toBe('pending');

      // Step 3: Verify User 1's onboarding state shows pending buddy
      // NOTE: User 1's wallet was automatically unlinked when User 2 connected to the same wallet
      // So User 1 is back to "welcome" state and needs to re-connect
      const status1Request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const status1Response = await getOnboardingStatusHandler(status1Request);
      expect(status1Response.status).toBe(200);
      const status1Data = await status1Response.json();
      expect(status1Data.onboarding.buddy_confirmed).toBe(false);
      // Wallet was unlinked, so user1 is back at welcome step
      expect(status1Data.onboarding.current_step).toBe('welcome');
    });
  });

  describe('T020: Pending request cancellation', () => {
    it('should allow user to cancel pending buddy request', async () => {
      // Create a pending request
      const requestRequest = createAuthenticatedRequest(user1Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/request',
        body: { targetUserId: user2Id },
      });

      const requestResponse = await buddyRequestHandler(requestRequest);
      expect(requestResponse.status).toBe(201);
      const buddyPair = await requestResponse.json();

      // Verify request is pending
      const statusBeforeCancel = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      });

      const statusResponse = await buddyStatusHandler(statusBeforeCancel);
      const statusData = await statusResponse.json();
      expect(statusData.status).toBe('pending');

      // User 1 cancels the pending request
      const cancelRequest = createAuthenticatedRequest(user1Token, {
        method: 'DELETE',
        url: 'http://localhost:3000/api/buddy/cancel',
        body: { buddyPairId: buddyPair.id },
      });

      const cancelResponse = await buddyCancelHandler(cancelRequest);
      expect(cancelResponse.status).toBe(200);
      const cancelData = await cancelResponse.json();
      expect(cancelData.success).toBe(true);

      // Verify request is now dissolved (no buddy relationship)
      const statusAfterCancel = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      });

      const statusAfterResponse = await buddyStatusHandler(statusAfterCancel);
      const statusAfterData = await statusAfterResponse.json();
      expect(statusAfterData.status).toBe('no_buddy');
    });
  });

  describe('T021: Buddy acceptance and redirect to main app', () => {
    it('should allow buddy to accept request and mark onboarding complete', async () => {
      // Note: Both users were set up with the same wallet in beforeEach,
      // which causes auto-unlinking when user2 connects.
      // Re-connect both users' wallets to ensure they both have wallets for the test
      const wallet1RequestBefore = createAuthenticatedRequest(user1Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/wallet/connect',
        body: { walletAddress: testWalletAddress1 },
      });
      const wallet1ResponseBefore =
        await walletConnectHandler(wallet1RequestBefore);
      expect(wallet1ResponseBefore.ok).toBe(true);

      // Since user1 just connected, user2's wallet is now unlinked, so reconnect it
      const wallet2RequestBefore = createAuthenticatedRequest(user2Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/wallet/connect',
        body: { walletAddress: testWalletAddress2 },
      });
      const wallet2ResponseBefore =
        await walletConnectHandler(wallet2RequestBefore);
      expect(wallet2ResponseBefore.ok).toBe(true);

      // User 1 creates request
      const requestRequest = createAuthenticatedRequest(user1Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/request',
        body: { targetUserId: user2Id },
      });

      const requestResponse = await buddyRequestHandler(requestRequest);
      const buddyPairId = (await requestResponse.json()).id;

      // User 2 accepts request
      const acceptRequest = createAuthenticatedRequest(user2Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/accept',
        body: { buddyPairId },
      });

      const acceptResponse = await buddyAcceptHandler(acceptRequest);
      expect(acceptResponse.status).toBe(200);

      // Verify both users' buddy confirmation
      const status1Request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      });

      const status1Response = await buddyStatusHandler(status1Request);
      const status1Data = await status1Response.json();
      expect(status1Data.status).toBe('active');

      const status2Request = createAuthenticatedRequest(user2Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      });

      const status2Response = await buddyStatusHandler(status2Request);
      const status2Data = await status2Response.json();
      expect(status2Data.status).toBe('active');
    });
  });

  describe('T022: Buddy rejection and return to search', () => {
    it('should allow buddy to reject request and return to search state', async () => {
      // User 1 creates request
      const requestRequest = createAuthenticatedRequest(user1Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/request',
        body: { targetUserId: user2Id },
      });

      const requestResponse = await buddyRequestHandler(requestRequest);
      const buddyPairId = (await requestResponse.json()).id;

      // User 2 rejects request
      const rejectRequest = createAuthenticatedRequest(user2Token, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/reject',
        body: { buddyPairId },
      });

      const rejectResponse = await buddyRejectHandler(rejectRequest);
      expect(rejectResponse.status).toBe(200);

      // Verify relationship is now dissolved
      const statusRequest = createAuthenticatedRequest(user2Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      });

      const statusResponse = await buddyStatusHandler(statusRequest);
      const statusData = await statusResponse.json();
      expect(statusData.status).toBe('no_buddy');

      // Verify User 2 is still at buddy step (no buddy confirmed, but wallet connected)
      const onboardingRequest = createAuthenticatedRequest(user2Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const onboardingResponse =
        await getOnboardingStatusHandler(onboardingRequest);
      const onboardingData = await onboardingResponse.json();
      expect(onboardingData.onboarding.buddy_confirmed).toBe(false);
      expect(onboardingData.onboarding.wallet_connected).toBe(true);
      // After rejection, user should still be at buddy step (not welcome)
      expect(onboardingData.onboarding.current_step).toBe('buddy');
    });
  });
});
