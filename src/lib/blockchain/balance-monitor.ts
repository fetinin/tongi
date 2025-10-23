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

interface BalanceThresholds {
  tonMinBalance: bigint;
  jettonMinBalance: bigint;
}

/**
 * Get balance thresholds from environment variables
 */
function getBalanceThresholds(): BalanceThresholds {
  const tonMinBalance = BigInt(
    process.env.CORGI_BANK_TON_MIN_BALANCE || '1000000000'
  ); // Default: 1 TON
  const jettonMinBalance = BigInt(
    process.env.CORGI_BANK_JETTON_MIN_BALANCE || '1000000000000'
  ); // Default: 1000 tokens (with 9 decimals)

  return { tonMinBalance, jettonMinBalance };
}

/**
 * Check TON balance and generate alerts if below threshold
 */
async function checkTonBalance(
  client: any,
  bankAddress: string,
  tonMinBalance: bigint
): Promise<{
  tonBalance: bigint;
  tonBalanceOK: boolean;
  alerts: BalanceAlert[];
}> {
  const alerts: BalanceAlert[] = [];

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

  return { tonBalance, tonBalanceOK, alerts };
}

/**
 * Check Jetton balance and generate alerts if below threshold
 */
async function checkJettonBalance(
  jettonMasterAddress: string,
  jettonMinBalance: bigint
): Promise<{
  jettonBalance: bigint;
  jettonBalanceOK: boolean;
  alerts: BalanceAlert[];
}> {
  const alerts: BalanceAlert[] = [];

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

  return { jettonBalance, jettonBalanceOK, alerts };
}

/**
 * Log balance alerts to console
 */
function logBalanceAlerts(alerts: BalanceAlert[]): void {
  if (alerts.length === 0) {
    return;
  }

  console.warn(`[Balance] Balance alerts: ${alerts.length} issue(s) detected`);
  alerts.forEach((alert) => {
    console.warn(
      `[Balance] ${alert.severity.toUpperCase()}: ${alert.message} (${alert.currentBalance} / ${alert.threshold})`
    );
  });
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
  const allAlerts: BalanceAlert[] = [];

  // Get thresholds from environment
  const { tonMinBalance, jettonMinBalance } = getBalanceThresholds();

  // Get client and bank address
  let client: any;
  let bankAddress: string;
  try {
    client = await tonClientManager.getClient();
    bankAddress = await tonClientManager.getBankWalletAddress();
  } catch (error) {
    console.error(
      '[Balance] Failed to initialize TON client or get bank address:',
      error
    );
    allAlerts.push({
      type: 'critical_balance',
      severity: 'critical',
      message: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentBalance: 'Unknown',
      threshold: 'N/A',
    });

    return {
      tonBalance: BigInt(0),
      jettonBalance: BigInt(0),
      tonBalanceOK: false,
      jettonBalanceOK: false,
      alerts: allAlerts,
    };
  }

  // Check TON balance
  let tonBalance: bigint;
  let tonBalanceOK: boolean;
  try {
    const tonResult = await checkTonBalance(client, bankAddress, tonMinBalance);
    tonBalance = tonResult.tonBalance;
    tonBalanceOK = tonResult.tonBalanceOK;
    allAlerts.push(...tonResult.alerts);
  } catch (error) {
    console.error('[Balance] Failed to check TON balance:', error);
    allAlerts.push({
      type: 'critical_balance',
      severity: 'critical',
      message: `Failed to check TON balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentBalance: 'Unknown',
      threshold: 'N/A',
    });
    tonBalance = BigInt(0);
    tonBalanceOK = false;
  }

  // Check Jetton balance
  let jettonBalance: bigint;
  let jettonBalanceOK: boolean;
  try {
    const jettonResult = await checkJettonBalance(
      jettonMasterAddress,
      jettonMinBalance
    );
    jettonBalance = jettonResult.jettonBalance;
    jettonBalanceOK = jettonResult.jettonBalanceOK;
    allAlerts.push(...jettonResult.alerts);
  } catch (error) {
    console.error('[Balance] Failed to check Jetton balance:', error);
    allAlerts.push({
      type: 'critical_balance',
      severity: 'critical',
      message: `Failed to check Jetton balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      currentBalance: 'Unknown',
      threshold: 'N/A',
    });
    jettonBalance = BigInt(0);
    jettonBalanceOK = false;
  }

  // Log alerts
  logBalanceAlerts(allAlerts);

  return {
    tonBalance,
    jettonBalance,
    tonBalanceOK,
    jettonBalanceOK,
    alerts: allAlerts,
  };
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
