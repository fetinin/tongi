// Global test setup
import { jest } from '@jest/globals';

// Mock environment variables for testing
// NODE_ENV is automatically set to 'test' by Jest
process.env.TELEGRAM_BOT_TOKEN = 'test_telegram_bot_token';
process.env.BANK_WALLET_PRIVATE_KEY = 'test_bank_wallet_private_key';
process.env.DATABASE_URL = ':memory:';

// Extend expect for custom matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add custom matchers here if needed
    }
  }
}

// Mock fetch globally for API tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
});