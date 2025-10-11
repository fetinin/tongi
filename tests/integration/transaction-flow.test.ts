import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET as getTransactions } from '@/app/api/transactions/route';
import { POST as confirmTransaction } from '@/app/api/transactions/[id]/confirm/route';
import { createAuthenticatedRequest } from '../helpers/request';
import {
  authenticateTestUser,
  TestUser,
  generateTestTonAddress,
} from '../helpers/auth';
import { clearDatabase, initializeBankWallet } from '../helpers/database';
import { transactionService } from '@/services/TransactionService';

describe('Transaction Confirmation Flow Integration', () => {
  let user1Token: string;
  let user2Token: string;
  // Bank wallet address must be 48 characters to pass TON address validation
  const bankWalletAddress = 'UQBankWallet123456789_0123456789ABCDEFabcdef-_';

  const user1: TestUser = {
    id: 123456789,
    firstName: 'Alice',
    username: 'alice_user',
  };

  const user2: TestUser = {
    id: 987654321,
    firstName: 'Bob',
    username: 'bob_user',
  };

  beforeEach(async () => {
    // Clear database and setup test data
    clearDatabase();

    // Initialize bank wallet for reward transactions
    initializeBankWallet(bankWalletAddress, 10000);

    // Authenticate test users with wallet addresses
    user1Token = await authenticateTestUser(
      user1,
      generateTestTonAddress(user1.id)
    );
    user2Token = await authenticateTestUser(
      user2,
      generateTestTonAddress(user2.id)
    );
  });

  afterEach(() => {
    // Clean up test data
    clearDatabase();
  });

  it('should complete full transaction confirmation flow for reward', async () => {
    // Step 1: Create a pending reward transaction (simulating corgi sighting confirmation)
    const rewardAmount = 10; // 10 Corgi coins

    const createResult = await transactionService.createRewardTransaction(
      generateTestTonAddress(user1.id),
      rewardAmount,
      1 // corgi sighting ID
    );

    const transactionId = createResult.transaction.id;
    expect(createResult.transaction.status).toBe('pending');
    expect(createResult.transaction.amount).toBe(rewardAmount);
    expect(createResult.transaction.transaction_type).toBe('reward');

    // Step 2: User views their pending transactions
    const getRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const getResponse = await getTransactions(getRequest);
    expect(getResponse.status).toBe(200);

    const transactions = await getResponse.json();
    expect(transactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'pending',
        transactionType: 'reward',
        amount: rewardAmount,
      })
    );

    // Step 3: User confirms transaction with TON blockchain hash
    const tonTxHash = '0xabcdef1234567890confirmedtransaction';
    const confirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: tonTxHash,
      },
    });

    const confirmResponse = await confirmTransaction(confirmRequest, {
      params: Promise.resolve({ id: transactionId.toString() }),
    });

    expect(confirmResponse.status).toBe(200);
    const confirmedTransaction = await confirmResponse.json();
    expect(confirmedTransaction).toMatchObject({
      id: transactionId,
      status: 'completed',
      transactionHash: tonTxHash,
      completedAt: expect.any(String),
    });

    // Step 4: Verify transaction appears as confirmed in subsequent queries
    const verifyRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const verifyResponse = await getTransactions(verifyRequest);
    expect(verifyResponse.status).toBe(200);

    const confirmedTransactions = await verifyResponse.json();
    expect(confirmedTransactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'completed',
        transactionHash: tonTxHash,
      })
    );
  });

  it('should complete full transaction confirmation flow for purchase', async () => {
    // Step 1: Create a pending purchase transaction (simulating wish purchase)
    const purchaseAmount = 25; // 25 Corgi coins

    const createResult = await transactionService.createPurchaseTransaction(
      generateTestTonAddress(user1.id), // buyer
      generateTestTonAddress(user2.id), // seller
      purchaseAmount,
      1 // wish ID
    );

    const transactionId = createResult.transaction.id;
    expect(createResult.transaction.status).toBe('pending');
    expect(createResult.transaction.amount).toBe(purchaseAmount);
    expect(createResult.transaction.transaction_type).toBe('purchase');

    // Step 2: Buyer views their pending transactions
    const buyerGetRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const buyerGetResponse = await getTransactions(buyerGetRequest);
    expect(buyerGetResponse.status).toBe(200);

    const buyerTransactions = await buyerGetResponse.json();
    expect(buyerTransactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'pending',
        transactionType: 'purchase',
        fromWallet: generateTestTonAddress(user1.id),
      })
    );

    // Step 3: Seller views their pending transactions
    const sellerGetRequest = createAuthenticatedRequest(user2Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const sellerGetResponse = await getTransactions(sellerGetRequest);
    expect(sellerGetResponse.status).toBe(200);

    const sellerTransactions = await sellerGetResponse.json();
    expect(sellerTransactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'pending',
        transactionType: 'purchase',
        toWallet: generateTestTonAddress(user2.id),
      })
    );

    // Step 4: Buyer confirms transaction with TON blockchain hash
    const tonTxHash = '0xfedcba0987654321purchaseconfirmed';
    const confirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: tonTxHash,
      },
    });

    const confirmResponse = await confirmTransaction(confirmRequest, {
      params: Promise.resolve({ id: transactionId.toString() }),
    });

    expect(confirmResponse.status).toBe(200);
    const confirmedTransaction = await confirmResponse.json();
    expect(confirmedTransaction).toMatchObject({
      id: transactionId,
      status: 'completed',
      transactionHash: tonTxHash,
      completedAt: expect.any(String),
    });

    // Step 5: Both parties can see the confirmed transaction
    const buyerVerifyRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const sellerVerifyRequest = createAuthenticatedRequest(user2Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const buyerVerifyResponse = await getTransactions(buyerVerifyRequest);
    const sellerVerifyResponse = await getTransactions(sellerVerifyRequest);

    expect(buyerVerifyResponse.status).toBe(200);
    expect(sellerVerifyResponse.status).toBe(200);

    const buyerConfirmedTransactions = await buyerVerifyResponse.json();
    const sellerConfirmedTransactions = await sellerVerifyResponse.json();

    expect(buyerConfirmedTransactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'completed',
      })
    );

    expect(sellerConfirmedTransactions.transactions).toContainEqual(
      expect.objectContaining({
        id: transactionId,
        status: 'completed',
      })
    );
  });

  it('should handle transaction confirmation with empty TON hash', async () => {
    // Create a pending reward transaction
    const createResult = await transactionService.createRewardTransaction(
      generateTestTonAddress(user1.id),
      5,
      2 // corgi sighting ID
    );

    const transactionId = createResult.transaction.id;

    // Attempt to confirm with empty TON hash
    const confirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: '',
      },
    });

    const confirmResponse = await confirmTransaction(confirmRequest, {
      params: Promise.resolve({ id: transactionId.toString() }),
    });

    expect(confirmResponse.status).toBe(400);
    const errorData = await confirmResponse.json();
    expect(errorData.error).toBe('VALIDATION_ERROR');
    expect(errorData.message).toMatch(/cannot be empty/i);

    // Verify transaction remains pending
    const verifyRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const verifyResponse = await getTransactions(verifyRequest);
    expect(verifyResponse.status).toBe(200);

    const transactions = await verifyResponse.json();
    const transaction = transactions.transactions.find(
      (t: any) => t.id === transactionId
    );
    expect(transaction?.status).toBe('pending');
  });

  it('should prevent unauthorized transaction confirmation', async () => {
    // Create a reward transaction for user1
    const createResult = await transactionService.createRewardTransaction(
      generateTestTonAddress(user1.id),
      15,
      3 // corgi sighting ID
    );

    const transactionId = createResult.transaction.id;

    // User2 attempts to confirm user1's transaction
    const confirmRequest = createAuthenticatedRequest(user2Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: '0xvalidhashbutunauthorized123456',
      },
    });

    const confirmResponse = await confirmTransaction(confirmRequest, {
      params: Promise.resolve({ id: transactionId.toString() }),
    });

    expect(confirmResponse.status).toBe(403);
    const errorData = await confirmResponse.json();
    expect(errorData.error).toBe('FORBIDDEN');
    expect(errorData.message).toMatch(/not authorized/i);

    // Verify transaction remains pending and unchanged
    const verifyRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions',
    });

    const verifyResponse = await getTransactions(verifyRequest);
    expect(verifyResponse.status).toBe(200);

    const transactions = await verifyResponse.json();
    const transaction = transactions.transactions.find(
      (t: any) => t.id === transactionId
    );
    expect(transaction?.status).toBe('pending');
    expect(transaction?.transactionHash).toBeNull();
  });

  it('should handle pagination correctly in transaction history', async () => {
    // Create multiple transactions for user1
    const transactionCount = 12;
    for (let i = 0; i < transactionCount; i++) {
      await transactionService.createRewardTransaction(
        generateTestTonAddress(user1.id),
        5 + i,
        100 + i // different corgi sighting IDs
      );
    }

    // Test first page with limit of 5
    const page1Request = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions?limit=5',
      query: { limit: '5' },
    });

    const page1Response = await getTransactions(page1Request);
    expect(page1Response.status).toBe(200);

    const page1Data = await page1Response.json();
    expect(page1Data.transactions.length).toBe(5);

    // Get all transaction IDs from first page
    const page1Ids = page1Data.transactions.map((t: any) => t.id);

    // Test that all transactions from the first page are different
    const uniquePage1Ids = new Set(page1Ids);
    expect(uniquePage1Ids.size).toBe(5);
  });

  it('should filter transactions by type', async () => {
    // Create both reward and purchase transactions
    await transactionService.createRewardTransaction(
      generateTestTonAddress(user1.id),
      10,
      200
    );

    await transactionService.createPurchaseTransaction(
      generateTestTonAddress(user1.id),
      generateTestTonAddress(user2.id),
      20,
      201
    );

    // Filter for reward transactions only
    const rewardRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions?type=reward',
      query: { type: 'reward' },
    });

    const rewardResponse = await getTransactions(rewardRequest);
    expect(rewardResponse.status).toBe(200);

    const rewardData = await rewardResponse.json();
    expect(rewardData.transactions.length).toBeGreaterThan(0);
    rewardData.transactions.forEach((t: any) => {
      expect(t.transactionType).toBe('reward');
    });

    // Filter for purchase transactions only
    const purchaseRequest = createAuthenticatedRequest(user1Token, {
      method: 'GET',
      url: 'http://localhost:3000/api/transactions?type=purchase',
      query: { type: 'purchase' },
    });

    const purchaseResponse = await getTransactions(purchaseRequest);
    expect(purchaseResponse.status).toBe(200);

    const purchaseData = await purchaseResponse.json();
    expect(purchaseData.transactions.length).toBeGreaterThan(0);
    purchaseData.transactions.forEach((t: any) => {
      expect(t.transactionType).toBe('purchase');
    });
  });

  it('should prevent confirming already completed transaction', async () => {
    // Create and confirm a transaction
    const createResult = await transactionService.createRewardTransaction(
      generateTestTonAddress(user1.id),
      10,
      300
    );

    const transactionId = createResult.transaction.id;
    const firstHash = '0xfirsthash123456';

    // First confirmation
    const firstConfirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: firstHash,
      },
    });

    const firstConfirmResponse = await confirmTransaction(firstConfirmRequest, {
      params: Promise.resolve({ id: transactionId.toString() }),
    });

    expect(firstConfirmResponse.status).toBe(200);

    // Attempt to confirm again with different hash
    const secondConfirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${transactionId}/confirm`,
      body: {
        transactionHash: '0xsecondhash789456',
      },
    });

    const secondConfirmResponse = await confirmTransaction(
      secondConfirmRequest,
      { params: Promise.resolve({ id: transactionId.toString() }) }
    );

    expect(secondConfirmResponse.status).toBe(400);
    const errorData = await secondConfirmResponse.json();
    expect(errorData.error).toBe('INVALID_STATE');
    expect(errorData.message).toMatch(/cannot be confirmed/i);
  });

  it('should handle confirming non-existent transaction', async () => {
    const nonExistentId = 999999;

    const confirmRequest = createAuthenticatedRequest(user1Token, {
      method: 'POST',
      url: `http://localhost:3000/api/transactions/${nonExistentId}/confirm`,
      body: {
        transactionHash: '0xvalidhash123456',
      },
    });

    const confirmResponse = await confirmTransaction(confirmRequest, {
      params: Promise.resolve({ id: nonExistentId.toString() }),
    });

    expect(confirmResponse.status).toBe(404);
    const errorData = await confirmResponse.json();
    expect(errorData.error).toBe('TRANSACTION_NOT_FOUND');
  });
});
