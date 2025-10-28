/**
 * Integration tests for Wallet Connection Onboarding (User Story 1)
 *
 * Tests the complete wallet connection flow:
 * - Blocking access to main app until wallet is connected
 * - Redirecting to buddy screen after wallet connection
 *
 * Based on specs/005-mobile-first-onboarding/tasks.md (T011-T012)
 * Uses black-box testing approach via API endpoints only
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET as getOnboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../helpers/request';

describe('User Story 1: Wallet Connection Onboarding', () => {
  const db = getDatabase();
  const testUserId = 999991;
  const testWalletAddress = 'kQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74pzE8';
  let authToken: string;

  beforeEach(async () => {
    // Create test user and get auth token
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(testUserId, 'TestWalletUser');

    authToken = await authenticateTestUser({
      id: testUserId,
      firstName: 'TestWalletUser',
    });
  });

  afterEach(() => {
    // Clean up test user
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  describe('T011: Blocking access until wallet connected', () => {
    it('should return current_step=welcome for new user without wallet', async () => {
      const request = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.onboarding.current_step).toBe('welcome');
      expect(data.onboarding.wallet_connected).toBe(false);
      expect(data.onboarding.buddy_confirmed).toBe(false);
    });

    it('should not have wallet info when not connected', async () => {
      const request = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const response = await getOnboardingStatusHandler(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.wallet).toBeUndefined();
    });

    it('should reject unauthenticated requests to onboarding status', async () => {
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
  });

  describe('T012: Redirect to buddy screen after wallet connection', () => {
    it('should return current_step=buddy after connecting wallet', async () => {
      // Step 1: Connect wallet via API
      const connectRequest = createAuthenticatedRequest(authToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/wallet/connect',
        body: {
          walletAddress: testWalletAddress,
        },
      });

      const connectResponse = await walletConnectHandler(connectRequest);
      expect(connectResponse.status).toBe(200);
      const connectData = await connectResponse.json();
      expect(connectData.success).toBe(true);
      expect(connectData.user.ton_wallet_address).toBe(testWalletAddress);

      // Step 2: Check onboarding status - should indicate buddy step
      const statusRequest = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const statusResponse = await getOnboardingStatusHandler(statusRequest);
      expect(statusResponse.status).toBe(200);

      const statusData = await statusResponse.json();
      expect(statusData.success).toBe(true);
      expect(statusData.onboarding.current_step).toBe('buddy');
      expect(statusData.onboarding.wallet_connected).toBe(true);
      expect(statusData.onboarding.buddy_confirmed).toBe(false);
    });

    it('should include wallet info after connection', async () => {
      // Connect wallet
      const connectRequest = createAuthenticatedRequest(authToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/wallet/connect',
        body: {
          walletAddress: testWalletAddress,
        },
      });

      await walletConnectHandler(connectRequest);

      // Check onboarding status
      const statusRequest = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      const statusResponse = await getOnboardingStatusHandler(statusRequest);
      const statusData = await statusResponse.json();

      expect(statusData.wallet).toBeDefined();
      expect(statusData.wallet.address).toBe(testWalletAddress);
    });

    it('should maintain wallet connection state after connecting', async () => {
      const wallet1 = testWalletAddress;

      // Connect wallet
      const connectRequest = createAuthenticatedRequest(authToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/wallet/connect',
        body: {
          walletAddress: wallet1,
        },
      });

      const connectResponse = await walletConnectHandler(connectRequest);
      expect(connectResponse.status).toBe(200);

      // Verify status persists after connection
      const statusRequest1 = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      let statusResponse = await getOnboardingStatusHandler(statusRequest1);
      let statusData = await statusResponse.json();
      expect(statusData.onboarding.wallet_connected).toBe(true);
      expect(statusData.wallet.address).toBe(wallet1);

      // Check again to ensure persistence
      const statusRequest2 = createAuthenticatedRequest(authToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/onboarding/status',
      });

      statusResponse = await getOnboardingStatusHandler(statusRequest2);
      statusData = await statusResponse.json();
      expect(statusData.onboarding.wallet_connected).toBe(true);
      expect(statusData.wallet.address).toBe(wallet1);
    });
  });
});
