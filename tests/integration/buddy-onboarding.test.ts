import { describe, it, expect } from '@jest/globals';
import { GET as onboardingStatusHandler } from '@/app/api/onboarding/status/route';
import { GET as buddyStatusHandler } from '@/app/api/buddy/status/route';
import { GET as buddySearchHandler } from '@/app/api/buddy/search/route';
import { POST as buddyRequestHandler } from '@/app/api/buddy/request/route';
import { DELETE as buddyCancelHandler } from '@/app/api/buddy/cancel/route';
import { POST as buddyAcceptHandler } from '@/app/api/buddy/accept/route';
import { POST as buddyRejectHandler } from '@/app/api/buddy/reject/route';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { authenticateTestUser, generateTestTonAddress } from '../helpers/auth';
import { createAuthenticatedRequest } from '../helpers/request';
import type { OnboardingStatusResponse } from '@/types/onboarding';

const BASE_URL = 'http://localhost:3000';

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
  expect(data.address).toBeTruthy();

  return data.address;
}

async function getOnboardingStatus(
  token: string
): Promise<OnboardingStatusResponse> {
  const request = createAuthenticatedRequest(token, {
    method: 'GET',
    url: `${BASE_URL}/api/onboarding/status`,
  });

  const response = await onboardingStatusHandler(request);
  expect(response.status).toBe(200);

  const data = (await response.json()) as OnboardingStatusResponse;
  expect(data.success).toBe(true);

  return data;
}

async function getBuddyStatus(token: string) {
  const request = createAuthenticatedRequest(token, {
    method: 'GET',
    url: `${BASE_URL}/api/buddy/status`,
  });

  const response = await buddyStatusHandler(request);
  expect(response.status).toBe(200);

  return response.json() as Promise<
    | { status: 'no_buddy'; message: string }
    | {
        status: string;
        id: number;
        buddy: { id: number };
        initiatedBy: number;
      }
  >;
}

