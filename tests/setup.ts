// Global test setup
import { jest } from '@jest/globals';

// Mock environment variables for testing
// NODE_ENV is automatically set to 'test' by Jest
process.env.TELEGRAM_BOT_TOKEN = 'test_telegram_bot_token';
process.env.BANK_WALLET_PRIVATE_KEY = 'test_bank_wallet_private_key';
process.env.DATABASE_URL = ':memory:';

// Extend expect for custom matchers if needed
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
    interface Matchers<R = unknown> {
      // Add custom matchers here if needed
      // This interface is intentionally empty for future custom matcher extensions
      // R generic maintained for Jest compatibility
    }
  }
}

// Mock fetch globally for API tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
});
