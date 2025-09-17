const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'app.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Initializing database at:', dbPath);
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

try {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        telegram_username TEXT UNIQUE,
        first_name TEXT NOT NULL,
        ton_wallet_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Buddy pairs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS buddy_pairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        initiated_by INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'dissolved')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user1_id, user2_id)
    )
  `);

  // Corgi sightings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS corgi_sightings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        buddy_id INTEGER NOT NULL,
        corgi_count INTEGER NOT NULL CHECK(corgi_count > 0 AND corgi_count <= 100),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'denied')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (buddy_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Wishes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_id INTEGER NOT NULL,
        buddy_id INTEGER NOT NULL,
        description TEXT NOT NULL CHECK(length(description) <= 500),
        proposed_amount DECIMAL(10,2) NOT NULL CHECK(proposed_amount > 0 AND proposed_amount <= 1000),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'purchased')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        purchased_at DATETIME,
        purchased_by INTEGER,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (buddy_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (purchased_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_hash TEXT UNIQUE,
        from_wallet TEXT NOT NULL,
        to_wallet TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL CHECK(amount > 0),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('reward', 'purchase')),
        related_entity_id INTEGER,
        related_entity_type TEXT CHECK(related_entity_type IN ('corgi_sighting', 'wish')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    )
  `);

  // Bank wallet table (singleton)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_wallet (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        wallet_address TEXT NOT NULL,
        current_balance DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(current_balance >= 0),
        total_distributed DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(total_distributed >= 0),
        last_transaction_hash TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_buddy_pairs_users ON buddy_pairs(user1_id, user2_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_corgi_sightings_reporter ON corgi_sightings(reporter_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_corgi_sightings_buddy ON corgi_sightings(buddy_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wishes_creator ON wishes(creator_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_entity_type, related_entity_id)`);

  // Create triggers for updated_at fields
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        BEGIN
            UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_bank_wallet_timestamp
        AFTER UPDATE ON bank_wallet
        BEGIN
            UPDATE bank_wallet SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
  `);

  console.log('✅ Database migration completed successfully');
  console.log('Tables created: users, buddy_pairs, corgi_sightings, wishes, transactions, bank_wallet');
} catch (error) {
  console.error('❌ Database migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}