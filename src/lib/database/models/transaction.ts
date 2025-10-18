/**
 * Transaction Model
 *
 * Represents a Corgi coin Jetton transfer from the bank wallet to a user wallet
 * on the TON blockchain.
 */

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
