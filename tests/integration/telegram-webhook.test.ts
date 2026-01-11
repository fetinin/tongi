import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import nock from 'nock';
import { NextRequest } from 'next/server';
import { POST as webhookHandler } from '@/app/api/telegram/webhook/route';
import { authenticateTestUser, generateTestTonAddress } from '../helpers/auth';
import { clearDatabase, initializeBankWallet } from '../helpers/database';
import { createMockRequest } from '../helpers/request';
import { getDatabase } from '@/lib/database';
import { Address, beginCell } from '@ton/core';
import { POST as createBuddyRequest } from '@/app/api/buddy/request/route';
import { POST as acceptBuddyRequest } from '@/app/api/buddy/accept/route';
import { POST as createSighting } from '@/app/api/corgi/sightings/route';

/**
 * Database row types for type-safe query results
 */
interface CorgiSightingRow {
  id: number;
  reporter_id: number;
  buddy_id: number;
  corgi_count: number;
  status: 'pending' | 'confirmed' | 'denied';
  reward_status: 'pending' | 'distributed' | 'failed' | null;
  created_at: string;
  responded_at: string | null;
}

interface TransactionRow {
  id: number;
  sighting_id: number;
  from_wallet: string;
  to_wallet: string;
  amount: number;
  status: 'pending' | 'broadcasting' | 'completed' | 'failed';
  transaction_hash: string | null;
  created_at: string;
}

/**
 * Helper function to create a webhook POST request
 */
function createWebhookRequest(
  callbackData: string,
  userId: number,
  botSecret?: string
): NextRequest {
  const callbackQuery = {
    id: 'test_callback_id',
    from: {
      id: userId,
      is_bot: false,
      first_name: 'Test User',
    },
    message: {
      message_id: 123,
      from: { id: 999999999, is_bot: true, first_name: 'TestBot' },
      chat: { id: userId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: 'Test message',
    },
    data: callbackData,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (botSecret) {
    headers['X-Telegram-Bot-Api-Secret-Token'] = botSecret;
  }

  return createMockRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/telegram/webhook',
    body: { callback_query: callbackQuery },
    headers,
  });
}

/**
 * Helper function to set up buddy relationship and create a pending sighting
 */
async function setupBuddyWithSighting(
  buddyId: number,
  reporterToken: string,
  buddyToken: string,
  corgiCount: number
): Promise<{ sightingId: number; buddyPairId: number }> {
  // Create buddy request from reporter to buddy
  const requestResponse = await createBuddyRequest(
    createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: buddyId },
      headers: { Authorization: `Bearer ${reporterToken}` },
    })
  );
  const requestData = await requestResponse.json();
  const buddyPairId = requestData.id;

  // Accept buddy request
  await acceptBuddyRequest(
    createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/accept',
      body: { buddyPairId },
      headers: { Authorization: `Bearer ${buddyToken}` },
    })
  );

  // Note: Reporter wallet is set via authenticateTestUser() which calls /api/auth/validate
  // No direct database manipulation needed - follows black-box testing principle

  // Create sighting
  const sightingResponse = await createSighting(
    createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/corgi/sightings',
      body: { corgiCount },
      headers: { Authorization: `Bearer ${reporterToken}` },
    })
  );
  const sightingData = await sightingResponse.json();
  return { sightingId: sightingData.id, buddyPairId };
}

/**
 * Helper function to encode TON address as base64 cell for RPC stack responses
 */
function encodeAddressToCell(addressString: string): string {
  const address = Address.parse(addressString);
  const cell = beginCell().storeAddress(address).endCell();
  return cell.toBoc().toString('base64');
}

/**
 * Helper function to set up TON blockchain HTTP mocks
 */
