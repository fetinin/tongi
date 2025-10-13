import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { POST as walletConnectHandler } from '@/app/api/wallet/connect/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../../helpers/request';

describe('POST /api/wallet/connect', () => {
  const db = getDatabase();
  const testUserId = 999999;
  const testWalletAddress = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';
  let authToken: string;

  beforeEach(async () => {
    // Create test user and get auth token
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name) VALUES (?, ?)'
    ).run(testUserId, 'TestUser');

    authToken = await authenticateTestUser({
      id: testUserId,
      firstName: 'TestUser',
    });
  });

  afterEach(() => {
    // Clean up test user
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  it('should connect wallet successfully with valid authentication', async () => {
    const request = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: {
        walletAddress: testWalletAddress,
      },
    });

    const response = await walletConnectHandler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.ton_wallet_address).toBe(testWalletAddress);

    // Verify database persistence
    const user = db
      .prepare('SELECT ton_wallet_address FROM users WHERE id = ?')
      .get(testUserId) as { ton_wallet_address: string };
    expect(user.ton_wallet_address).toBe(testWalletAddress);
  });

  it('should reject invalid wallet address', async () => {
    const request = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: {
        walletAddress: 'invalid-address',
      },
    });

    const response = await walletConnectHandler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('INVALID_ADDRESS');
  });

  it('should reject request without authentication', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: {
        walletAddress: testWalletAddress,
      },
    });

    const response = await walletConnectHandler(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('AUTH_FAILED');
  });

  it('should update existing wallet address when connecting new wallet', async () => {
    const oldAddress = 'EQAaGHUHfkpWFGs428ETmym4vbvRNPZnjaxidyMuur0w_OKb';

    // Set initial wallet address
    db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
      oldAddress,
      testUserId
    );

    // Connect new wallet
    const request = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/connect',
      body: {
        walletAddress: testWalletAddress,
      },
    });

    const response = await walletConnectHandler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.ton_wallet_address).toBe(testWalletAddress);

    // Verify old address was replaced
    const user = db
      .prepare('SELECT ton_wallet_address FROM users WHERE id = ?')
      .get(testUserId) as { ton_wallet_address: string };
    expect(user.ton_wallet_address).toBe(testWalletAddress);
    expect(user.ton_wallet_address).not.toBe(oldAddress);
  });
});
