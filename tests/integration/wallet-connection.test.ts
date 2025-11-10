import { describe, it, expect } from '@jest/globals';
import { GET as onboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { authenticateTestUser, generateTestTonAddress } from '../helpers/auth';
import { createAuthenticatedRequest } from '../helpers/request';
import type { OnboardingStatusResponse } from '@/types/onboarding';

const BASE_URL = 'http://localhost:3000';

describe('US1: Wallet connection onboarding flow', () => {
  it('blocks access to onboarding until wallet is connected', async () => {
    const token = await authenticateTestUser({
      id: 101001,
      firstName: 'Walletless',
    });

    const statusRequest = createAuthenticatedRequest(token, {
      method: 'GET',
      url: `${BASE_URL}/api/onboarding/status`,
    });

    const statusResponse = await onboardingStatusHandler(statusRequest);
    expect(statusResponse.status).toBe(200);

    const statusData =
      (await statusResponse.json()) as OnboardingStatusResponse;
    expect(statusData.success).toBe(true);
    expect(statusData.onboarding.wallet_connected).toBe(false);
    expect(statusData.onboarding.buddy_confirmed).toBe(false);
    expect(statusData.onboarding.current_step).toBe('welcome');
    expect(statusData.wallet).toBeUndefined();
    expect(statusData.buddy).toBeUndefined();
  });

  it('moves the user to buddy onboarding after wallet connection', async () => {
    const user = { id: 101002, firstName: 'WalletReady' };
    const token = await authenticateTestUser(user);

    const walletAddress = generateTestTonAddress(user.id);

    const connectRequest = createAuthenticatedRequest(token, {
      method: 'POST',
      url: `${BASE_URL}/api/wallet/connect`,
      body: {
        walletAddress,
      },
    });

    const connectResponse = await walletConnectHandler(connectRequest);
    expect(connectResponse.status).toBe(200);
    const connectData = (await connectResponse.json()) as {
      success: boolean;
      address: string;
      previousAccountUnlinked?: boolean;
    };

    expect(connectData.success).toBe(true);
    expect(connectData.address).toBeTruthy();

    const statusRequest = createAuthenticatedRequest(token, {
      method: 'GET',
      url: `${BASE_URL}/api/onboarding/status`,
    });

    const statusResponse = await onboardingStatusHandler(statusRequest);
    expect(statusResponse.status).toBe(200);

    const statusData =
      (await statusResponse.json()) as OnboardingStatusResponse;
    expect(statusData.success).toBe(true);
    expect(statusData.onboarding.wallet_connected).toBe(true);
    expect(statusData.onboarding.buddy_confirmed).toBe(false);
    expect(statusData.onboarding.current_step).toBe('buddy');
    expect(statusData.wallet?.address).toBe(connectData.address);
  });
});