function setupTONRPCMocks() {
  const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com';

  // Mock v2 API endpoint (JSON-RPC)
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

        // Handle different RPC methods
        switch (method) {
          case 'getAddressInformation':
            return {
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

          case 'runGetMethod':
            const methodName = (params as any)?.method;

            if (methodName === 'get_wallet_address') {
              const ownerAddress =
                (params as any)?.stack?.[0]?.[1] || 'mock_address';
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
                  stack: [['num', '1000000000000']], // High Jetton balance
                  exit_code: 0,
                },
              };
            } else {
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
            return {
              ok: true,
              result: {
                '@type': 'ok',
              },
            };

          case 'sendBocReturnHash':
            return {
              ok: true,
              result: {
                '@type': 'ok',
                hash: 'mock_tx_hash_' + Date.now(),
              },
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
}

/**
 * Helper function to set up Telegram Bot API mocks
 */
function setupTelegramBotMocks(
  expectedSuccessMessage?: string,
  expectedRejectionMessage?: string
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test_token';
  const TELEGRAM_API = 'https://api.telegram.org';

  // Mock answerCallbackQuery
  const answerCallbackScope = nock(TELEGRAM_API)
    .persist()
    .post(`/bot${botToken}/answerCallbackQuery`)
    .reply(200, (uri: string, requestBody: any) => {
      // Verify the message content matches expectations
      if (
        expectedSuccessMessage &&
        requestBody.text === expectedSuccessMessage
      ) {
        return { ok: true };
      }
      if (
        expectedRejectionMessage &&
        requestBody.text === expectedRejectionMessage
      ) {
        return { ok: true };
      }
      return { ok: true };
    });

  // Mock editMessageReplyMarkup
  const editMarkupScope = nock(TELEGRAM_API)
    .persist()
    .post(`/bot${botToken}/editMessageReplyMarkup`)
    .reply(200, { ok: true });

  return { answerCallbackScope, editMarkupScope };
}

describe('Telegram Webhook Integration Tests', () => {
  beforeEach(() => {
    clearDatabase();
    initializeBankWallet('test_bank_wallet_address', 10000);
    nock.cleanAll();

    // Set required env vars
    process.env.TELEGRAM_BOT_TOKEN = 'test_telegram_bot_token';
    process.env.TELEGRAM_BOT_SECRET = 'test_bot_secret';
    process.env.TON_BANK_WALLET_MNEMONIC =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    process.env.JETTON_MASTER_ADDRESS = generateTestTonAddress(999);
    process.env.JETTON_DECIMALS = '9';
    process.env.TON_NETWORK = 'testnet';
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should return 401 when X-Telegram-Bot-Api-Secret-Token header is missing', async () => {
    const response = await webhookHandler(
      createWebhookRequest('approve:1', 100001)
    );

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Invalid webhook secret',
    });
  });

  test('should return 401 when bot secret header is invalid', async () => {
    const response = await webhookHandler(
      createWebhookRequest('approve:1', 100001, 'invalid_secret')
    );

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Invalid webhook secret',
    });
  });

  test('should successfully approve sighting via inline keyboard button', async () => {
    // Disable real network requests
    nock.disableNetConnect();

    // Set up TON blockchain mocks
    setupTONRPCMocks();

    // Set up Telegram Bot API mocks
    setupTelegramBotMocks('Sighting confirmed! Reward has been sent.');

    // Create test users
    const reporterWallet = generateTestTonAddress(200010);
    const reporterToken = await authenticateTestUser(
      { id: 200010, firstName: 'Reporter', username: 'reporter_test' },
      reporterWallet
    );

    const buddyToken = await authenticateTestUser({
      id: 200011,
      firstName: 'Buddy',
      username: 'buddy_test',
    });

    // Set up buddy relationship and sighting
    const { sightingId } = await setupBuddyWithSighting(
      200011,
      reporterToken,
      buddyToken,
      3
    );

    // Verify sighting is pending before webhook
    const db = getDatabase();
    let sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('pending');
    expect(sighting?.responded_at).toBeNull();

    // Send webhook approval request
    const response = await webhookHandler(
      createWebhookRequest(`approve:${sightingId}`, 200011, 'test_bot_secret')
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ ok: true });

    // Verify sighting was confirmed
    sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('confirmed');
    expect(sighting?.responded_at).not.toBeNull();
    expect(sighting?.reward_status).toBe('distributed');

    // Verify transaction was created
    const transaction = db
      .prepare('SELECT * FROM transactions WHERE sighting_id = ?')
      .get(sightingId) as TransactionRow | undefined;
    expect(transaction).toBeDefined();
    expect(transaction?.amount).toBe(3000000000); // 3 corgis * 10^9 nanotons
    expect(transaction?.to_wallet).toBe(reporterWallet);
    expect(['broadcasting', 'completed']).toContain(transaction?.status);
    expect(transaction?.transaction_hash).toMatch(/^(pending-|mock_tx_hash_)/);

    // Clean up
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('should successfully reject sighting via inline keyboard button', async () => {
    // Set up Telegram Bot API mocks
    setupTelegramBotMocks(undefined, 'Sighting rejected.');

    // Create test users
    const reporterToken = await authenticateTestUser({
      id: 200020,
      firstName: 'Reporter2',
      username: 'reporter2_test',
    });

    const buddyToken = await authenticateTestUser({
      id: 200021,
      firstName: 'Buddy2',
      username: 'buddy2_test',
    });

    // Set up buddy relationship and sighting
    const { sightingId } = await setupBuddyWithSighting(
      200021,
      reporterToken,
      buddyToken,
      2
    );

    // Verify sighting is pending before webhook
    const db = getDatabase();
    let sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('pending');

    // Send webhook rejection request
    const response = await webhookHandler(
      createWebhookRequest(`reject:${sightingId}`, 200021, 'test_bot_secret')
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ ok: true });

    // Verify sighting was denied
    sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('denied');
    expect(sighting?.responded_at).not.toBeNull();

    // Verify NO transaction was created for rejected sighting
    const transaction = db
      .prepare('SELECT * FROM transactions WHERE sighting_id = ?')
      .get(sightingId) as TransactionRow | undefined;
    expect(transaction).toBeUndefined();
  });

  test('should handle duplicate callback processing gracefully', async () => {
    // Set up Telegram Bot API mocks
    setupTelegramBotMocks('Sighting confirmed! Reward has been sent.');

    // Create test users
    const reporterToken = await authenticateTestUser({
      id: 200030,
      firstName: 'Reporter3',
      username: 'reporter3_test',
    });

    const buddyToken = await authenticateTestUser({
      id: 200031,
      firstName: 'Buddy3',
      username: 'buddy3_test',
    });

    // Set up buddy relationship and sighting
    const { sightingId } = await setupBuddyWithSighting(
      200031,
      reporterToken,
      buddyToken,
      1
    );

    const db = getDatabase();

    // First call: Process approval successfully
    const firstResponse = await webhookHandler(
      createWebhookRequest(`approve:${sightingId}`, 200031, 'test_bot_secret')
    );

    expect(firstResponse.status).toBe(200);

    // Verify sighting is confirmed after first call
    let sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('confirmed');
    expect(sighting?.responded_at).not.toBeNull();

    // Second call: Try to process same sighting again
    // This should return 400 with error message (CorgiConflictError)
    const secondResponse = await webhookHandler(
      createWebhookRequest(`approve:${sightingId}`, 200031, 'test_bot_secret')
    );

    expect(secondResponse.status).toBe(400);

    const errorData = await secondResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toBe('Sighting is not in pending status');

    // Verify sighting remains in 'confirmed' status (no changes)
    sighting = db
      .prepare('SELECT * FROM corgi_sightings WHERE id = ?')
      .get(sightingId) as CorgiSightingRow | undefined;
    expect(sighting?.status).toBe('confirmed');
  });
});
