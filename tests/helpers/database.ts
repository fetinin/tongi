import { getDatabase } from '@/lib/database';

/**
 * Clear all data from database tables (useful for test cleanup)
 */
export function clearDatabase(): void {
  const db = getDatabase();

  // Delete in order to respect foreign key constraints
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM wishes');
  db.exec('DELETE FROM corgi_sightings');
  db.exec('DELETE FROM buddy_pairs');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM bank_wallet');
}

/**
 * Get count of records in a table
 */
export function getTableCount(tableName: string): number {
  const db = getDatabase();
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
    .get() as { count: number };
  return result.count;
}

/**
 * Check if a user exists in the database
 */
export function userExists(userId: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE id = ?')
    .get(userId) as { count: number };
  return result.count > 0;
}

/**
 * Initialize bank wallet for testing
 */
export function initializeBankWallet(
  walletAddress: string,
  initialBalance = 10000
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT OR REPLACE INTO bank_wallet (id, wallet_address, current_balance, total_distributed)
     VALUES (1, ?, ?, 0)`
  ).run(walletAddress, initialBalance);
}
