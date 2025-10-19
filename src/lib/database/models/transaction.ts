/**
 * Transaction Model & Database Service
 *
 * Represents a Corgi coin Jetton transfer from the bank wallet to a user wallet
 * on the TON blockchain, with CRUD operations for database management.
 */

import { getDatabase } from '@/lib/database';

export interface Transaction {
  id: number;
  from_wallet: string; // Bank wallet TON address
  to_wallet: string; // User wallet TON address
  amount: bigint; // Jetton amount in smallest units (amount × 10^decimals)
  status: 'pending' | 'broadcasting' | 'completed' | 'failed';
  transaction_hash: string | null; // TON blockchain transaction hash (BOC hash)
  sighting_id: number; // Reference to originating corgi sighting
  created_at: Date;
  broadcast_at: Date | null; // When transaction was sent to blockchain
  confirmed_at: Date | null; // When blockchain confirmed the transaction
  retry_count: number; // Number of retry attempts made
  last_retry_at: Date | null; // Timestamp of last retry attempt
  last_error: string | null; // Error message from last failed attempt
  failure_reason: string | null; // Detailed reason for permanent failure
}

export interface CreateTransactionInput {
  from_wallet: string;
  to_wallet: string;
  amount: bigint;
  sighting_id: number;
}

export interface UpdateTransactionStatusInput {
  id: number;
  status: Transaction['status'];
  transaction_hash?: string;
  broadcast_at?: Date;
  confirmed_at?: Date;
  failure_reason?: string;
  last_error?: string;
  retry_count?: number;
  last_retry_at?: Date;
}

/**
 * Transaction Status State Machine
 *
 * pending (created)
 *   ↓
 * broadcasting (sent to blockchain)
 *   ↓ (on success)
 * completed (blockchain confirmed with exit_code = 0)
 *
 *   ↓ (on error)
 * failed (error or max retries exceeded)
 */
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  BROADCASTING: 'broadcasting',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUSES)[keyof typeof TRANSACTION_STATUSES];

/**
 * Convert database row to Transaction object
 */
function rowToTransaction(row: any): Transaction {
  return {
    ...row,
    amount: BigInt(row.amount),
    created_at: new Date(row.created_at),
    broadcast_at: row.broadcast_at ? new Date(row.broadcast_at) : null,
    confirmed_at: row.confirmed_at ? new Date(row.confirmed_at) : null,
    last_retry_at: row.last_retry_at ? new Date(row.last_retry_at) : null,
  };
}

/**
 * Create a new transaction record
 */
export function createTransaction(input: CreateTransactionInput): Transaction {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO transactions (from_wallet, to_wallet, amount, status, sighting_id)
    VALUES (?, ?, ?, 'pending', ?)
  `);

  const result = stmt.run(
    input.from_wallet,
    input.to_wallet,
    input.amount.toString(),
    input.sighting_id
  );

  const id = result.lastInsertRowid as number;

  const transaction = getTransactionById(id);
  if (!transaction) {
    throw new Error('Failed to retrieve created transaction');
  }

  return transaction;
}

/**
 * Get transaction by ID
 */
export function getTransactionById(id: number): Transaction | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
  const row = stmt.get(id);

  return row ? rowToTransaction(row) : null;
}

/**
 * Get transaction by sighting ID
 * (used to prevent duplicate transactions for the same sighting)
 */
export function getTransactionBySightingId(
  sightingId: number
): Transaction | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM transactions WHERE sighting_id = ?');
  const row = stmt.get(sightingId);

  return row ? rowToTransaction(row) : null;
}

/**
 * Get all transactions for a specific user wallet
 */
export function getUserTransactions(
  toWallet: string,
  limit = 50,
  offset = 0
): Transaction[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM transactions
    WHERE to_wallet = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(toWallet, limit, offset);

  return rows.map(rowToTransaction);
}

/**
 * Get pending transactions (for polling/monitoring)
 */
export function getPendingTransactions(limit = 100): Transaction[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM transactions
    WHERE status IN ('pending', 'broadcasting')
      AND created_at > datetime('now', '-1 day')
    ORDER BY created_at ASC
    LIMIT ?
  `);

  const rows = stmt.all(limit);

  return rows.map(rowToTransaction);
}

/**
 * Get failed transactions that can be retried
 */
export function getFailedTransactionsForRetry(limit = 10): Transaction[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT * FROM transactions
    WHERE status = 'failed'
      AND retry_count < 3
      AND (
        last_retry_at IS NULL
        OR last_retry_at < datetime('now', '-' || pow(2, retry_count) || ' seconds')
      )
    ORDER BY retry_count ASC, last_retry_at ASC
    LIMIT ?
  `);

  const rows = stmt.all(limit);

  return rows.map(rowToTransaction);
}

/**
 * Update transaction status and related fields
 */
export function updateTransactionStatus(
  input: UpdateTransactionStatusInput
): Transaction {
  const db = getDatabase();

  const fields: string[] = ['status = ?'];
  const values: any[] = [input.status];

  if (input.transaction_hash !== undefined) {
    fields.push('transaction_hash = ?');
    values.push(input.transaction_hash);
  }

  if (input.broadcast_at !== undefined) {
    fields.push('broadcast_at = ?');
    values.push(input.broadcast_at.toISOString());
  }

  if (input.confirmed_at !== undefined) {
    fields.push('confirmed_at = ?');
    values.push(input.confirmed_at.toISOString());
  }

  if (input.failure_reason !== undefined) {
    fields.push('failure_reason = ?');
    values.push(input.failure_reason);
  }

  if (input.last_error !== undefined) {
    fields.push('last_error = ?');
    values.push(input.last_error);
  }

  if (input.retry_count !== undefined) {
    fields.push('retry_count = ?');
    values.push(input.retry_count);
  }

  if (input.last_retry_at !== undefined) {
    fields.push('last_retry_at = ?');
    values.push(input.last_retry_at.toISOString());
  }

  values.push(input.id);

  const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);

  stmt.run(...values);

  const transaction = getTransactionById(input.id);
  if (!transaction) {
    throw new Error('Failed to retrieve updated transaction');
  }

  return transaction;
}
