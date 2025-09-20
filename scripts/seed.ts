import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'app.db');

console.log('Seeding database at:', dbPath);
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

try {
  // Check if bank wallet already exists
  const existingBankWallet = db.prepare('SELECT id FROM bank_wallet WHERE id = 1').get() as { id: number } | undefined;

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
    const existingUser = db.prepare('SELECT id FROM users WHERE id = 123456789').get() as { id: number } | undefined;

    if (!existingUser) {
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, telegram_username, first_name, ton_wallet_address)
        VALUES (?, ?, ?, ?)
      `);

      // Add test users
      insertUser.run(123456789, 'testuser1', 'Test User 1', 'EQC_test_wallet_1');
      insertUser.run(987654321, 'testuser2', 'Test User 2', 'EQC_test_wallet_2');

      console.log('✅ Test users added for development');

      // Optional: Create a test buddy pair for development
      const insertBuddyPair = db.prepare(`
        INSERT OR IGNORE INTO buddy_pairs (user1_id, user2_id, initiated_by, status, confirmed_at)
        VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
      `);

      insertBuddyPair.run(123456789, 987654321, 123456789);
      console.log('✅ Test buddy pair created for development');

      // Optional: Add a test corgi sighting for development
      const insertSighting = db.prepare(`
        INSERT OR IGNORE INTO corgi_sightings (reporter_id, buddy_id, corgi_count, status)
        VALUES (?, ?, ?, 'pending')
      `);

      insertSighting.run(123456789, 987654321, 3);
      console.log('✅ Test corgi sighting added for development');

      // Optional: Add a test wish for development
      const insertWish = db.prepare(`
        INSERT OR IGNORE INTO wishes (creator_id, buddy_id, description, proposed_amount, status)
        VALUES (?, ?, ?, ?, 'pending')
      `);

      insertWish.run(123456789, 987654321, 'A delicious coffee and pastry', 5.50);
      console.log('✅ Test wish added for development');
    } else {
      console.log('ℹ️ Test users already exist, skipping test data creation');
    }
  }

  console.log('✅ Database seeding completed successfully');
} catch (error) {
  console.error('❌ Database seeding failed:', error);
  process.exit(1);
} finally {
  db.close();
}