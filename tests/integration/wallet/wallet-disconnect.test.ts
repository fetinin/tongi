import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { POST as walletDisconnectHandler } from '@/app/api/wallet/disconnect/route';
import { getDatabase } from '@/lib/database';
import { authenticateTestUser } from '../../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../../helpers/request';

describe('POST /api/wallet/disconnect', () => {
  const db = getDatabase();
  const testUserId = 999998;
  const testWalletAddress = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';
  let authToken: string;

  beforeEach(async () => {
    // Create test user with wallet address
    db.prepare(
      'INSERT OR IGNORE INTO users (id, first_name, ton_wallet_address) VALUES (?, ?, ?)'
    ).run(testUserId, 'TestUser', testWalletAddress);

    authToken = await authenticateTestUser({
      id: testUserId,
      firstName: 'TestUser',
    });
  });

  afterEach(() => {
    // Clean up test user
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  it('should disconnect wallet successfully', async () => {
    const request = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/disconnect',
    });

    const response = await walletDisconnectHandler(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.ton_wallet_address).toBeNull();

    // Verify database persistence
    const user = db
      .prepare('SELECT ton_wallet_address FROM users WHERE id = ?')
      .get(testUserId) as { ton_wallet_address: string | null };
    expect(user.ton_wallet_address).toBeNull();
  });

  it('should be idempotent (multiple disconnect calls succeed)', async () => {
    // First disconnect
    const request1 = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/disconnect',
    });
    const response1 = await walletDisconnectHandler(request1);
    expect(response1.status).toBe(200);

    // Second disconnect should also succeed
    const request2 = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/disconnect',
    });
    const response2 = await walletDisconnectHandler(request2);
    expect(response2.status).toBe(200);
    const data = await response2.json();
    expect(data.success).toBe(true);
    expect(data.user.ton_wallet_address).toBeNull();
  });

  it('should reject request without authentication', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/disconnect',
    });

    const response = await walletDisconnectHandler(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe('AUTH_FAILED');
  });

  it('should keep user authenticated after disconnect', async () => {
    const request = createAuthenticatedRequest(authToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/wallet/disconnect',
    });

    const response = await walletDisconnectHandler(request);
    expect(response.status).toBe(200);

    // Verify user still exists in database
    const user = db
      .prepare('SELECT id, first_name FROM users WHERE id = ?')
      .get(testUserId) as { id: number; first_name: string };
    expect(user.id).toBe(testUserId);
    expect(user.first_name).toBe('TestUser');
  });
});
