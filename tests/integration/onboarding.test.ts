'use strict';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { GET as onboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { GET as corgiSightingsHandler } from '@/app/api/corgi/sightings/route';
import { GET as walletStatusHandler } from '@/app/api/wallet/status/route';
import { GET as buddyStatusHandler } from '@/app/api/buddy/status/route';
import { POST as buddyRequestHandler } from '@/app/api/buddy/request/route';
import { POST as buddyAcceptHandler } from '@/app/api/buddy/accept/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { authenticateTestUser, generateTestTonAddress } from '../helpers/auth';
import { createAuthenticatedRequest } from '../helpers/request';
import type { OnboardingStatusResponse } from '@/types/onboarding';
import { buddyService, BuddyServiceError } from '@/services/BuddyService';

const BASE_URL = 'http://localhost:3000';

interface TestAccount {
  id: number;
  firstName: string;
  username?: string;
}

async function connectWallet(token: string, userId: number) {
  const walletAddress = generateTestTonAddress(userId);

  const request = createAuthenticatedRequest(token, {
    method: 'POST',
    url: `${BASE_URL}/api/wallet/connect`,
    body: {
      walletAddress,
    },
  });

  const response = await walletConnectHandler(request);
  expect(response.status).toBe(200);

  const data = (await response.json()) as {
    success: boolean;
    address: string;
  };

  expect(data.success).toBe(true);
  return data.address;
}

async function completeOnboarding(seeker: TestAccount, buddy: TestAccount) {
  const seekerToken = await authenticateTestUser(seeker);
  await connectWallet(seekerToken, seeker.id);

  const buddyToken = await authenticateTestUser(buddy);
  await connectWallet(buddyToken, buddy.id);

  const requestBuddy = createAuthenticatedRequest(seekerToken, {
    method: 'POST',
    url: `${BASE_URL}/api/buddy/request`,
    body: { targetUserId: buddy.id },
  });

  const requestResponse = await buddyRequestHandler(requestBuddy);
  expect(requestResponse.status).toBe(201);
  const { id: buddyPairId } = (await requestResponse.json()) as { id: number };

  const acceptRequest = createAuthenticatedRequest(buddyToken, {
    method: 'POST',
    url: `${BASE_URL}/api/buddy/accept`,
    body: { buddyPairId },
  });

  const acceptResponse = await buddyAcceptHandler(acceptRequest);
  expect(acceptResponse.status).toBe(200);

  return {
    seekerToken,
    buddyToken,
    buddyPairId,
  };
}

async function fetchOnboardingStatus(token: string) {
  const statusRequest = createAuthenticatedRequest(token, {
    method: 'GET',
    url: `${BASE_URL}/api/onboarding/status`,
  });

  const response = await onboardingStatusHandler(statusRequest);
  const data = (await response.json()) as OnboardingStatusResponse;

  return { response, data };
}

describe('US3: Main app navigation onboarding state', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows fully onboarded users to access main app data', async () => {
    const seeker = {
      id: 3030001,
      firstName: 'MainSeeker',
      username: 'main_seeker',
    };
    const buddy = {
      id: 3030002,
      firstName: 'MainBuddy',
      username: 'main_buddy',
    };

    const { seekerToken } = await completeOnboarding(seeker, buddy);

    const { response, data } = await fetchOnboardingStatus(seekerToken);
    expect(response.status).toBe(200);
    expect(data.onboarding.current_step).toBe('complete');
    expect(data.onboarding.wallet_connected).toBe(true);
    expect(data.onboarding.buddy_confirmed).toBe(true);
    expect(data.wallet?.address).toBeTruthy();
    expect(data.buddy?.status).toBe('confirmed');

    const corgiRequest = createAuthenticatedRequest(seekerToken, {
      method: 'GET',
      url: `${BASE_URL}/api/corgi/sightings`,
    });

    const corgiResponse = await corgiSightingsHandler(corgiRequest);
    expect(corgiResponse.status).toBe(200);

    const corgiData = (await corgiResponse.json()) as { sightings: unknown[] };
    expect(Array.isArray(corgiData.sightings)).toBe(true);
  });

  it('provides wallet and buddy summaries for settings navigation', async () => {
    const seeker = {
      id: 3030011,
      firstName: 'SettingsSeeker',
      username: 'settings_seek',
    };
    const buddy = {
      id: 3030012,
      firstName: 'SettingsBuddy',
      username: 'settings_buddy',
    };

    const { seekerToken } = await completeOnboarding(seeker, buddy);

    const walletStatusRequest = createAuthenticatedRequest(seekerToken, {
      method: 'GET',
      url: `${BASE_URL}/api/wallet/status`,
    });

    const walletResponse = await walletStatusHandler(walletStatusRequest);
    expect(walletResponse.status).toBe(200);
    const walletData = (await walletResponse.json()) as {
      success: boolean;
      connected: boolean;
      address: string | null;
    };

    expect(walletData.success).toBe(true);
    expect(walletData.connected).toBe(true);
    expect(typeof walletData.address).toBe('string');

    const buddyStatusRequest = createAuthenticatedRequest(seekerToken, {
      method: 'GET',
      url: `${BASE_URL}/api/buddy/status`,
    });

    const buddyStatusResponse = await buddyStatusHandler(buddyStatusRequest);
    expect(buddyStatusResponse.status).toBe(200);
    const buddyStatus = (await buddyStatusResponse.json()) as {
      status: string;
      id: number;
      confirmedAt: string | null;
    };

    expect(buddyStatus.status).toBe('active');
    expect(typeof buddyStatus.id).toBe('number');
    expect(buddyStatus.confirmedAt).toBeTruthy();
  });

  it('surfaces retryable errors when onboarding re-validation fails due to service issues', async () => {
    const seeker = {
      id: 3030021,
      firstName: 'RetrySeeker',
      username: 'retry_seek',
    };
    const buddy = {
      id: 3030022,
      firstName: 'RetryBuddy',
      username: 'retry_buddy',
    };

    const { seekerToken } = await completeOnboarding(seeker, buddy);

    const serviceError = new BuddyServiceError(
      'Database unavailable',
      'DATABASE_ERROR',
      503
    );

    const spy = jest
      .spyOn(buddyService, 'getBuddyStatus')
      .mockRejectedValueOnce(serviceError);

    const request = createAuthenticatedRequest(seekerToken, {
      method: 'GET',
      url: `${BASE_URL}/api/onboarding/status`,
    });

    const response = await onboardingStatusHandler(request);
    const body = (await response.json()) as { success: boolean; code: string };

    expect(spy).toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.code).toBe('DATABASE_ERROR');
  });
});
