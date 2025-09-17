const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'app.db');

console.log('Seeding database at:', dbPath);
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

try {
  // Check if bank wallet already exists
  const existingBankWallet = db.prepare('SELECT id FROM bank_wallet WHERE id = 1').get();

  if (!existingBankWallet) {
    // Insert initial bank wallet record
    const insertBankWallet = db.prepare(`
      INSERT INTO bank_wallet (id, wallet_address, current_balance, total_distributed)
      VALUES (1, ?, 10000.00, 0.00)
    `);

    // Use a placeholder address for now - this should be replaced with actual bank wallet address
    const bankWalletAddress = process.env.TON_BANK_WALLET_ADDRESS || 'EQC_placeholder_bank_wallet_address';
    insertBankWallet.run(bankWalletAddress);

    console.log('✅ Bank wallet initialized with address:', bankWalletAddress);
    console.log('💰 Initial balance: 10,000.00 Corgi coins');
  } else {
    console.log('ℹ️ Bank wallet already exists, skipping seed');
  }

  // Optional: Add test users for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Adding test data');

    // Check if test users exist
    const existingUser = db.prepare('SELECT id FROM users WHERE id = 123456789').get();

    if (!existingUser) {
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, telegram_username, first_name, ton_wallet_address)
        VALUES (?, ?, ?, ?)
      `);

      // Add test users
      insertUser.run(123456789, 'testuser1', 'Test User 1', 'EQC_test_wallet_1');
      insertUser.run(987654321, 'testuser2', 'Test User 2', 'EQC_test_wallet_2');

      console.log('✅ Test users added for development');
    } else {
      console.log('ℹ️ Test users already exist, skipping');
    }
  }

  console.log('✅ Database seeding completed successfully');
} catch (error) {
  console.error('❌ Database seeding failed:', error);
  process.exit(1);
} finally {
  db.close();
}