import { createTestInitData, TelegramUser } from '@/lib/telegram';
import { POST as validateAuth } from '@/app/api/auth/validate/route';
import { createMockRequest } from './request';

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
 */
export function generateTestTonAddress(userId: number): string {
  // Generate valid TON address (48 characters from [A-Za-z0-9_-])
  const base64url =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const userIdHex = userId.toString(16).padStart(12, '0');
  let address = 'EQ' + userIdHex;

  // Fill the rest with deterministic characters based on userId to make it 48 total
  // This ensures the same userId always generates the same address
  while (address.length < 48) {
    const index = (userId + address.length) % base64url.length;
    address += base64url[index];
  }

  return address;
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
