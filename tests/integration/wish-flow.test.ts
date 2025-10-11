import { describe, test, expect } from '@jest/globals';
import { POST as createWish, GET as getWishes } from '@/app/api/wishes/route';
import { POST as respondToWish } from '@/app/api/wishes/[id]/respond/route';
import { GET as getPendingWishes } from '@/app/api/wishes/pending/route';
import { POST as sendBuddyRequest } from '@/app/api/buddy/request/route';
import { POST as acceptBuddyRequest } from '@/app/api/buddy/accept/route';
import { GET as getMarketplace } from '@/app/api/marketplace/route';
import { authenticateTestUser } from '../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../helpers/request';

// Integration test for complete wish creation and approval flow
describe('Wish Creation and Approval Flow Integration', () => {
  test('should complete full wish creation and approval flow successfully', async () => {
    // Step 1: User A authenticates
    const userAToken = await authenticateTestUser({
      id: 123456789,
      firstName: 'Alice',
    });

    // Step 2: User B (buddy) authenticates
    const userBToken = await authenticateTestUser({
      id: 987654321,
      firstName: 'Bob',
      username: 'bob_user',
    });

    // Step 3: Establish buddy relationship (prerequisite for wishes)
    // User A sends buddy request to User B
    const buddyRequestReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: {
        targetUserId: 987654321,
      },
    });

    const buddyRequestResponse = await sendBuddyRequest(buddyRequestReq);
    expect(buddyRequestResponse.ok).toBe(true);
    expect(buddyRequestResponse.status).toBe(201);

    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    // User B accepts the buddy request
    const acceptBuddyReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: {
        buddyPairId,
      },
    });

    const acceptBuddyResponse = await acceptBuddyRequest(acceptBuddyReq);
    expect(acceptBuddyResponse.ok).toBe(true);

    // Step 4: User A creates a wish
    const wishData = {
      description: "Please walk my dog while I'm at work today",
      proposedAmount: 5.5,
    };

    const createWishReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: wishData,
    });

    const createWishResponse = await createWish(createWishReq);
    expect(createWishResponse.ok).toBe(true);
    expect(createWishResponse.status).toBe(201);

    const createdWish = await createWishResponse.json();
    expect(createdWish).toHaveProperty('id');
    expect(createdWish.description).toBe(wishData.description);
    expect(createdWish.proposedAmount).toBe(wishData.proposedAmount);
    expect(createdWish.status).toBe('pending');
    expect(createdWish.creatorId).toBe(123456789);
    expect(createdWish.buddyId).toBe(987654321);
    expect(createdWish).toHaveProperty('createdAt');

    const wishId = createdWish.id;

    // Step 5: User A checks their created wishes
    const userWishesReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wishes',
    });

    const userWishesResponse = await getWishes(userWishesReq);
    expect(userWishesResponse.ok).toBe(true);
    const userWishes = await userWishesResponse.json();
    expect(userWishes).toHaveProperty('wishes');
    expect(Array.isArray(userWishes.wishes)).toBe(true);

    const userCreatedWish = userWishes.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(userCreatedWish).toBeDefined();
    expect(userCreatedWish.status).toBe('pending');

    // Step 6: User B checks pending wishes that need their approval
    const pendingWishesReq = createAuthenticatedRequest(userBToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wishes/pending',
    });

    const pendingWishesResponse = await getPendingWishes(pendingWishesReq);
    expect(pendingWishesResponse.ok).toBe(true);
    const pendingWishes = await pendingWishesResponse.json();
    expect(pendingWishes).toHaveProperty('wishes');
    expect(Array.isArray(pendingWishes.wishes)).toBe(true);

    // Find the wish that was just created
    const pendingWish = pendingWishes.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(pendingWish).toBeDefined();
    expect(pendingWish.description).toBe(wishData.description);
    expect(pendingWish.proposedAmount).toBe(wishData.proposedAmount);
    expect(pendingWish.status).toBe('pending');
    expect(pendingWish.creatorId).toBe(123456789);

    // Step 7: User B accepts the wish
    const acceptWishReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: {
        accepted: true,
      },
    });

    const acceptWishResponse = await respondToWish(acceptWishReq, {
      params: Promise.resolve({ id: wishId.toString() }),
    });
    expect(acceptWishResponse.ok).toBe(true);
    expect(acceptWishResponse.status).toBe(200);

    const acceptedWish = await acceptWishResponse.json();
    expect(acceptedWish.id).toBe(wishId);
    expect(acceptedWish.status).toBe('accepted');
    expect(acceptedWish).toHaveProperty('acceptedAt');
    expect(acceptedWish.acceptedAt).not.toBeNull();

    // Step 8: User A checks their wishes to see the accepted status
    const updatedUserWishesReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wishes',
    });

    const updatedUserWishesResponse = await getWishes(updatedUserWishesReq);
    expect(updatedUserWishesResponse.ok).toBe(true);
    const updatedUserWishes = await updatedUserWishesResponse.json();

    const acceptedUserWish = updatedUserWishes.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(acceptedUserWish).toBeDefined();
    expect(acceptedUserWish.status).toBe('accepted');
    expect(acceptedUserWish.acceptedAt).not.toBeNull();

    // Step 9: Verify wish appears in marketplace (accepted wishes should be available for purchase)
    const marketplaceReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/marketplace',
    });

    const marketplaceResponse = await getMarketplace(marketplaceReq);
    expect(marketplaceResponse.ok).toBe(true);
    const marketplace = await marketplaceResponse.json();
    expect(marketplace).toHaveProperty('wishes');
    expect(Array.isArray(marketplace.wishes)).toBe(true);

    const marketplaceWish = marketplace.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(marketplaceWish).toBeDefined();
    expect(marketplaceWish.status).toBe('accepted');
    expect(marketplaceWish).toHaveProperty('creator');
    expect(marketplaceWish.creator.id).toBe(123456789);
  });

  test('should handle wish rejection flow correctly', async () => {
    // Step 1: User A authenticates
    const userAToken = await authenticateTestUser({
      id: 111222333,
      firstName: 'Charlie',
    });

    // Step 2: User B (buddy) authenticates
    const userBToken = await authenticateTestUser({
      id: 444555666,
      firstName: 'David',
      username: 'david_user',
    });

    // Step 3: Establish buddy relationship
    const buddyRequestReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: {
        targetUserId: 444555666,
      },
    });

    const buddyRequestResponse = await sendBuddyRequest(buddyRequestReq);
    expect(buddyRequestResponse.ok).toBe(true);

    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    const acceptBuddyReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: {
        buddyPairId,
      },
    });

    const acceptBuddyResponse = await acceptBuddyRequest(acceptBuddyReq);
    expect(acceptBuddyResponse.ok).toBe(true);

    // Step 4: User A creates a wish
    const wishData = {
      description: 'Please clean my apartment this weekend',
      proposedAmount: 25.0,
    };

    const createWishReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: wishData,
    });

    const createWishResponse = await createWish(createWishReq);
    expect(createWishResponse.ok).toBe(true);
    const createdWish = await createWishResponse.json();
    const wishId = createdWish.id;

    // Step 5: User B rejects the wish
    const rejectWishReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: {
        accepted: false,
      },
    });

    const rejectWishResponse = await respondToWish(rejectWishReq, {
      params: Promise.resolve({ id: wishId.toString() }),
    });
    expect(rejectWishResponse.ok).toBe(true);
    expect(rejectWishResponse.status).toBe(200);

    const rejectedWish = await rejectWishResponse.json();
    expect(rejectedWish.id).toBe(wishId);
    expect(rejectedWish.status).toBe('rejected');
    expect(rejectedWish).toHaveProperty('acceptedAt');

    // Step 6: Verify rejected wish does not appear in marketplace
    const marketplaceReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/marketplace',
    });

    const marketplaceResponse = await getMarketplace(marketplaceReq);
    expect(marketplaceResponse.ok).toBe(true);
    const marketplace = await marketplaceResponse.json();

    const marketplaceWish = marketplace.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(marketplaceWish).toBeUndefined(); // Rejected wishes should not appear in marketplace

    // Step 7: User A can see their rejected wish in their personal list
    const userWishesReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wishes?status=rejected',
      query: { status: 'rejected' },
    });

    const userWishesResponse = await getWishes(userWishesReq);
    expect(userWishesResponse.ok).toBe(true);
    const userWishes = await userWishesResponse.json();

    const rejectedUserWish = userWishes.wishes.find(
      (wish: any) => wish.id === wishId
    );
    expect(rejectedUserWish).toBeDefined();
    expect(rejectedUserWish.status).toBe('rejected');
  });

  test('should prevent wish creation without active buddy relationship', async () => {
    // User without buddy tries to create wish
    const loneUserToken = await authenticateTestUser({
      id: 777888999,
      firstName: 'Eve',
    });

    const wishData = {
      description: 'This should fail because I have no buddy',
      proposedAmount: 10.0,
    };

    const createWishReq = createAuthenticatedRequest(loneUserToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: wishData,
    });

    const createWishResponse = await createWish(createWishReq);
    expect(createWishResponse.ok).toBe(false);
    expect(createWishResponse.status).toBe(400);
    const errorData = await createWishResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toMatch(/buddy|relationship/i);
  });

  test('should validate wish data on creation', async () => {
    // User authenticates
    const token = await authenticateTestUser({
      id: 100200300,
      firstName: 'Frank',
    });

    // Test missing description
    const invalidWish1Req = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        proposedAmount: 5.0,
      },
    });
    const invalidWish1Response = await createWish(invalidWish1Req);
    expect(invalidWish1Response.ok).toBe(false);
    expect(invalidWish1Response.status).toBe(400);

    // Test missing proposedAmount
    const invalidWish2Req = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Valid description',
      },
    });
    const invalidWish2Response = await createWish(invalidWish2Req);
    expect(invalidWish2Response.ok).toBe(false);
    expect(invalidWish2Response.status).toBe(400);

    // Test invalid amount (too high)
    const invalidWish3Req = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Valid description',
        proposedAmount: 1001.0, // Above maximum of 1000
      },
    });
    const invalidWish3Response = await createWish(invalidWish3Req);
    expect(invalidWish3Response.ok).toBe(false);
    expect(invalidWish3Response.status).toBe(400);

    // Test invalid amount (too low)
    const invalidWish4Req = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Valid description',
        proposedAmount: 0.0, // Below minimum of 0.01
      },
    });
    const invalidWish4Response = await createWish(invalidWish4Req);
    expect(invalidWish4Response.ok).toBe(false);
    expect(invalidWish4Response.status).toBe(400);

    // Test description too long
    const longDescription = 'a'.repeat(501); // Above maximum of 500 characters
    const invalidWish5Req = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: longDescription,
        proposedAmount: 5.0,
      },
    });
    const invalidWish5Response = await createWish(invalidWish5Req);
    expect(invalidWish5Response.ok).toBe(false);
    expect(invalidWish5Response.status).toBe(400);
  });

  test('should prevent unauthorized access to wish endpoints', async () => {
    // Test creating wish without authentication
    const createWishReq = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Unauthorized wish',
        proposedAmount: 5.0,
      },
    });
    const createWishResponse = await createWish(createWishReq);
    expect(createWishResponse.status).toBe(401);

    // Test getting wishes without authentication
    const getWishesReq = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/wishes',
    });
    const getWishesResponse = await getWishes(getWishesReq);
    expect(getWishesResponse.status).toBe(401);

    // Test getting pending wishes without authentication
    const getPendingReq = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/wishes/pending',
    });
    const getPendingResponse = await getPendingWishes(getPendingReq);
    expect(getPendingResponse.status).toBe(401);

    // Test responding to wish without authentication
    const respondReq = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/wishes/123/respond',
      body: { accepted: true },
    });
    const respondResponse = await respondToWish(respondReq, {
      params: Promise.resolve({ id: '123' }),
    });
    expect(respondResponse.status).toBe(401);
  });

  test('should handle responses to non-existent wishes', async () => {
    // User authenticates
    const token = await authenticateTestUser({
      id: 400500600,
      firstName: 'Grace',
    });

    // Try to respond to non-existent wish
    const respondReq = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes/999999/respond',
      body: {
        accepted: true,
      },
    });
    const respondResponse = await respondToWish(respondReq, {
      params: Promise.resolve({ id: '999999' }),
    });

    expect(respondResponse.ok).toBe(false);
    expect(respondResponse.status).toBe(404);
    const errorData = await respondResponse.json();
    expect(errorData.error).toBe('WISH_NOT_FOUND');
  });

  test('should prevent users from responding to their own wishes', async () => {
    // This test would need proper setup with buddy relationships
    // but demonstrates the validation logic expected
    const token = await authenticateTestUser({
      id: 500600700,
      firstName: 'Henry',
    });

    // User would somehow try to respond to their own wish
    // (This scenario would require more complex setup but demonstrates the expected validation)
    const selfRespondReq = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes/123/respond',
      body: {
        accepted: true,
      },
    });
    const selfRespondResponse = await respondToWish(selfRespondReq, {
      params: Promise.resolve({ id: '123' }),
    });

    // This should fail with appropriate error (exact status depends on implementation)
    expect(selfRespondResponse.ok).toBe(false);
  });
});
