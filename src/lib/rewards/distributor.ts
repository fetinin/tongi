/**
 * Reward Distributor Orchestration Module
 *
 * Orchestrates the complete flow of distributing Jetton rewards to users:
 * 1. Validate user wallet
 * 2. Calculate reward amount
 * 3. Check bank balances
 * 4. Create transaction record
 * 5. Broadcast Jetton transfer
 * 6. Handle errors with retry logic
 */

import { tonClientManager } from '@/lib/blockchain/ton-client';
import {
  getJettonWalletAddress,
  getBankJettonWalletAddress,
} from '@/lib/blockchain/jetton-wallet';
import { broadcastJettonTransfer } from '@/lib/blockchain/jetton-transfer';
import { canAffordTransfer } from '@/lib/blockchain/balance-monitor';
import { calculateRewardAmount } from './calculator';
import { classifyError } from './error-classifier';
import {
  createTransaction,
  getTransactionBySightingId,
  updateTransactionStatus,
} from '@/lib/database/models/transaction';
import type { Transaction } from '@/lib/database/models/transaction';

export interface DistributeRewardInput {
  sightingId: number;
  userWalletAddress: string;
  corgiCount: number;
}

/**
 * Error thrown when reward distribution fails
 */
export class RewardDistributionError extends Error {
  constructor(
    message: string,
    public shouldRetry: boolean,
    public transaction?: Transaction
  ) {
    super(message);
    this.name = 'RewardDistributionError';
  }
}

/**
 * Main reward distribution orchestration
 *
 * Coordinates the complete flow from sighting confirmation to Jetton transfer.
 * Throws RewardDistributionError on failure instead of returning error result.
 *
 * @param input Reward distribution parameters
 * @returns Transaction record on success
 * @throws RewardDistributionError on failure with retry classification
 */

export async function distributeReward(
  input: DistributeRewardInput
): Promise<Transaction> {
  const { sightingId, userWalletAddress, corgiCount } = input;

  try {
    // Step 1: Check if transaction already exists for this sighting (idempotency)
    const existingTransaction = getTransactionBySightingId(sightingId);
    if (existingTransaction) {
      if (existingTransaction.status === 'completed') {
        // Already successfully processed
        return existingTransaction;
      } else if (existingTransaction.status === 'failed') {
        // Previously failed - throw error to indicate failure
        throw new RewardDistributionError(
          existingTransaction.failure_reason || 'Transaction previously failed',
          false, // Don't retry - need manual intervention
          existingTransaction
        );
      }
      // Status is 'broadcasting' - return existing transaction
      return existingTransaction;
    }

    // Step 2: Calculate reward amount
    const rewardAmount = calculateRewardAmount(corgiCount);

    // Step 3: Get Jetton master address from env
    const jettonMasterAddress = process.env.JETTON_MASTER_ADDRESS;
    if (!jettonMasterAddress) {
      throw new Error('JETTON_MASTER_ADDRESS not configured');
    }

    // Step 4: Check bank balances before proceeding
    const affordability = await canAffordTransfer(
      jettonMasterAddress,
      rewardAmount
    );

    if (!affordability.canAfford) {
      console.error(
        `[Distributor] Insufficient bank balance: ${affordability.reason}`
      );

      // Create transaction in failed state
      const transaction = createTransaction({
        from_wallet: await tonClientManager.getBankWalletAddress(),
        to_wallet: userWalletAddress,
        amount: rewardAmount,
        sighting_id: sightingId,
      });

      updateTransactionStatus({
        id: transaction.id,
        status: 'failed',
        failure_reason: `Insufficient bank balance: ${affordability.reason}`,
        last_error: affordability.reason,
      });

      throw new RewardDistributionError(
        affordability.reason || 'Insufficient bank balance',
        false, // Not retryable - need to fund bank wallet
        transaction
      );
    }

    // Step 5: Get user's Jetton wallet address and bank's Jetton wallet address
    const userJettonWallet = await getJettonWalletAddress(
      jettonMasterAddress,
      userWalletAddress
    );

    const bankJettonWallet =
      await getBankJettonWalletAddress(jettonMasterAddress);

    // Step 6: Create transaction record
    const transaction = createTransaction({
      from_wallet: await tonClientManager.getBankWalletAddress(),
      to_wallet: userWalletAddress,
      amount: rewardAmount,
      sighting_id: sightingId,
    });

    // Step 7: Broadcast Jetton transfer
    try {
      const broadcastResult = await broadcastJettonTransfer({
        masterAddress: jettonMasterAddress,
        senderJettonWallet: bankJettonWallet,
        destination: userWalletAddress,
        amount: rewardAmount,
        queryId: transaction.id, // Use transaction ID as query ID for tracking
      });

      // Update transaction to broadcasting status
      const updatedTransaction = updateTransactionStatus({
        id: transaction.id,
        status: 'broadcasting',
        transaction_hash: broadcastResult.transactionHash,
        broadcast_at: broadcastResult.timestamp,
      });

      return updatedTransaction;
    } catch (broadcastError) {
      console.error(
        `[Distributor] Broadcast failed for transaction ${transaction.id}:`,
        broadcastError
      );

      // Classify error to determine if retryable
      const classified = classifyError(broadcastError);

      // Update transaction with error details
      updateTransactionStatus({
        id: transaction.id,
        status: 'failed',
        last_error: classified.message,
        failure_reason: classified.message,
        retry_count: 0,
        last_retry_at: new Date(),
      });

      throw new RewardDistributionError(
        classified.message,
        classified.classification === 'retryable',
        transaction
      );
    }
  } catch (error) {
    console.error(`[Distributor] Fatal error distributing reward:`, error);

    // Re-throw RewardDistributionError as-is
    if (error instanceof RewardDistributionError) {
      throw error;
    }

    // Wrap other errors
    throw new RewardDistributionError(
      error instanceof Error ? error.message : 'Unknown error',
      false // Unknown errors are not retryable by default
    );
  }
}
