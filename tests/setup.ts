// Global test setup
import { jest } from '@jest/globals';
import { getDatabase, resetDatabase } from '@/lib/database';
import { runMigrations } from '@/lib/database/migrations';

// Mock environment variables for testing
// NODE_ENV is automatically set to 'test' by Jest
process.env.TELEGRAM_BOT_TOKEN = 'test_telegram_bot_token';
process.env.BANK_WALLET_PRIVATE_KEY = 'test_bank_wallet_private_key';
process.env.JWT_SECRET = 'test_jwt_secret_for_integration_tests';
process.env.TON_NETWORK = 'testnet';
process.env.TON_BANK_WALLET_MNEMONIC =
  'test word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24';
process.env.JETTON_MASTER_ADDRESS = 'EQtest_jetton_master_address';
process.env.JETTON_DECIMALS = '9';
process.env.TON_API_KEY = 'test_tonapi_key';
process.env.TONAPI_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.CORGI_BANK_TON_MIN_BALANCE = '1.0';
process.env.CORGI_BANK_JETTON_MIN_BALANCE = '1000';

// Extend expect for custom matchers if needed
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Matchers<R = unknown> {
      // Add custom matchers here if needed
      // This interface is intentionally empty for future custom matcher extensions
      // R generic maintained for Jest compatibility
    }
  }
}

// Initialize database with migrations
// Uses in-memory database automatically in test environment (NODE_ENV=test)
runMigrations(getDatabase());

beforeEach(() => {
  jest.clearAllMocks();

  // Clean database tables between tests
  const db = getDatabase();
  db.exec('DELETE FROM pending_rewards');
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM wishes');
  db.exec('DELETE FROM corgi_sightings');
  db.exec('DELETE FROM buddy_pairs');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM bank_wallet');
});
