import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'app.db');
    db = new Database(dbPath);

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    // Set journal mode to WAL for better concurrency
    db.pragma('journal_mode = WAL');

    // Optimize for performance
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = memory');
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper function to handle database transactions
export function withTransaction<T>(
  callback: (db: Database.Database) => T
): T {
  const database = getDatabase();
  const transaction = database.transaction(callback);
  return transaction(database);
}

// Helper function for prepared statements
export function prepare(sql: string): Database.Statement {
  return getDatabase().prepare(sql);
}

// Clean shutdown handler
if (process.env.NODE_ENV !== 'test') {
  process.on('exit', closeDatabase);
  process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
  });
}