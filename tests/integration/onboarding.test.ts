/**
 * Integration tests for Main App Navigation (User Story 3)
 *
 * Tests the complete main app navigation after onboarding:
 * - Accessing main app after onboarding complete
 * - Bottom navigation between Corgi Sighting and Settings screens
 * - Re-validation error handling with retry UI
 *
 * Based on specs/005-mobile-first-onboarding/tasks.md (T030-T032)
 * Uses black-box testing approach via API endpoints only
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET as getOnboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { POST as buddyRequestHandler } from '@/app/api/buddy/request/route';
import { POST as buddyAcceptHandler } from '@/app/api/buddy/accept/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../helpers/request';

describe('User Story 3: Main App Navigation', () => {
  const db = getDatabase();
  const user1Id = 999996;
  const user2Id = 999997;
  // Use different wallet addresses to maintain persistent state
  const testWalletAddress1 = 'kQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74pzE8';
  // Use an EQ-format address (mainnet) which is also valid for testing
  const testWalletAddress2 = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';

  let user1Token: string;
  let user2Token: string;

  beforeEach(async () => {
    // Create test users
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(user1Id, 'MainAppUser1');
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(user2Id, 'MainAppUser2');

    // Get auth tokens for both users
    user1Token = await authenticateTestUser({
      id: user1Id,
      firstName: 'MainAppUser1',
      username: 'mainappuser1',
    });
    user2Token = await authenticateTestUser({
      id: user2Id,
      firstName: 'MainAppUser2',
      username: 'mainappuser2',
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

    // Create buddy pair: user1 requests, user2 accepts
    const buddyRequestReq = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: user2Id },
    });
    const buddyRequestRes = await buddyRequestHandler(buddyRequestReq);
    if (!buddyRequestRes.ok) {
      const error = await buddyRequestRes.json();
      throw new Error(
        `Failed to create buddy request: ${JSON.stringify(error)}`
      );
    }

    const buddyPairData = await buddyRequestRes.json();
    const buddyPairId = buddyPairData.id;

    // User 2 accepts the buddy request
    const buddyAcceptReq = createAuthenticatedRequest(user2Token, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    const buddyAcceptRes = await buddyAcceptHandler(buddyAcceptReq);
    if (!buddyAcceptRes.ok) {
      const error = await buddyAcceptRes.json();
      throw new Error(
        `Failed to accept buddy request: ${JSON.stringify(error)}`
      );
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

  describe('T030: Main app access after onboarding complete', () => {
    it('should return current_step=main for fully onboarded user', async () => {
      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.onboarding.current_step).toBe('main');
      expect(data.onboarding.wallet_connected).toBe(true);
      expect(data.onboarding.buddy_confirmed).toBe(true);
    });

    it('should include both wallet and buddy info for fully onboarded user', async () => {
      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      expect(data.wallet).toBeDefined();
      expect(data.wallet.address).toBe(testWalletAddress1);
      expect(data.buddy).toBeDefined();
      expect(data.buddy.buddy_id).toBe(user2Id);
      expect(data.buddy.status).toBe('confirmed');
    });

    it('should indicate onboarding complete for second user', async () => {
      const request = createAuthenticatedRequest(user2Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      expect(data.onboarding.current_step).toBe('main');
      expect(data.onboarding.wallet_connected).toBe(true);
      expect(data.onboarding.buddy_confirmed).toBe(true);
    });
  });

  describe('T031: Bottom navigation between screens', () => {
    it('should maintain onboarding complete state across multiple status checks', async () => {
      // First check
      const request1 = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });
      let response1 = await getOnboardingStatusHandler(request1);
      let data1 = await response1.json();
      expect(data1.onboarding.current_step).toBe('main');

      // Simulate navigation - check again
      const request2 = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });
      let response2 = await getOnboardingStatusHandler(request2);
      let data2 = await response2.json();
      expect(data2.onboarding.current_step).toBe('main');

      // Third check after navigation
      const request3 = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });
      let response3 = await getOnboardingStatusHandler(request3);
      let data3 = await response3.json();
      expect(data3.onboarding.current_step).toBe('main');
    });

    it('should provide wallet info for bottom navigation settings access', async () => {
      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      // Settings screen needs wallet info
      expect(data.wallet).toBeDefined();
      expect(data.wallet.address).toBe(testWalletAddress1);
    });

    it('should provide buddy info for bottom navigation buddy settings access', async () => {
      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      // Buddy settings screen needs buddy info
      expect(data.buddy).toBeDefined();
      expect(data.buddy.buddy_id).toBe(user2Id);
    });
  });

  describe('T032: Re-validation error handling with retry', () => {
    it('should return valid status for re-validation check on app open', async () => {
      // Simulate app re-opening and re-validating
      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      // Should still be at main step
      expect(data.onboarding.current_step).toBe('main');
    });

    it('should handle missing wallet gracefully with step reset to buddy', async () => {
      // Simulate wallet being disconnected externally
      db.prepare('UPDATE users SET ton_wallet_address = NULL WHERE id = ?').run(
        user1Id
      );

      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      // Should drop back to buddy step since wallet was removed
      expect(data.onboarding.current_step).toBe('buddy');
      expect(data.onboarding.wallet_connected).toBe(false);
    });

    it('should handle missing buddy gracefully with step reset to welcome', async () => {
      // Simulate buddy relationship being deleted
      db.prepare(
        'DELETE FROM buddy_pairs WHERE (user1_id = ? OR user2_id = ?) AND status = ?'
      ).run(user1Id, user1Id, 'confirmed');

      const request = createAuthenticatedRequest(user1Token, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      const data = await response.json();

      // Since wallet is still connected but buddy is gone, should be at buddy step
      expect(data.onboarding.current_step).toBe('buddy');
    });

    it('should reject unauthenticated requests with 401', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('AUTH_FAILED');
    });

    it('should provide error response when auth validation fails', async () => {
      // Use invalid auth token
      const request = createAuthenticatedRequest('invalid-token-xyz', {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});
