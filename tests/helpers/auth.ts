import { createTestInitData, TelegramUser } from '@/lib/telegram';
import { POST as validateAuth } from '@/app/api/auth/validate/route';
import { createMockRequest } from './request';
import { Address } from '@ton/core';
import { createHash } from 'crypto';

export interface TestUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

/**
 * Generate a deterministic valid test TON wallet address
 * Uses userId to generate the same address consistently for the same user
 * Creates addresses with valid CRC16 checksums using @ton/core
 */
export function generateTestTonAddress(userId: number): string {
  // Generate deterministic 32-byte hash from userId
  const data = `test_user_${userId}`;
  const hash = createHash('sha256').update(data).digest();

  // Create proper Address object with workchain 0 (standard workchain)
  const address = new Address(0, hash);

  // Return testnet address (testOnly: true) with bounceable flag
  return address.toString({ testOnly: true, bounceable: true });
}

/**
 * Create valid Telegram initData for testing
 */
export function createValidInitData(user: TestUser): string {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'test_telegram_bot_token';

  const telegramUser: TelegramUser = {
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
    language_code: user.languageCode,
  };

  return createTestInitData(telegramUser, botToken);
}

/**
 * Authenticate a test user and return the JWT token
 */
export async function authenticateTestUser(
  user: TestUser,
  tonWalletAddress?: string
): Promise<string> {
  const initData = createValidInitData(user);

  const request = createMockRequest({
    method: 'POST',
    url: 'http://localhost:3000/api/auth/validate',
    body: {
      initData,
      tonWalletAddress,
    },
  });

  const response = await validateAuth(request);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Authentication failed: ${data.message || 'Unknown error'}`
    );
  }

  return data.token;
}

/**
 * Create multiple authenticated test users
 */
export async function createAuthenticatedUsers(
  users: TestUser[]
): Promise<Map<number, string>> {
  const tokens = new Map<number, string>();

  for (const user of users) {
    const token = await authenticateTestUser(user);
    tokens.set(user.id, token);
  }

  return tokens;
}
