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
import {
  broadcastJettonTransfer,
  checkSeqnoChanged,
} from '@/lib/blockchain/jetton-transfer';
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

export interface DistributeRewardResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  shouldRetry?: boolean;
}

/**
 * Main reward distribution orchestration
 *
 * Coordinates the complete flow from sighting confirmation to Jetton transfer.
 * Handles both happy path and error scenarios with proper retry classification.
 *
 * @param input Reward distribution parameters
 * @returns Result with transaction details or error
 */

export async function distributeReward(
  input: DistributeRewardInput
): Promise<DistributeRewardResult> {
  const { sightingId, userWalletAddress, corgiCount } = input;

  try {
    // Step 1: Check if transaction already exists for this sighting (idempotency)
    const existingTransaction = getTransactionBySightingId(sightingId);
    if (existingTransaction) {
      console.log(
        `[Distributor] Transaction already exists for sighting ${sightingId} (tx ${existingTransaction.id})`
      );
      return {
        success: existingTransaction.status === 'completed',
        transaction: existingTransaction,
        error:
          existingTransaction.status === 'failed'
            ? 'Transaction previously failed'
            : undefined,
      };
    }

    // Step 2: Calculate reward amount
    const rewardAmount = calculateRewardAmount(corgiCount);
    console.log(
      `[Distributor] Calculated reward: ${rewardAmount} smallest units for ${corgiCount} corgis`
    );

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
        from_wallet: tonClientManager.getBankWalletAddress(),
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

      return {
        success: false,
        error: affordability.reason,
        shouldRetry: false,
      };
    }

    // Step 5: Get user's Jetton wallet address and bank's Jetton wallet address
    const userJettonWallet = await getJettonWalletAddress(
      jettonMasterAddress,
      userWalletAddress
    );

    const bankJettonWallet =
      await getBankJettonWalletAddress(jettonMasterAddress);

    console.log(
      `[Distributor] Jetton wallets - Bank: ${bankJettonWallet}, User: ${userJettonWallet.jettonWalletAddress}`
    );

    // Step 6: Create transaction record
    const transaction = createTransaction({
      from_wallet: tonClientManager.getBankWalletAddress(),
      to_wallet: userWalletAddress,
      amount: rewardAmount,
      sighting_id: sightingId,
    });

    console.log(
      `[Distributor] Created transaction record ${transaction.id} for sighting ${sightingId}`
    );

    // Step 7: Broadcast Jetton transfer
    try {
      const broadcastResult = await broadcastJettonTransfer({
        masterAddress: jettonMasterAddress,
        senderJettonWallet: bankJettonWallet,
        destination: userWalletAddress,
        amount: rewardAmount,
        queryId: transaction.id, // Use transaction ID as query ID for tracking
      });

      console.log(
        `[Distributor] Broadcast successful - seqno: ${broadcastResult.seqNo}`
      );

      // Update transaction to broadcasting status
      const updatedTransaction = updateTransactionStatus({
        id: transaction.id,
        status: 'broadcasting',
        transaction_hash: broadcastResult.transactionHash,
        broadcast_at: broadcastResult.timestamp,
      });

      return {
        success: true,
        transaction: updatedTransaction,
      };
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

      return {
        success: false,
        transaction,
        error: classified.message,
        shouldRetry: classified.classification === 'retryable',
      };
    }
  } catch (error) {
    console.error(`[Distributor] Fatal error distributing reward:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      shouldRetry: false,
    };
  }
}

/**
 * Retry a failed transaction with exponential backoff
 *
 * This function is called by T025 retry handler.
 * It checks seqno changes before retrying to detect successful broadcasts
 * despite error responses.
 *
 * @param transaction The failed transaction to retry
 * @returns Result of retry attempt
 */
export async function retryFailedTransaction(
  transaction: Transaction
): Promise<DistributeRewardResult> {
  const { id, sighting_id, to_wallet, amount, retry_count } = transaction;

  try {
    console.log(
      `[Distributor] Retrying transaction ${id} (attempt ${retry_count + 1}/3)`
    );

    // Step 1: Check if seqno changed since last attempt
    // This detects if previous broadcast actually succeeded despite error
    if (transaction.transaction_hash) {
      const parsedSeqno = parseInt(
        transaction.transaction_hash.split('-')[2],
        10
      );

      if (!isNaN(parsedSeqno)) {
        const seqnoCheck = await checkSeqnoChanged(parsedSeqno);

        if (seqnoCheck.hasChanged) {
          console.log(
            `[Distributor] Seqno changed from ${parsedSeqno} to ${seqnoCheck.currentSeqno}. Transaction may have succeeded.`
          );

          // Mark as broadcasting and let monitoring confirm
          const updatedTransaction = updateTransactionStatus({
            id,
            status: 'broadcasting',
          });

          return {
            success: true,
            transaction: updatedTransaction,
          };
        }
      }
    }

    // Step 2: Check balances again before retry
    const jettonMasterAddress = process.env.JETTON_MASTER_ADDRESS;
    if (!jettonMasterAddress) {
      throw new Error('JETTON_MASTER_ADDRESS not configured');
    }

    const affordability = await canAffordTransfer(jettonMasterAddress, amount);

    if (!affordability.canAfford) {
      console.error(
        `[Distributor] Cannot retry - insufficient balance: ${affordability.reason}`
      );

      updateTransactionStatus({
        id,
        status: 'failed',
        failure_reason: `Cannot retry - ${affordability.reason}`,
        retry_count: retry_count + 1,
        last_retry_at: new Date(),
      });

      return {
        success: false,
        error: affordability.reason,
        shouldRetry: false,
      };
    }

    // Step 3: Get Jetton wallet addresses
    const userJettonWallet = await getJettonWalletAddress(
      jettonMasterAddress,
      to_wallet
    );

    const bankJettonWallet =
      await getBankJettonWalletAddress(jettonMasterAddress);

    // Step 4: Retry broadcast
    const broadcastResult = await broadcastJettonTransfer({
      masterAddress: jettonMasterAddress,
      senderJettonWallet: bankJettonWallet,
      destination: to_wallet,
      amount,
      queryId: id,
    });

    console.log(
      `[Distributor] Retry successful - seqno: ${broadcastResult.seqNo}`
    );

    // Update transaction
    const updatedTransaction = updateTransactionStatus({
      id,
      status: 'broadcasting',
      transaction_hash: broadcastResult.transactionHash,
      broadcast_at: broadcastResult.timestamp,
      retry_count: retry_count + 1,
      last_retry_at: new Date(),
    });

    return {
      success: true,
      transaction: updatedTransaction,
    };
  } catch (error) {
    console.error(`[Distributor] Retry failed for transaction ${id}:`, error);

    // Classify error
    const classified = classifyError(error);

    // Determine if we should retry again (max 3 attempts)
    const shouldRetryAgain =
      classified.classification === 'retryable' && retry_count < 2;

    // Update transaction
    updateTransactionStatus({
      id,
      status: shouldRetryAgain ? 'failed' : 'failed',
      last_error: classified.message,
      failure_reason: shouldRetryAgain
        ? undefined
        : `Failed after ${retry_count + 1} attempts: ${classified.message}`,
      retry_count: retry_count + 1,
      last_retry_at: new Date(),
    });

    return {
      success: false,
      error: classified.message,
      shouldRetry: shouldRetryAgain,
    };
  }
}
