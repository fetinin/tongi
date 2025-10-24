import path from 'path';
import type DatabaseConstructor from 'better-sqlite3';

// Conditional import to avoid loading better-sqlite3 during build phase
let Database: typeof DatabaseConstructor | null = null;
let db: DatabaseConstructor.Database | null = null;

function loadDatabase(): typeof DatabaseConstructor {
  if (!Database) {
    // Skip loading better-sqlite3 during Next.js build phase
    // Return a mock constructor that won't be used at build time
    if (process.env.SKIP_DB_INIT === 'true') {
      // Create a mock constructor that satisfies TypeScript but won't execute
      Database = class MockDatabase {} as any;
      return Database as typeof DatabaseConstructor;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require('better-sqlite3');
  }
  // At this point Database is guaranteed to be non-null
  return Database as typeof DatabaseConstructor;
}

export function getDatabase(): DatabaseConstructor.Database {
  // During build phase, return a mock database object
  if (process.env.SKIP_DB_INIT === 'true') {
    // Return a mock with minimal functionality for build-time static analysis
    // This mock will never be used at runtime, only during Next.js build
    const mockStatement = {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => null,
      all: () => [],
      iterate: function* () {},
      pluck: () => mockStatement,
      expand: () => mockStatement,
      raw: () => mockStatement,
      columns: () => [],
      bind: () => mockStatement,
    };

    const mockDb = {
      prepare: () => mockStatement,
      pragma: () => null,
      transaction: (fn: unknown) => fn,
      exec: () => null,
      close: () => null,
      loadExtension: () => null,
      serialize: () => Buffer.from(''),
      function: () => null,
      aggregate: () => null,
      backup: () => ({ close: () => null }),
      defaultSafeIntegers: () => mockDb,
      unsafeMode: () => mockDb,
    };

    return mockDb as any;
  }

  const Db = loadDatabase();

  if (!db) {
    // Use in-memory database for tests, otherwise use file-based
    const isTest = process.env.NODE_ENV === 'test';
    const dbPath = isTest
      ? ':memory:'
      : path.join(process.cwd(), 'data', 'app.db');

    db = new Db(dbPath);

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    // Set journal mode to WAL for better concurrency (skip for in-memory)
    if (!isTest) {
      db.pragma('journal_mode = WAL');
    }

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

/**
 * Reset database connection (useful for tests)
 * Forces recreation of database on next getDatabase() call
 */
export function resetDatabase(): void {
  closeDatabase();
}

// Helper function to handle database transactions
export function withTransaction<T>(
  callback: (db: DatabaseConstructor.Database) => T
): T {
  const database = getDatabase();
  const transaction = database.transaction(callback);
  return transaction(database);
}

// Helper function for prepared statements
export function prepare(sql: string): DatabaseConstructor.Statement {
  return getDatabase().prepare(sql);
}

// Clean shutdown handler
if (process.env.NODE_ENV !== 'test') {
  process.on('exit', closeDatabase);
  process.on('SIGINT', () => {
    closeDatabase();
  });
  process.on('SIGTERM', () => {
    closeDatabase();
  });
}
