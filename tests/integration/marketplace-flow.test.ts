import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  authenticateTestUser,
  generateTestTonAddress,
} from '../helpers/auth';
import { createAuthenticatedRequest } from '../helpers/request';
import { clearDatabase } from '../helpers/database';

// Import route handlers
import { POST as buddyRequest } from '@/app/api/buddy/request/route';
import { POST as buddyAccept } from '@/app/api/buddy/accept/route';
import { GET as buddyStatus } from '@/app/api/buddy/status/route';
import { POST as wishCreate, GET as wishesGet } from '@/app/api/wishes/route';
import { POST as wishRespond } from '@/app/api/wishes/[id]/respond/route';
import { GET as marketplaceGet } from '@/app/api/marketplace/route';
import { POST as marketplacePurchase } from '@/app/api/marketplace/[id]/purchase/route';
import { GET as transactionsGet } from '@/app/api/transactions/route';
import { POST as transactionConfirm } from '@/app/api/transactions/[id]/confirm/route';

// T024: Integration test wish purchase flow
describe('Marketplace Purchase Flow Integration', () => {
  beforeEach(() => {
    clearDatabase();
  });

  test('should complete full wish purchase flow successfully', async () => {
    // Step 1: Authenticate all users
    const userAToken = await authenticateTestUser(
      { id: 123456789, firstName: 'Alice', username: 'alice_user' },
      generateTestTonAddress(123456789)
    );

    const userBToken = await authenticateTestUser({
      id: 987654321,
      firstName: 'Bob',
      username: 'bob_user',
    });

    const userCToken = await authenticateTestUser(
      { id: 555666777, firstName: 'Charlie', username: 'charlie_user' },
      generateTestTonAddress(555666777)
    );

    // Step 2: Establish buddy relationship between A and B
    const buddyRequestReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 987654321 },
    });
    const buddyRequestResponse = await buddyRequest(buddyRequestReq);
    expect(buddyRequestResponse.status).toBe(201);
    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    // Step 3: User B accepts the buddy request
    const acceptReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    const acceptResponse = await buddyAccept(acceptReq);
    expect(acceptResponse.status).toBe(200);

    // Step 4: User A creates a wish
    const wishCreateReq = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: "Please walk my corgi while I'm at work today",
        proposedAmount: 10.5,
      },
    });
    const wishCreateResponse = await wishCreate(wishCreateReq);
    expect(wishCreateResponse.status).toBe(201);
    const createdWish = await wishCreateResponse.json();
    expect(createdWish.status).toBe('pending');
    expect(createdWish.description).toBe(
      "Please walk my corgi while I'm at work today"
    );
    expect(createdWish.proposedAmount).toBe(10.5);
    const wishId = createdWish.id;

    // Step 5: User B (buddy) accepts the wish
    const acceptWishReq = createAuthenticatedRequest(userBToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: { accepted: true },
    });
    const acceptWishResponse = await wishRespond(acceptWishReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });
    expect(acceptWishResponse.ok).toBe(true);
    const acceptedWish = await acceptWishResponse.json();
    expect(acceptedWish.status).toBe('accepted');
    expect(acceptedWish.acceptedAt).toBeTruthy();

    // Step 6: Check marketplace shows the accepted wish
    const marketplaceReq = createAuthenticatedRequest(userCToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/marketplace',
    });
    const marketplaceResponse = await marketplaceGet(marketplaceReq);
    expect(marketplaceResponse.ok).toBe(true);
    const marketplaceData = await marketplaceResponse.json();
    expect(marketplaceData.wishes).toContainEqual(
      expect.objectContaining({
        id: wishId,
        status: 'accepted',
        description: "Please walk my corgi while I'm at work today",
      })
    );

    // Step 7: User C initiates purchase of the wish
    const purchaseReq = createAuthenticatedRequest(userCToken, {
      method: 'POST',
      url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
    });
    const purchaseResponse = await marketplacePurchase(purchaseReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });
    expect(purchaseResponse.ok).toBe(true);
    const purchaseData = await purchaseResponse.json();
    expect(purchaseData).toHaveProperty('transactionId');
    expect(purchaseData).toHaveProperty('tonTransaction');
    expect(typeof purchaseData.transactionId).toBe('number');

    const transactionId = purchaseData.transactionId;
    const tonTx = purchaseData.tonTransaction;

    // Validate TON transaction structure
    expect(tonTx).toHaveProperty('to');
    expect(tonTx).toHaveProperty('amount');
    expect(tonTx).toHaveProperty('payload');
    expect(typeof tonTx.to).toBe('string');
    expect(typeof tonTx.amount).toBe('string');
    expect(parseInt(tonTx.amount)).toBeGreaterThan(0);

    // Step 8: User C confirms the transaction (simulating blockchain confirmation)
    const confirmReq = createAuthenticatedRequest(userCToken, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        success: true,
      },
    });
    const confirmResponse = await transactionConfirm(confirmReq, {
      params: Promise.resolve({ id: String(transactionId) }),
    });
    expect(confirmResponse.ok).toBe(true);
    const confirmedTransaction = await confirmResponse.json();
    expect(confirmedTransaction.status).toBe('completed');
    expect(confirmedTransaction.transactionHash).toBe(
      'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz'
    );

    // Step 9: Verify wish status is updated to purchased
    const wishStatusReq = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wishes',
    });
    const wishStatusResponse = await wishesGet(wishStatusReq);
    expect(wishStatusResponse.ok).toBe(true);
    const wishesData = await wishStatusResponse.json();
    const purchasedWish = wishesData.wishes.find((w: any) => w.id === wishId);
    expect(purchasedWish.status).toBe('purchased');
    expect(purchasedWish.purchasedBy).toBe(555666777);
    expect(purchasedWish.purchasedAt).toBeTruthy();

    // Step 10: Verify wish is no longer in marketplace
    const postPurchaseMarketplaceReq = createAuthenticatedRequest(userCToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/marketplace',
    });
    const postPurchaseMarketplaceResponse = await marketplaceGet(
      postPurchaseMarketplaceReq
    );
    expect(postPurchaseMarketplaceResponse.ok).toBe(true);
    const postPurchaseMarketplace =
      await postPurchaseMarketplaceResponse.json();
    const wishStillInMarketplace = postPurchaseMarketplace.wishes.find(
      (w: any) => w.id === wishId
    );
    expect(wishStillInMarketplace).toBeUndefined();
  });

  test('should prevent purchasing wish without TON wallet', async () => {
    // User without TON wallet
    const userToken = await authenticateTestUser({
      id: 111222333,
      firstName: 'David',
    });

    // Create a mock wish (id 123) - in real scenario this would exist
    const purchaseReq = createAuthenticatedRequest(userToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/marketplace/123/purchase',
    });
    const purchaseResponse = await marketplacePurchase(purchaseReq, {
      params: Promise.resolve({ id: '123' }),
    });

    expect(purchaseResponse.ok).toBe(false);
    expect(purchaseResponse.status).toBe(400);
    const errorData = await purchaseResponse.json();
    expect(errorData.message).toMatch(/wallet/i);
  });

  test('should prevent purchasing own wish', async () => {
    // Creator authenticates
    const creatorToken = await authenticateTestUser(
      { id: 444555666, firstName: 'Eva' },
      generateTestTonAddress(444555666)
    );

    // Buddy authenticates
    const buddyToken = await authenticateTestUser({
      id: 777888999,
      firstName: 'Frank',
    });

    // Establish buddy relationship
    const buddyRequestReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 777888999 },
    });
    const buddyRequestResponse = await buddyRequest(buddyRequestReq);
    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    const acceptReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    await buddyAccept(acceptReq);

    // Create and accept wish
    const wishReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Test wish for self-purchase prevention',
        proposedAmount: 5.0,
      },
    });
    const wishResponse = await wishCreate(wishReq);
    const wish = await wishResponse.json();
    const wishId = wish.id;

    const respondReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: { accepted: true },
    });
    await wishRespond(respondReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });

    // Creator tries to purchase their own wish
    const selfPurchaseReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
    });
    const selfPurchaseResponse = await marketplacePurchase(selfPurchaseReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });

    expect(selfPurchaseResponse.ok).toBe(false);
    expect(selfPurchaseResponse.status).toBe(400);
    const errorData = await selfPurchaseResponse.json();
    expect(errorData.message).toMatch(/cannot purchase/i);
  });

  test('should handle failed transaction confirmation', async () => {
    // Setup users and wish
    const creatorToken = await authenticateTestUser(
      { id: 100200300, firstName: 'Grace' },
      generateTestTonAddress(100200300)
    );

    const buddyToken = await authenticateTestUser({
      id: 200300400,
      firstName: 'Henry',
    });

    const purchaserToken = await authenticateTestUser(
      { id: 300400500, firstName: 'Ivy' },
      generateTestTonAddress(300400500)
    );

    // Establish buddy relationship
    const buddyRequestReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 200300400 },
    });
    const buddyRequestResponse = await buddyRequest(buddyRequestReq);
    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    const acceptReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    await buddyAccept(acceptReq);

    // Create and accept wish
    const wishReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Test wish for failed transaction',
        proposedAmount: 8.0,
      },
    });
    const wishResponse = await wishCreate(wishReq);
    const wish = await wishResponse.json();
    const wishId = wish.id;

    const respondReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: { accepted: true },
    });
    await wishRespond(respondReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });

    // Initiate purchase
    const purchaseReq = createAuthenticatedRequest(purchaserToken, {
      method: 'POST',
      url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
    });
    const purchaseResponse = await marketplacePurchase(purchaseReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });
    expect(purchaseResponse.ok).toBe(true);

    const purchaseData = await purchaseResponse.json();
    const transactionId = purchaseData.transactionId;

    // Confirm transaction as failed
    const failedConfirmReq = createAuthenticatedRequest(purchaserToken, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: 'failed_transaction_hash_123',
        success: false,
      },
    });
    const failedConfirmResponse = await transactionConfirm(failedConfirmReq, {
      params: Promise.resolve({ id: String(transactionId) }),
    });

    expect(failedConfirmResponse.ok).toBe(true);
    const failedTransaction = await failedConfirmResponse.json();
    expect(failedTransaction.status).toBe('failed');

    // Wish should remain available in marketplace
    const marketplaceCheckReq = createAuthenticatedRequest(purchaserToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/marketplace',
    });
    const marketplaceCheck = await marketplaceGet(marketplaceCheckReq);
    const marketplaceData = await marketplaceCheck.json();
    const wishStillAvailable = marketplaceData.wishes.find(
      (w: any) => w.id === wishId
    );
    expect(wishStillAvailable).toBeDefined();
    expect(wishStillAvailable.status).toBe('accepted');
  });

  test('should handle concurrent purchase attempts', async () => {
    // Setup users and wish
    const creatorToken = await authenticateTestUser(
      { id: 401502603, firstName: 'Jack' },
      generateTestTonAddress(401502603)
    );

    const buddyToken = await authenticateTestUser({
      id: 501602703,
      firstName: 'Kelly',
    });

    const user1Token = await authenticateTestUser(
      { id: 601702803, firstName: 'Henry' },
      generateTestTonAddress(601702803)
    );

    const user2Token = await authenticateTestUser(
      { id: 704805906, firstName: 'Ivy' },
      generateTestTonAddress(704805906)
    );

    // Establish buddy relationship
    const buddyRequestReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 501602703 },
    });
    const buddyRequestResponse = await buddyRequest(buddyRequestReq);
    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    const acceptReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    await buddyAccept(acceptReq);

    // Create and accept wish
    const wishReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Test wish for concurrent purchase',
        proposedAmount: 12.0,
      },
    });
    const wishResponse = await wishCreate(wishReq);
    const wish = await wishResponse.json();
    const wishId = wish.id;

    const respondReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: { accepted: true },
    });
    await wishRespond(respondReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });

    // Simultaneous purchase attempts
    const promises = [
      marketplacePurchase(
        createAuthenticatedRequest(user1Token, {
          method: 'POST',
          url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
        }),
        { params: Promise.resolve({ id: String(wishId) }) }
      ),
      marketplacePurchase(
        createAuthenticatedRequest(user2Token, {
          method: 'POST',
          url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
        }),
        { params: Promise.resolve({ id: String(wishId) }) }
      ),
    ];

    const responses = await Promise.all(promises);

    // Only one should succeed
    const successful = responses.filter((r) => r.status === 200);
    const failed = responses.filter((r) => r.status !== 200);

    expect(successful.length).toBeLessThanOrEqual(1);
    expect(failed.length).toBeGreaterThanOrEqual(1);

    // Failed response should indicate wish is no longer available
    for (const failedResponse of failed) {
      if (failedResponse.status === 400) {
        const errorData = await failedResponse.json();
        expect(errorData.message).toMatch(/not available|already purchased/i);
      }
    }
  });

  test('should show transaction history after purchase', async () => {
    // Setup users and wish
    const creatorToken = await authenticateTestUser(
      { id: 300400500, firstName: 'Leo' },
      generateTestTonAddress(300400500)
    );

    const buddyToken = await authenticateTestUser({
      id: 400500600,
      firstName: 'Mia',
    });

    const purchaserToken = await authenticateTestUser(
      { id: 500600700, firstName: 'Jack' },
      generateTestTonAddress(500600700)
    );

    // Check initial transaction history
    const initialHistoryReq = createAuthenticatedRequest(purchaserToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });
    const initialHistoryResponse = await transactionsGet(initialHistoryReq);
    expect(initialHistoryResponse.ok).toBe(true);
    const initialHistory = await initialHistoryResponse.json();
    const initialCount = initialHistory.transactions.length;

    // Establish buddy relationship
    const buddyRequestReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 400500600 },
    });
    const buddyRequestResponse = await buddyRequest(buddyRequestReq);
    const buddyRequestData = await buddyRequestResponse.json();
    const buddyPairId = buddyRequestData.id;

    const acceptReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
    });
    await buddyAccept(acceptReq);

    // Create and accept wish
    const wishReq = createAuthenticatedRequest(creatorToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wishes',
      body: {
        description: 'Test wish for transaction history',
        proposedAmount: 15.0,
      },
    });
    const wishResponse = await wishCreate(wishReq);
    const wish = await wishResponse.json();
    const wishId = wish.id;

    const respondReq = createAuthenticatedRequest(buddyToken, {
      method: 'POST',
      url: `http://localhost:3000/api/wishes/${wishId}/respond`,
      body: { accepted: true },
    });
    await wishRespond(respondReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });

    // Make a purchase
    const purchaseReq = createAuthenticatedRequest(purchaserToken, {
      method: 'POST',
      url: `http://localhost:3000/api/marketplace/${wishId}/purchase`,
    });
    const purchaseResponse = await marketplacePurchase(purchaseReq, {
      params: Promise.resolve({ id: String(wishId) }),
    });
    expect(purchaseResponse.ok).toBe(true);

    // Check updated transaction history
    const updatedHistoryReq = createAuthenticatedRequest(purchaserToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });
    const updatedHistoryResponse = await transactionsGet(updatedHistoryReq);
    expect(updatedHistoryResponse.ok).toBe(true);
    const updatedHistory = await updatedHistoryResponse.json();
    expect(updatedHistory.transactions.length).toBe(initialCount + 1);

    // Verify the new transaction is a purchase type
    const newTransaction = updatedHistory.transactions.find(
      (t: any) =>
        t.transactionType === 'purchase' &&
        t.relatedEntityType === 'wish' &&
        t.relatedEntityId === wishId
    );
    expect(newTransaction).toBeDefined();
    expect(newTransaction.status).toBe('pending');
  });
});
