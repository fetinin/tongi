/**
 * Pending Reward Model
 *
 * Tracks rewards awaiting wallet connection for users who haven't connected
 * a TON wallet yet. When a buddy confirms a sighting for a user without a wallet,
 * a PendingReward record is created instead of immediately creating a Transaction.
 * Once the user connects a wallet, all pending rewards are processed into Transactions.
 */

export interface PendingReward {
  id: number;
  user_id: number;
  sighting_id: number;
  amount: bigint; // Jetton amount in smallest units (amount × 10^decimals)
  status: 'pending' | 'processed' | 'cancelled';
  created_at: Date;
  processed_at: Date | null; // When reward was distributed or cancelled
  transaction_id: number | null; // Reference to created transaction (when processed)
}

export interface CreatePendingRewardInput {
  user_id: number;
  sighting_id: number;
  amount: bigint;
}

export interface ProcessPendingRewardInput {
  id: number;
  transaction_id: number;
  processed_at: Date;
}

/**
 * Pending Reward Status State Machine
 *
 * pending (created when user has no wallet)
 *   ↓ (on wallet connection)
 * processed (transaction created and broadcast)
 *
 *   ↓ (if cancelled, rare)
 * cancelled (reward cancelled manually)
 */
export const PENDING_REWARD_STATUSES = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  CANCELLED: 'cancelled',
} as const;

export type PendingRewardStatus =
  (typeof PENDING_REWARD_STATUSES)[keyof typeof PENDING_REWARD_STATUSES];
