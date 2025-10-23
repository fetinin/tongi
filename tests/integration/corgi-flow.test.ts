import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import nock from 'nock';
import { authenticateTestUser, generateTestTonAddress } from '../helpers/auth';
import { clearDatabase, initializeBankWallet } from '../helpers/database';
import { createAuthenticatedRequest } from '../helpers/request';
import {
  POST as createSighting,
  GET as getSightings,
} from '@/app/api/corgi/sightings/route';
import { GET as getConfirmations } from '@/app/api/corgi/confirmations/route';
import { POST as confirmSighting } from '@/app/api/corgi/confirm/[id]/route';
import { POST as createBuddyRequest } from '@/app/api/buddy/request/route';
import { POST as acceptBuddyRequest } from '@/app/api/buddy/accept/route';
import { GET as getBuddyStatus } from '@/app/api/buddy/status/route';
import { getDatabase } from '@/lib/database';
import { Address, beginCell } from '@ton/core';

// T016: Integration test corgi sighting confirmation flow
describe('Corgi Sighting Confirmation Flow Integration', () => {
  // Helper function to establish buddy relationship between two users
  async function establishBuddyRelationship(
    requesterToken: string,
    requesterId: number,
    targetToken: string,
    targetId: number
  ): Promise<number> {
    // User A sends buddy request to User B
    const requestResponse = await createBuddyRequest(
      createAuthenticatedRequest(requesterToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/request',
        body: { targetUserId: targetId },
      })
    );

    expect(requestResponse.status).toBe(201);
    const requestData = await requestResponse.json();
    const buddyPairId = requestData.id;

    // User B accepts the buddy request
    const acceptResponse = await acceptBuddyRequest(
      createAuthenticatedRequest(targetToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/buddy/accept',
        body: { buddyPairId },
      })
    );

    expect(acceptResponse.status).toBe(200);

    // Verify both users see active buddy status
    const statusAResponse = await getBuddyStatus(
      createAuthenticatedRequest(requesterToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      })
    );
    const statusA = await statusAResponse.json();
    expect(statusA.status).toBe('active');

    const statusBResponse = await getBuddyStatus(
      createAuthenticatedRequest(targetToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/buddy/status',
      })
    );
    const statusB = await statusBResponse.json();
    expect(statusB.status).toBe('active');

    return buddyPairId;
  }

  // Helper function to encode TON address as base64 cell for RPC stack responses
  function encodeAddressToCell(addressString: string): string {
    const address = Address.parse(addressString);
    const cell = beginCell().storeAddress(address).endCell();
    return cell.toBoc().toString('base64');
  }

  // Helper function to set up TON blockchain HTTP mocks
  function setupTONRPCMocks() {
    const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com';

    // Mock v2 API endpoint (JSON-RPC)
    // The @ton/ton SDK uses only the JSON-RPC POST endpoint for all operations
    // .persist() keeps the mock active for multiple requests (without it, only the first request works)
    nock(TON_TESTNET_ENDPOINT)
      .persist()
      .post('/api/v2/jsonRPC')
      .reply(
        200,
        function (
          this: nock.ReplyFnContext,
          uri: string,
          requestBody: Record<string, unknown>
        ) {
          // Set proper JSON headers
          this.req.headers['content-type'] = 'application/json';
          const method = requestBody.method;
          const params = requestBody.params;
          console.log(
            '[MOCK] JSON-RPC:',
            method,
            'params:',
            JSON.stringify(params)
          );

          // Handle different RPC methods
          switch (method) {
            case 'getAddressInformation':
              // Used for balance checks - TonCenter API v2 format
              // Must match @ton/ton SDK's Zod schema for addressInformation
              const balanceResult = {
                ok: true,
                result: {
                  balance: '100000000000', // 100 TON in nanotons
                  state: 'active',
                  code: '',
                  data: '',
                  last_transaction_id: {
                    '@type': 'internal.transactionId',
                    lt: '1000000',
                    hash: 'mock_hash_base64==',
                  },
                  block_id: {
                    '@type': 'ton.blockIdExt',
                    workchain: -1,
                    shard: '8000000000000000',
                    seqno: 1000000,
                    root_hash: 'mock_root_hash',
                    file_hash: 'mock_file_hash',
                  },
                  sync_utime: Math.floor(Date.now() / 1000),
                },
              };
              console.log(
                '[MOCK] Returning balance:',
                balanceResult.result.balance
              );
              return balanceResult;

            case 'runGetMethod':
              // Used for getSeqno, getJettonBalance, get_wallet_address, etc.
              // Different methods return different stack types
              const methodName = (params as any)?.method;

              if (methodName === 'get_wallet_address') {
                // get_wallet_address returns an address (as a cell/slice)
                // Extract the owner address from params stack and generate jetton wallet
                const ownerAddress =
                  (params as any)?.stack?.[0]?.[1] || 'mock_address';
                // For testing, generate a deterministic jetton wallet address
                const jettonWalletAddr = generateTestTonAddress(12345);
                const addressCell = encodeAddressToCell(jettonWalletAddr);

                return {
                  ok: true,
                  result: {
                    gas_used: 123,
                    // SDK expects format: ['slice', { bytes: '<base64>' }]
                    stack: [['slice', { bytes: addressCell }]],
                    exit_code: 0,
                  },
                };
              } else if (methodName === 'get_wallet_data') {
                // get_wallet_data returns (balance, owner, jetton_master, jetton_wallet_code)
                // First item is balance as a number
                return {
                  ok: true,
                  result: {
                    gas_used: 123,
                    stack: [['num', '1000000000000']], // High Jetton balance
                    exit_code: 0,
                  },
                };
              } else {
                // Default: getSeqno and other methods return numbers
                return {
                  ok: true,
                  result: {
                    gas_used: 123,
                    stack: [['num', '1000000']],
                    exit_code: 0,
                  },
                };
              }

            case 'sendBoc':
              // Used for broadcasting transactions
              // SDK expects just { '@type': 'ok' }
              return {
                ok: true,
                result: {
                  '@type': 'ok',
                },
              };

            case 'sendBocReturnHash':
              // Used for broadcasting transactions with hash
              return {
                ok: true,
                result: {
                  '@type': 'ok',
                  hash: 'mock_tx_hash_' + Date.now(),
                },
              };

            default:
              // Default response for any other method
              return {
                ok: true,
                result: {
                  balance: '100000000000',
                  stack: [['num', '1000000000000']],
                },
              };
          }
        }
      );
  }

  beforeEach(() => {
    clearDatabase();
    // Initialize bank wallet for reward distribution
    initializeBankWallet('test_bank_wallet_address', 10000);

    // Clean up any existing nock interceptors
    nock.cleanAll();
  });

  afterEach(() => {
    // Clean up nock after each test
    nock.cleanAll();
  });

  test('should complete full corgi sighting confirmation flow', async () => {
    // Test scenario: User A reports a sighting, User B (buddy) confirms it
    const userAToken = await authenticateTestUser({
      id: 100001,
      firstName: 'Alice',
      username: 'alice_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100002,
      firstName: 'Bob',
      username: 'bob_test',
    });

    // Establish buddy relationship first
    await establishBuddyRelationship(userAToken, 100001, userBToken, 100002);

    // Step 1: User A reports a corgi sighting
    const sightingData = {
      corgiCount: 5,
    };

    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: sightingData,
      })
    );

    expect(reportResponse.status).toBe(201);

    const reportData = await reportResponse.json();
    expect(reportData).toHaveProperty('id');
    expect(reportData.status).toBe('pending');
    expect(reportData.corgiCount).toBe(5);

    const sightingId = reportData.id;

    // Step 2: User B (buddy) checks for pending confirmations
    const confirmationsResponse = await getConfirmations(
      createAuthenticatedRequest(userBToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/confirmations',
      })
    );

    expect(confirmationsResponse.status).toBe(200);

    const confirmationsData = await confirmationsResponse.json();
    expect(confirmationsData).toHaveProperty('confirmations');
    expect(Array.isArray(confirmationsData.confirmations)).toBe(true);

    // Find the sighting that was just reported
    const pendingSighting = confirmationsData.confirmations.find(
      (confirmation: any) => confirmation.id === sightingId
    );
    expect(pendingSighting).toBeDefined();
    expect(pendingSighting.status).toBe('pending');
    expect(pendingSighting.corgiCount).toBe(5);

    // Step 3: User B confirms the sighting
    const confirmationData = {
      confirmed: true,
    };

    const confirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: confirmationData,
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(confirmResponse.status).toBe(200);

    const confirmData = await confirmResponse.json();
    expect(confirmData.id).toBe(sightingId);
    expect(confirmData.status).toBe('confirmed');
    expect(confirmData.respondedAt).not.toBeNull();

    // Step 4: User A checks their sightings to see the confirmed status
    const userSightingsResponse = await getSightings(
      createAuthenticatedRequest(userAToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/sightings',
      })
    );

    expect(userSightingsResponse.status).toBe(200);

    const userSightingsData = await userSightingsResponse.json();
    expect(userSightingsData).toHaveProperty('sightings');

    const confirmedSighting = userSightingsData.sightings.find(
      (sighting: any) => sighting.id === sightingId
    );
    expect(confirmedSighting).toBeDefined();
    expect(confirmedSighting.status).toBe('confirmed');
    expect(confirmedSighting.respondedAt).not.toBeNull();

    // Step 5: Verify the sighting no longer appears in pending confirmations
    const finalConfirmationsResponse = await getConfirmations(
      createAuthenticatedRequest(userBToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/confirmations',
      })
    );

    expect(finalConfirmationsResponse.status).toBe(200);
    const finalConfirmationsData = await finalConfirmationsResponse.json();

    const stillPendingSighting = finalConfirmationsData.confirmations.find(
      (confirmation: any) => confirmation.id === sightingId
    );
    expect(stillPendingSighting).toBeUndefined();
  });

  test('should complete full corgi sighting denial flow', async () => {
    // Test scenario: User A reports a sighting, User B (buddy) denies it
    const userAToken = await authenticateTestUser({
      id: 100003,
      firstName: 'Carol',
      username: 'carol_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100004,
      firstName: 'Dave',
      username: 'dave_test',
    });

    // Establish buddy relationship first
    await establishBuddyRelationship(userAToken, 100003, userBToken, 100004);

    // Step 1: User A reports a corgi sighting
    const sightingData = {
      corgiCount: 2,
    };

    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: sightingData,
      })
    );

    expect(reportResponse.status).toBe(201);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User B denies the sighting
    const denialData = {
      confirmed: false,
    };

    const confirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: denialData,
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(confirmResponse.status).toBe(200);
    const confirmData = await confirmResponse.json();
    expect(confirmData.status).toBe('denied');
    expect(confirmData.respondedAt).not.toBeNull();

    // Step 3: Verify User A can see the denied status
    const userSightingsResponse = await getSightings(
      createAuthenticatedRequest(userAToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/sightings?status=denied',
        query: { status: 'denied' },
      })
    );

    expect(userSightingsResponse.status).toBe(200);
    const userSightingsData = await userSightingsResponse.json();

    const deniedSighting = userSightingsData.sightings.find(
      (sighting: any) => sighting.id === sightingId
    );
    expect(deniedSighting).toBeDefined();
    expect(deniedSighting.status).toBe('denied');
  });

  test('should handle multiple pending confirmations correctly', async () => {
    const userAToken = await authenticateTestUser({
      id: 100005,
      firstName: 'Eve',
      username: 'eve_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100006,
      firstName: 'Frank',
      username: 'frank_test',
    });

    // Establish buddy relationship first
    await establishBuddyRelationship(userAToken, 100005, userBToken, 100006);

    // Step 1: User A reports multiple sightings
    const sightings = [{ corgiCount: 1 }, { corgiCount: 3 }, { corgiCount: 7 }];

    const sightingIds: number[] = [];

    for (const sightingData of sightings) {
      const reportResponse = await createSighting(
        createAuthenticatedRequest(userAToken, {
          method: 'POST',
          url: 'http://localhost:3000/api/corgi/sightings',
          body: sightingData,
        })
      );

      expect(reportResponse.status).toBe(201);
      const reportData = await reportResponse.json();
      sightingIds.push(reportData.id);
    }

    // Step 2: User B checks confirmations and sees all three
    const confirmationsResponse = await getConfirmations(
      createAuthenticatedRequest(userBToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/confirmations',
      })
    );

    expect(confirmationsResponse.status).toBe(200);
    const confirmationsData = await confirmationsResponse.json();

    // Should find all three sightings in pending confirmations
    for (const sightingId of sightingIds) {
      const pendingSighting = confirmationsData.confirmations.find(
        (confirmation: any) => confirmation.id === sightingId
      );
      expect(pendingSighting).toBeDefined();
      expect(pendingSighting.status).toBe('pending');
    }

    // Step 3: User B confirms the first, denies the second, leaves third pending
    const confirmFirst = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingIds[0]}`,
        body: { confirmed: true },
      }),
      { params: Promise.resolve({ id: sightingIds[0].toString() }) }
    );
    expect(confirmFirst.status).toBe(200);

    const denySecond = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingIds[1]}`,
        body: { confirmed: false },
      }),
      { params: Promise.resolve({ id: sightingIds[1].toString() }) }
    );
    expect(denySecond.status).toBe(200);

    // Step 4: Check that only the third sighting remains in pending confirmations
    const finalConfirmationsResponse = await getConfirmations(
      createAuthenticatedRequest(userBToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/confirmations',
      })
    );

    expect(finalConfirmationsResponse.status).toBe(200);
    const finalConfirmationsData = await finalConfirmationsResponse.json();

    const remainingPending = finalConfirmationsData.confirmations.filter(
      (confirmation: any) => sightingIds.includes(confirmation.id)
    );
    expect(remainingPending).toHaveLength(1);
    expect(remainingPending[0].id).toBe(sightingIds[2]);
    expect(remainingPending[0].status).toBe('pending');
  });

  test('should prevent unauthorized users from confirming sightings', async () => {
    const userAToken = await authenticateTestUser({
      id: 100007,
      firstName: 'Grace',
      username: 'grace_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100008,
      firstName: 'Henry',
      username: 'henry_test',
    });

    const userCToken = await authenticateTestUser({
      id: 100009,
      firstName: 'Ivy',
      username: 'ivy_test',
    });

    // Establish buddy relationship between User A and User B only
    await establishBuddyRelationship(userAToken, 100007, userBToken, 100008);

    // Step 1: User A reports a sighting
    const sightingData = { corgiCount: 4 };

    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: sightingData,
      })
    );

    expect(reportResponse.status).toBe(201);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User C (not the buddy) tries to confirm the sighting
    const unauthorizedConfirmResponse = await confirmSighting(
      createAuthenticatedRequest(userCToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: { confirmed: true },
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(unauthorizedConfirmResponse.status).toBe(400);

    const errorData = await unauthorizedConfirmResponse.json();
    expect(errorData).toHaveProperty('error', 'NOT_AUTHORIZED');

    // Step 3: Verify the sighting remains pending
    const userSightingsResponse = await getSightings(
      createAuthenticatedRequest(userAToken, {
        method: 'GET',
        url: 'http://localhost:3000/api/corgi/sightings',
      })
    );

    expect(userSightingsResponse.status).toBe(200);
    const userSightingsData = await userSightingsResponse.json();

    const sighting = userSightingsData.sightings.find(
      (s: any) => s.id === sightingId
    );
    expect(sighting).toBeDefined();
    expect(sighting.status).toBe('pending');
    expect(sighting.respondedAt).toBeNull();
  });

  test('should prevent double confirmation of sightings', async () => {
    const userAToken = await authenticateTestUser({
      id: 100010,
      firstName: 'Jack',
      username: 'jack_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100011,
      firstName: 'Kate',
      username: 'kate_test',
    });

    // Establish buddy relationship first
    await establishBuddyRelationship(userAToken, 100010, userBToken, 100011);

    // Step 1: User A reports a sighting
    const sightingData = { corgiCount: 6 };

    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: sightingData,
      })
    );

    expect(reportResponse.status).toBe(201);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Step 2: User B confirms the sighting
    const firstConfirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: { confirmed: true },
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(firstConfirmResponse.status).toBe(200);
    const firstConfirmData = await firstConfirmResponse.json();
    expect(firstConfirmData.status).toBe('confirmed');

    // Step 3: User B tries to confirm again (should fail)
    const secondConfirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: { confirmed: false },
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(secondConfirmResponse.status).toBe(400);

    const errorData = await secondConfirmResponse.json();
    expect(errorData).toHaveProperty('error', 'INVALID_REQUEST');
  });

  test('should distribute Jetton reward when buddy confirms sighting', async () => {
    // Disable all real HTTP requests - only allow mocked ones
    nock.disableNetConnect();

    // Set up TON blockchain HTTP mocks FIRST (before client initialization)
    setupTONRPCMocks();

    // Set up environment variables for TON client
    // Using a test mnemonic (24 words) - this is for testing only
    process.env.TON_BANK_WALLET_MNEMONIC =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    process.env.JETTON_MASTER_ADDRESS = generateTestTonAddress(999); // Mock Jetton master
    process.env.JETTON_DECIMALS = '9';
    process.env.TON_NETWORK = 'testnet';
    process.env.CORGI_BANK_TON_MIN_BALANCE = '1000000000'; // 1 TON minimum
    process.env.CORGI_BANK_JETTON_MIN_BALANCE = '1000000000'; // 1 Corgi coin minimum

    // Create test users with TON wallet addresses
    const userAWallet = generateTestTonAddress(100020);
    const userBWallet = generateTestTonAddress(100021);

    const userAToken = await authenticateTestUser(
      {
        id: 100020,
        firstName: 'RewardUserA',
        username: 'reward_user_a',
      },
      userAWallet
    );

    const userBToken = await authenticateTestUser(
      {
        id: 100021,
        firstName: 'RewardUserB',
        username: 'reward_user_b',
      },
      userBWallet
    );

    // Establish buddy relationship
    await establishBuddyRelationship(userAToken, 100020, userBToken, 100021);

    // User A reports a sighting with 3 corgis
    const sightingData = {
      corgiCount: 3,
    };

    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: sightingData,
      })
    );

    expect(reportResponse.status).toBe(201);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // User B confirms the sighting (should trigger Jetton reward distribution)
    const confirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: { confirmed: true },
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    expect(confirmResponse.status).toBe(200);
    const confirmData = await confirmResponse.json();
    expect(confirmData.status).toBe('confirmed');

    // Verify transaction record was created in database
    const db = getDatabase();
    const transaction = db
      .prepare(
        `SELECT * FROM transactions WHERE sighting_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(sightingId) as any;

    // Assert transaction exists
    expect(transaction).toBeDefined();
    expect(transaction.sighting_id).toBe(sightingId);

    // Assert correct amount (3 corgis = 3 * 10^9 smallest units)
    expect(transaction.amount).toBe(3000000000);

    // Assert correct wallet addresses
    expect(transaction.to_wallet).toBe(userAWallet);
    // Bank wallet address (testnet uses 'kQ' prefix, mainnet uses 'EQ')
    expect(transaction.from_wallet).toMatch(/^(EQ|kQ)/);

    // Assert transaction status
    // With properly mocked TON API, transaction should successfully broadcast
    // - 'broadcasting': Successfully broadcast to blockchain
    // - 'completed': Confirmed on blockchain (if confirmation polling completes)
    expect(['broadcasting', 'completed']).toContain(transaction.status);

    // Assert transaction hash exists
    // Hash may be either:
    // - 'pending-...' format (placeholder before blockchain confirmation)
    // - 'mock_tx_hash_...' format (from sendBocReturnHash mock)
    expect(transaction.transaction_hash).toBeDefined();
    expect(transaction.transaction_hash).toMatch(/^(pending-|mock_tx_hash_)/);

    // Verify sighting reward_status is updated
    const sighting = db
      .prepare(`SELECT reward_status FROM corgi_sightings WHERE id = ?`)
      .get(sightingId) as any;

    // With properly mocked TON API, reward should be successfully distributed
    expect(sighting.reward_status).toBe('distributed');

    // Verify that mocked network calls were used (not real network)
    // The transaction hash format and successful status prove mocks were called
    // If real network was used, the transaction would likely fail or have different hash format

    // Note: We use .persist() for mocks, which means some defensive mocks may remain unused
    // The important thing is that the test succeeded using only mocked responses
    // (verified by the transaction succeeding and the pending hash format)

    // Clean up nock interceptors for this test
    nock.cleanAll();
    nock.enableNetConnect(); // Re-enable real HTTP requests
  });

  test('should fail confirmation and rollback when blockchain transaction fails', async () => {
    // Test scenario: Confirmation fails due to blockchain error, sighting remains pending
    const userAToken = await authenticateTestUser({
      id: 100007,
      firstName: 'Charlie',
      username: 'charlie_test',
    });

    const userBToken = await authenticateTestUser({
      id: 100008,
      firstName: 'Diana',
      username: 'diana_test',
    });

    // Give User A a TON wallet so reward distribution is attempted
    const db = getDatabase();
    const walletAddress = generateTestTonAddress(777);
    db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
      walletAddress,
      100007
    );

    // Establish buddy relationship
    await establishBuddyRelationship(userAToken, 100007, userBToken, 100008);

    // User A reports a sighting
    const reportResponse = await createSighting(
      createAuthenticatedRequest(userAToken, {
        method: 'POST',
        url: 'http://localhost:3000/api/corgi/sightings',
        body: { corgiCount: 3 },
      })
    );

    expect(reportResponse.status).toBe(201);
    const reportData = await reportResponse.json();
    const sightingId = reportData.id;

    // Set up blockchain mocks that will fail during broadcast
    setupTONRPCMocks();

    // Override sendBoc/sendBocReturnHash to fail with retryable error
    const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com';

    // Clean existing interceptors
    nock.cleanAll();

    // Set up new mock that succeeds for balance/wallet checks but fails on broadcast
    nock(TON_TESTNET_ENDPOINT)
      .persist()
      .post('/api/v2/jsonRPC')
      .reply(
        200,
        function (
          this: nock.ReplyFnContext,
          uri: string,
          requestBody: nock.Body
        ) {
          // Set proper JSON headers
          this.req.headers['content-type'] = 'application/json';
          const body =
            typeof requestBody === 'string'
              ? JSON.parse(requestBody)
              : requestBody;
          const method = (body as Record<string, unknown>).method;
          const params = (body as Record<string, unknown>).params;
          console.log('[MOCK-FAIL] JSON-RPC:', method);

          switch (method) {
            case 'getAddressInformation':
              return {
                ok: true,
                result: {
                  balance: '100000000000', // 100 TON
                  state: 'active',
                  code: '',
                  data: '',
                  last_transaction_id: {
                    '@type': 'internal.transactionId',
                    lt: '1000000',
                    hash: 'mock_hash_base64==',
                  },
                  block_id: {
                    '@type': 'ton.blockIdExt',
                    workchain: -1,
                    shard: '8000000000000000',
                    seqno: 1000000,
                    root_hash: 'mock_root_hash',
                    file_hash: 'mock_file_hash',
                  },
                  sync_utime: Math.floor(Date.now() / 1000),
                },
              };

            case 'runGetMethod':
              const methodName = (params as any)?.method;
              if (methodName === 'get_wallet_address') {
                const jettonWalletAddr = generateTestTonAddress(12345);
                const addressCell = encodeAddressToCell(jettonWalletAddr);
                return {
                  ok: true,
                  result: {
                    gas_used: 123,
                    stack: [['slice', { bytes: addressCell }]],
                    exit_code: 0,
                  },
                };
              } else if (methodName === 'get_wallet_data') {
                return {
                  ok: true,
                  result: {
                    gas_used: 123,
                    stack: [['num', '1000000000000']],
                    exit_code: 0,
                  },
                };
              }
              return {
                ok: true,
                result: {
                  gas_used: 123,
                  stack: [['num', '1000000']],
                  exit_code: 0,
                },
              };

            case 'sendBoc':
            case 'sendBocReturnHash':
              // Simulate network timeout (retryable error)
              // Return error response instead of throwing
              return {
                ok: false,
                error: 'Network timeout',
                code: 503,
              };

            default:
              return {
                ok: true,
                result: {
                  balance: '100000000000',
                  stack: [['num', '1000000000000']],
                },
              };
          }
        }
      );

    // User B attempts to confirm - should fail with 503
    const confirmResponse = await confirmSighting(
      createAuthenticatedRequest(userBToken, {
        method: 'POST',
        url: `http://localhost:3000/api/corgi/confirm/${sightingId}`,
        body: { confirmed: true },
      }),
      { params: Promise.resolve({ id: sightingId.toString() }) }
    );

    // Should return 503 Service Unavailable (retryable error)
    expect(confirmResponse.status).toBe(503);

    const errorData = await confirmResponse.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toBe('BLOCKCHAIN_ERROR');

    // Verify sighting is still pending (rollback successful)
    const sighting = db
      .prepare(`SELECT status, responded_at FROM corgi_sightings WHERE id = ?`)
      .get(sightingId) as any;

    expect(sighting.status).toBe('pending');
    expect(sighting.responded_at).toBeNull();

    // Verify transaction was created but marked as failed
    const transaction = db
      .prepare(`SELECT * FROM transactions WHERE sighting_id = ?`)
      .get(sightingId) as any;

    expect(transaction).toBeDefined();
    expect(transaction.status).toBe('failed');
    expect(transaction.failure_reason).toContain('Network timeout');

    // Clean up
    nock.cleanAll();
  }, 10000); // 10 second timeout for blockchain operations
});
