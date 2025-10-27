import type Database from 'better-sqlite3';

/**
 * Run database migrations to create all tables, indexes, and triggers.
 * This function is shared between application migrations and test setup.
 *
 * @param db - The database instance (can be file-based or in-memory)
 */
export function runMigrations(db: Database.Database): void {
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

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

  // Corgi sightings table (with reward tracking fields)
  db.exec(`
    CREATE TABLE IF NOT EXISTS corgi_sightings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        buddy_id INTEGER NOT NULL,
        corgi_count INTEGER NOT NULL CHECK(corgi_count > 0 AND corgi_count <= 100),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'denied')),
        reward_status TEXT CHECK(reward_status IN ('not_applicable', 'pending', 'distributed', 'failed')),
        reward_distributed_at DATETIME,
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

  // Transactions table (matches test schema with all reward distribution fields)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_wallet TEXT NOT NULL,
      to_wallet TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL CHECK(status IN ('pending', 'broadcasting', 'completed', 'failed')),
      transaction_hash TEXT NULL UNIQUE,
      transaction_type TEXT NOT NULL DEFAULT 'reward' CHECK(transaction_type IN ('reward', 'purchase')),
      related_entity_id INTEGER NULL,
      related_entity_type TEXT NULL CHECK(related_entity_type IN ('corgi_sighting', 'wish')),
      sighting_id INTEGER NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      broadcast_at DATETIME NULL,
      confirmed_at DATETIME NULL,
      completed_at DATETIME NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_retry_at DATETIME NULL,
      last_error TEXT NULL,
      failure_reason TEXT NULL,
      CHECK(from_wallet != to_wallet),
      CHECK(broadcast_at IS NULL OR broadcast_at >= created_at),
      CHECK(confirmed_at IS NULL OR confirmed_at >= broadcast_at),
      CHECK(completed_at IS NULL OR completed_at >= created_at)
    )
  `);

  // Pending rewards table (for users without wallets)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sighting_id INTEGER NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL CHECK(status IN ('pending', 'processed', 'cancelled')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      transaction_id INTEGER NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (sighting_id) REFERENCES corgi_sightings(id) ON DELETE RESTRICT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT,
      CHECK(status != 'pending' OR transaction_id IS NULL),
      CHECK(status != 'processed' OR transaction_id IS NOT NULL)
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

  // Add UNIQUE constraint to ton_wallet_address (onboarding requirement - automatic wallet unlinking)
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ton_wallet_unique ON users(ton_wallet_address) WHERE ton_wallet_address IS NOT NULL`
  );

  // Create indexes for performance
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_buddy_pairs_users ON buddy_pairs(user1_id, user2_id)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_corgi_sightings_reporter ON corgi_sightings(reporter_id)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_corgi_sightings_buddy ON corgi_sightings(buddy_id)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_wishes_creator ON wishes(creator_id)`
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_transactions_hash_status ON transactions(transaction_hash, status) WHERE transaction_hash IS NOT NULL`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_transactions_sighting ON transactions(sighting_id)`
  );
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_rewards_sighting_pending ON pending_rewards(sighting_id) WHERE status = 'pending'`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_pending_rewards_user_status ON pending_rewards(user_id, status)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_pending_rewards_sighting ON pending_rewards(sighting_id)`
  );

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
}
