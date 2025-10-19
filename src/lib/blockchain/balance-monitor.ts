/**
 * Bank Wallet Balance Monitor
 *
 * Monitors the bank wallet's TON balance (for gas) and Jetton balance (for rewards).
 * Provides alerts when balances fall below configured thresholds.
 */

import { Address, fromNano } from '@ton/core';
import { tonClientManager } from './ton-client';
import { getJettonBalance, getBankJettonWalletAddress } from './jetton-wallet';

export interface BalanceCheckResult {
  tonBalance: bigint;
  jettonBalance: bigint;
  tonBalanceOK: boolean;
  jettonBalanceOK: boolean;
  alerts: BalanceAlert[];
}

export interface BalanceAlert {
  type: 'low_ton_balance' | 'low_jetton_balance' | 'critical_balance';
  severity: 'warning' | 'critical';
  message: string;
  currentBalance: string;
  threshold: string;
}

/**
 * Check bank wallet balances against configured thresholds
 *
 * Verifies:
 * 1. TON balance (for paying gas fees)
 * 2. Jetton balance (for distributing rewards)
 *
 * @param jettonMasterAddress - Corgi coin Jetton master contract address
 * @returns Balance check result with alerts if thresholds exceeded
 */
export async function checkBankBalances(
  jettonMasterAddress: string
): Promise<BalanceCheckResult> {
  const alerts: BalanceAlert[] = [];

  try {
    const client = tonClientManager.getClient();
    const bankAddress = tonClientManager.getBankWalletAddress();

    // Get configured thresholds from environment
    const tonMinBalance = BigInt(
      process.env.CORGI_BANK_TON_MIN_BALANCE || '1000000000'
    ); // Default: 1 TON
    const jettonMinBalance = BigInt(
      process.env.CORGI_BANK_JETTON_MIN_BALANCE || '1000000000000'
    ); // Default: 1000 tokens (with 9 decimals)

    // Check TON balance
    const tonBalance = await client.getBalance(Address.parse(bankAddress));

    const tonBalanceOK = tonBalance >= tonMinBalance;

    if (!tonBalanceOK) {
      const severity =
        tonBalance < tonMinBalance / BigInt(2) ? 'critical' : 'warning';

      alerts.push({
        type:
          tonBalance < tonMinBalance / BigInt(2)
            ? 'critical_balance'
            : 'low_ton_balance',
        severity,
        message: `Bank wallet TON balance is below threshold (needed for gas fees)`,
        currentBalance: `${fromNano(tonBalance)} TON`,
        threshold: `${fromNano(tonMinBalance)} TON`,
      });
    }

    // Check Jetton balance
    const bankJettonWallet =
      await getBankJettonWalletAddress(jettonMasterAddress);
    const jettonBalance = await getJettonBalance(bankJettonWallet);

    const jettonBalanceOK = jettonBalance >= jettonMinBalance;

    if (!jettonBalanceOK) {
      const jettonDecimals = parseInt(process.env.JETTON_DECIMALS || '9', 10);
      const formatJettons = (amount: bigint) =>
        (Number(amount) / 10 ** jettonDecimals).toFixed(2);

      const severity =
        jettonBalance < jettonMinBalance / BigInt(2) ? 'critical' : 'warning';

      alerts.push({
        type:
          jettonBalance < jettonMinBalance / BigInt(2)
            ? 'critical_balance'
            : 'low_jetton_balance',
        severity,
        message: `Bank wallet Jetton balance is below threshold (needed for reward distribution)`,
        currentBalance: `${formatJettons(jettonBalance)} Corgi coins`,
        threshold: `${formatJettons(jettonMinBalance)} Corgi coins`,
      });
    }

    console.log(
      `[Balance] Bank wallet balances - TON: ${fromNano(tonBalance)}, Jettons: ${jettonBalance}`
    );

    if (alerts.length > 0) {
      console.warn(
        `[Balance] Balance alerts: ${alerts.length} issue(s) detected`
      );
      alerts.forEach((alert) => {
        console.warn(
          `[Balance] ${alert.severity.toUpperCase()}: ${alert.message} (${alert.currentBalance} / ${alert.threshold})`
        );
      });
    }

    return {
      tonBalance,
      jettonBalance,
      tonBalanceOK,
      jettonBalanceOK,
      alerts,
    };
  } catch (error) {
    console.error('[Balance] Failed to check bank balances:', error);

    // Return error state with critical alert
    alerts.push({
      type: 'critical_balance',
      severity: 'critical',
      message: `Failed to check bank wallet balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentBalance: 'Unknown',
      threshold: 'N/A',
    });

    return {
      tonBalance: BigInt(0),
      jettonBalance: BigInt(0),
      tonBalanceOK: false,
      jettonBalanceOK: false,
      alerts,
    };
  }
}

/**
 * Verify sufficient balance for a specific transfer
 *
 * @param jettonMasterAddress - Jetton master contract address
 * @param transferAmount - Amount of Jettons to transfer
 * @param gasAmount - Amount of TON needed for gas (default: 0.05 TON)
 * @returns True if sufficient balance, false otherwise
 */
export async function canAffordTransfer(
  jettonMasterAddress: string,
  transferAmount: bigint,
  gasAmount: bigint = BigInt('50000000') // 0.05 TON default
): Promise<{ canAfford: boolean; reason?: string }> {
  try {
    const balances = await checkBankBalances(jettonMasterAddress);

    // Check if we have enough TON for gas
    if (balances.tonBalance < gasAmount) {
      return {
        canAfford: false,
        reason: `Insufficient TON for gas (need ${fromNano(gasAmount)} TON, have ${fromNano(balances.tonBalance)} TON)`,
      };
    }

    // Check if we have enough Jettons for the transfer
    if (balances.jettonBalance < transferAmount) {
      const jettonDecimals = parseInt(process.env.JETTON_DECIMALS || '9', 10);
      const formatJettons = (amount: bigint) =>
        (Number(amount) / 10 ** jettonDecimals).toFixed(2);

      return {
        canAfford: false,
        reason: `Insufficient Jettons (need ${formatJettons(transferAmount)} Corgi coins, have ${formatJettons(balances.jettonBalance)} Corgi coins)`,
      };
    }

    return { canAfford: true };
  } catch (error) {
    return {
      canAfford: false,
      reason: `Failed to check balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