describe('US2: Buddy onboarding flow', () => {
  it('allows wallet-connected users to search for and request a buddy', async () => {
    const seeker = { id: 2024001, firstName: 'Seeker', username: 'buddy_seek' };
    const target = {
      id: 2024002,
      firstName: 'Target',
      username: 'buddy_target',
    };

    const seekerToken = await authenticateTestUser(seeker);
    await connectWallet(seekerToken, seeker.id);

    const targetToken = await authenticateTestUser(target);
    await connectWallet(targetToken, target.id);

    const searchRequest = createAuthenticatedRequest(seekerToken, {
      method: 'GET',
      url: `${BASE_URL}/api/buddy/search`,
      query: { username: target.username! },
    });

    const searchResponse = await buddySearchHandler(searchRequest);
    expect(searchResponse.status).toBe(200);

    const searchData = (await searchResponse.json()) as {
      users: Array<{ id: number }>;
    };

    expect(searchData.users).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: target.id })])
    );

    const request = createAuthenticatedRequest(seekerToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/request`,
      body: { targetUserId: target.id },
    });

    const requestResponse = await buddyRequestHandler(request);
    expect(requestResponse.status).toBe(201);

    const buddyRequest = (await requestResponse.json()) as {
      id: number;
      status: string;
      buddy: { id: number };
      initiatedBy: number;
    };

    expect(buddyRequest.status).toBe('pending');
    expect(buddyRequest.buddy.id).toBe(target.id);
    expect(buddyRequest.initiatedBy).toBe(seeker.id);

    const onboardingStatus = await getOnboardingStatus(seekerToken);
    expect(onboardingStatus.onboarding.wallet_connected).toBe(true);
    expect(onboardingStatus.onboarding.buddy_confirmed).toBe(false);
    expect(onboardingStatus.onboarding.current_step).toBe('buddy');
    expect(onboardingStatus.buddy?.status).toBe('pending');
    expect(onboardingStatus.buddy?.profile.id).toBe(target.id);

    const buddyStatus = await getBuddyStatus(seekerToken);
    expect(buddyStatus).toMatchObject({ status: 'pending' });
  });

  it('allows users to cancel a pending buddy request', async () => {
    const seeker = {
      id: 2024011,
      firstName: 'Cancel',
      username: 'cancel_requester',
    };
    const target = {
      id: 2024012,
      firstName: 'CancelTarget',
      username: 'cancel_target',
    };

    const seekerToken = await authenticateTestUser(seeker);
    await connectWallet(seekerToken, seeker.id);

    await authenticateTestUser(target);

    const request = createAuthenticatedRequest(seekerToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/request`,
      body: { targetUserId: target.id },
    });

    const requestResponse = await buddyRequestHandler(request);
    expect(requestResponse.status).toBe(201);

    const cancelRequest = createAuthenticatedRequest(seekerToken, {
      method: 'DELETE',
      url: `${BASE_URL}/api/buddy/cancel`,
    });

    const cancelResponse = await buddyCancelHandler(cancelRequest);
    expect(cancelResponse.status).toBe(200);

    const cancelData = (await cancelResponse.json()) as {
      success: boolean;
      message: string;
    };

    expect(cancelData.success).toBe(true);
    expect(cancelData.message).toMatch(/cancelled/i);

    const onboardingStatus = await getOnboardingStatus(seekerToken);
    expect(onboardingStatus.onboarding.current_step).toBe('buddy');
    expect(onboardingStatus.onboarding.buddy_confirmed).toBe(false);
    expect(onboardingStatus.buddy).toBeUndefined();

    const buddyStatus = await getBuddyStatus(seekerToken);
    expect(buddyStatus).toMatchObject({ status: 'no_buddy' });
  });

  it('advances onboarding when a buddy request is accepted', async () => {
    const seeker = {
      id: 2024021,
      firstName: 'AcceptSeeker',
      username: 'accept_seeker',
    };
    const buddy = {
      id: 2024022,
      firstName: 'AcceptBuddy',
      username: 'accept_buddy',
    };

    const seekerToken = await authenticateTestUser(seeker);
    await connectWallet(seekerToken, seeker.id);

    const buddyToken = await authenticateTestUser(buddy);
    await connectWallet(buddyToken, buddy.id);

    const request = createAuthenticatedRequest(seekerToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/request`,
      body: { targetUserId: buddy.id },
    });

    const requestResponse = await buddyRequestHandler(request);
    expect(requestResponse.status).toBe(201);

    const buddyRequest = (await requestResponse.json()) as { id: number };

    const acceptRequest = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/accept`,
      body: { buddyPairId: buddyRequest.id },
    });

    const acceptResponse = await buddyAcceptHandler(acceptRequest);
    expect(acceptResponse.status).toBe(200);

    const onboardingStatus = await getOnboardingStatus(seekerToken);
    expect(onboardingStatus.onboarding.current_step).toBe('complete');
    expect(onboardingStatus.onboarding.buddy_confirmed).toBe(true);
    expect(onboardingStatus.buddy?.status).toBe('confirmed');
    expect(onboardingStatus.buddy?.profile.id).toBe(buddy.id);

    const buddyOnboardingStatus = await getOnboardingStatus(buddyToken);
    expect(buddyOnboardingStatus.onboarding.current_step).toBe('complete');
    expect(buddyOnboardingStatus.onboarding.buddy_confirmed).toBe(true);
    expect(buddyOnboardingStatus.buddy?.status).toBe('confirmed');
    expect(buddyOnboardingStatus.buddy?.profile.id).toBe(seeker.id);
  });

  it('returns users to buddy search when a request is rejected', async () => {
    const seeker = {
      id: 2024031,
      firstName: 'RejectSeeker',
      username: 'reject_seeker',
    };
    const buddy = {
      id: 2024032,
      firstName: 'RejectBuddy',
      username: 'reject_buddy',
    };

    const seekerToken = await authenticateTestUser(seeker);
    await connectWallet(seekerToken, seeker.id);

    const buddyToken = await authenticateTestUser(buddy);
    await connectWallet(buddyToken, buddy.id);

    const request = createAuthenticatedRequest(seekerToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/request`,
      body: { targetUserId: buddy.id },
    });

    const requestResponse = await buddyRequestHandler(request);
    expect(requestResponse.status).toBe(201);

    const buddyRequest = (await requestResponse.json()) as { id: number };

    const rejectRequest = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `${BASE_URL}/api/buddy/reject`,
      body: { buddyPairId: buddyRequest.id },
    });

    const rejectResponse = await buddyRejectHandler(rejectRequest);
    expect(rejectResponse.status).toBe(200);

    const onboardingStatus = await getOnboardingStatus(seekerToken);
    expect(onboardingStatus.onboarding.current_step).toBe('buddy');
    expect(onboardingStatus.onboarding.buddy_confirmed).toBe(false);
    expect(onboardingStatus.buddy).toBeUndefined();

    const buddyStatus = await getBuddyStatus(seekerToken);
    expect(buddyStatus).toMatchObject({ status: 'no_buddy' });
  });
});
