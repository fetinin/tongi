import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GET as walletStatusHandler } from '@/app/api/wallet/status/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../../helpers/request';

describe('GET /api/wallet/status', () => {
  const db = getDatabase();
  const testUserId = 999997;
  const testWalletAddress = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';
  let authToken: string;

  beforeEach(async () => {
    // Create test user (without wallet initially)
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

  it('should return connected status with wallet address', async () => {
    // Set wallet address
    db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
      testWalletAddress,
      testUserId
    );

    const request = createAuthenticatedRequest(authToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });

    const response = await walletStatusHandler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.connected).toBe(true);
    expect(data.address).toBe(testWalletAddress);
    expect(data.user.id).toBe(testUserId);
    expect(data.user.first_name).toBe('TestUser');
  });

  it('should return disconnected status without wallet address', async () => {
    const request = createAuthenticatedRequest(authToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });

    const response = await walletStatusHandler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.connected).toBe(false);
    expect(data.address).toBeNull();
  });

  it('should reject request without authentication', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });

    const response = await walletStatusHandler(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('AUTH_FAILED');
  });

  it('should persist wallet status across requests', async () => {
    // Connect wallet
    db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
      testWalletAddress,
      testUserId
    );

    // First status check
    const request1 = createAuthenticatedRequest(authToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });
    const response1 = await walletStatusHandler(request1);
    const data1 = await response1.json();
    expect(data1.connected).toBe(true);
    expect(data1.address).toBe(testWalletAddress);

    // Second status check (should return same data)
    const request2 = createAuthenticatedRequest(authToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });
    const response2 = await walletStatusHandler(request2);
    const data2 = await response2.json();
    expect(data2.connected).toBe(true);
    expect(data2.address).toBe(testWalletAddress);
  });

  it('should return consistent address format', async () => {
    // Set wallet address
    db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
      testWalletAddress,
      testUserId
    );

    const request = createAuthenticatedRequest(authToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/wallet/status',
    });

    const response = await walletStatusHandler(request);
    const data = await response.json();

    // Verify address format (should be user-friendly format)
    expect(data.address).toMatch(/^EQ[A-Za-z0-9_-]{46}$/);
  });
});
