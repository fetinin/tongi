/**
 * TON Connect Integration Utility
 *
 * Provides comprehensive TON blockchain integration for the Corgi Buddy Mini-App.
 * Handles wallet connections, address validation, transaction creation, and
 * blockchain operations using TON Connect SDK.
 *
 * Based on @tonconnect/ui-react and TON Connect protocol specifications.
 */

import { toUserFriendlyAddress } from '@tonconnect/sdk';

/**
 * TON network configuration
 */
export const TON_CONFIG = {
  // Corgi coin to nanoton conversion rate (1 Corgi coin = 0.01 TON = 10^7 nanotons)
  CORGI_TO_NANOTON_RATE: 10_000_000,
  // Minimum transaction amount in nanotons (0.001 TON)
  MIN_TRANSACTION_AMOUNT: 1_000_000,
  // Maximum transaction amount in nanotons (10 TON)
  MAX_TRANSACTION_AMOUNT: 10_000_000_000,
  // Transaction validity period (10 minutes)
  TRANSACTION_VALIDITY_SECONDS: 600,
  // Network: 'mainnet' | 'testnet'
  NETWORK: (process.env.TON_NETWORK || 'testnet') as 'mainnet' | 'testnet',
} as const;

/**
 * Custom error types for TON operations
 */
export class TonConnectError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TonConnectError';
  }
}

export class InvalidAddressError extends TonConnectError {
  constructor(address: string) {
    super(`Invalid TON address: ${address}`, 'INVALID_ADDRESS', 400);
  }
}

export class InvalidTransactionError extends TonConnectError {
  constructor(message: string) {
    super(message, 'INVALID_TRANSACTION', 400);
  }
}

export class WalletConnectionError extends TonConnectError {
  constructor(message: string) {
    super(message, 'WALLET_CONNECTION_ERROR', 500);
  }
}

export class NetworkError extends TonConnectError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 500);
  }
}

/**
 * TON transaction message interface
 */
export interface TonTransactionMessage {
  address: string;
  amount: string; // in nanotons
  payload?: string;
  stateInit?: string;
}

/**
 * TON transaction parameters
 */
export interface TonTransaction {
  validUntil: number;
  messages: TonTransactionMessage[];
}

/**
 * Wallet connection information
 */
export interface WalletInfo {
  address: string;
  network: string;
  publicKey?: string;
  walletVersion?: string;
}

/**
 * Transaction creation options
 */
export interface CreateTransactionOptions {
  recipientAddress: string;
  corgiCoinAmount: number;
  memo?: string;
  validitySeconds?: number;
}

/**
 * Purchase transaction options
 */
export interface CreatePurchaseTransactionOptions {
  sellerAddress: string;
  corgiCoinAmount: number;
  wishId: number;
  validitySeconds?: number;
}

/**
 * Address validation and formatting utilities
 */

/**
 * Validates if a string is a valid TON address
 * @param address Address to validate
 * @returns true if valid TON address
 */
export function validateTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Remove whitespace
  const cleanAddress = address.trim();

  // TON addresses can be:
  // 1. Raw format: 64 hex characters (32 bytes)
  // 2. User-friendly format: base64 with checksum
  // 3. Bounceable/non-bounceable variants

  // Check raw format (64 hex characters)
  if (/^[0-9a-fA-F]{64}$/.test(cleanAddress)) {
    return true;
  }

  // Check user-friendly format (base64-like with specific length)
  if (/^[A-Za-z0-9+/\-_]{48}$/.test(cleanAddress.replace(/=/g, ''))) {
    return true;
  }

  // Extended check for EQ/UQ prefixed addresses
  if (/^(EQ|UQ)[A-Za-z0-9+/\-_]{46}$/.test(cleanAddress)) {
    return true;
  }

  return false;
}

/**
 * Converts a raw TON address to user-friendly format
 * @param rawAddress Raw TON address
 * @param testnetOnly Whether to use testnet-only format
 * @returns User-friendly address or null if invalid
 */
export function formatUserFriendlyAddress(
  rawAddress: string,
  testnetOnly: boolean = TON_CONFIG.NETWORK === 'testnet'
): string | null {
  try {
    if (!validateTonAddress(rawAddress)) {
      return null;
    }

    return toUserFriendlyAddress(rawAddress, testnetOnly);
  } catch (error) {
    console.error('Error formatting address:', error);
    return null;
  }
}

/**
 * Normalizes TON address for consistent database storage
 * @param address Address in any valid format
 * @returns Normalized address or null if invalid
 */
export function normalizeTonAddress(address: string): string | null {
  if (!validateTonAddress(address)) {
    return null;
  }

  // Return user-friendly format for consistency
  const formatted = formatUserFriendlyAddress(address);
  return formatted;
}

/**
 * Transaction amount conversion utilities
 */

/**
 * Converts Corgi coins to nanotons for blockchain transactions
 * @param corgiCoins Amount in Corgi coins
 * @returns Amount in nanotons
 */
export function corgiCoinsToNanotons(corgiCoins: number): string {
  if (corgiCoins <= 0) {
    throw new InvalidTransactionError('Corgi coin amount must be positive');
  }

  const nanotons = Math.floor(corgiCoins * TON_CONFIG.CORGI_TO_NANOTON_RATE);

  if (nanotons < TON_CONFIG.MIN_TRANSACTION_AMOUNT) {
    throw new InvalidTransactionError(`Amount too small: minimum ${TON_CONFIG.MIN_TRANSACTION_AMOUNT} nanotons`);
  }

  if (nanotons > TON_CONFIG.MAX_TRANSACTION_AMOUNT) {
    throw new InvalidTransactionError(`Amount too large: maximum ${TON_CONFIG.MAX_TRANSACTION_AMOUNT} nanotons`);
  }

  return nanotons.toString();
}

/**
 * Converts nanotons to Corgi coins for display
 * @param nanotons Amount in nanotons (string or number)
 * @returns Amount in Corgi coins
 */
export function nanotonsToCorgiCoins(nanotons: string | number): number {
  const nanotonsNum = typeof nanotons === 'string' ? parseInt(nanotons, 10) : nanotons;

  if (isNaN(nanotonsNum) || nanotonsNum < 0) {
    throw new InvalidTransactionError('Invalid nanotons amount');
  }

  return nanotonsNum / TON_CONFIG.CORGI_TO_NANOTON_RATE;
}

/**
 * Transaction creation utilities
 */

/**
 * Creates a TON transaction for Corgi coin transfer
 * @param options Transaction creation options
 * @returns TON transaction object
 */
export function createTonTransaction(options: CreateTransactionOptions): TonTransaction {
  const { recipientAddress, corgiCoinAmount, memo, validitySeconds = TON_CONFIG.TRANSACTION_VALIDITY_SECONDS } = options;

  // Validate recipient address
  if (!validateTonAddress(recipientAddress)) {
    throw new InvalidAddressError(recipientAddress);
  }

  // Convert amount to nanotons
  const amountNanotons = corgiCoinsToNanotons(corgiCoinAmount);

  // Create transaction payload with memo if provided
  let payload: string | undefined;
  if (memo) {
    // Simple text payload (in production, you might want to use TL-B serialization)
    payload = Buffer.from(memo, 'utf-8').toString('base64');
  }

  // Calculate validity timestamp
  const validUntil = Math.floor(Date.now() / 1000) + validitySeconds;

  const transaction: TonTransaction = {
    validUntil,
    messages: [
      {
        address: recipientAddress,
        amount: amountNanotons,
        payload,
      },
    ],
  };

  return transaction;
}

/**
 * Creates a purchase transaction for wish fulfillment
 * @param options Purchase transaction options
 * @returns TON transaction object
 */
export function createPurchaseTransaction(options: CreatePurchaseTransactionOptions): TonTransaction {
  const { sellerAddress, corgiCoinAmount, wishId, validitySeconds = TON_CONFIG.TRANSACTION_VALIDITY_SECONDS } = options;

  const memo = `Wish purchase #${wishId}`;

  return createTonTransaction({
    recipientAddress: sellerAddress,
    corgiCoinAmount,
    memo,
    validitySeconds,
  });
}

/**
 * Creates a reward transaction for corgi sighting confirmation
 * @param recipientAddress Address to receive the reward
 * @param corgiCoinAmount Reward amount in Corgi coins
 * @param sightingId Corgi sighting ID
 * @returns TON transaction object
 */
export function createRewardTransaction(
  recipientAddress: string,
  corgiCoinAmount: number,
  sightingId: number
): TonTransaction {
  const memo = `Corgi sighting reward #${sightingId}`;

  return createTonTransaction({
    recipientAddress,
    corgiCoinAmount,
    memo,
  });
}

/**
 * Validates transaction parameters before sending
 * @param transaction TON transaction to validate
 * @returns Validation errors array (empty if valid)
 */
export function validateTransactionParams(transaction: TonTransaction): string[] {
  const errors: string[] = [];

  // Check validity timestamp
  const currentTime = Math.floor(Date.now() / 1000);
  if (transaction.validUntil <= currentTime) {
    errors.push('Transaction has expired');
  }

  // Validate messages
  if (!transaction.messages || transaction.messages.length === 0) {
    errors.push('Transaction must have at least one message');
  }

  for (const [index, message] of transaction.messages.entries()) {
    if (!validateTonAddress(message.address)) {
      errors.push(`Invalid recipient address in message ${index + 1}`);
    }

    const amount = parseInt(message.amount, 10);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Invalid amount in message ${index + 1}`);
    }

    if (amount < TON_CONFIG.MIN_TRANSACTION_AMOUNT) {
      errors.push(`Amount too small in message ${index + 1}`);
    }

    if (amount > TON_CONFIG.MAX_TRANSACTION_AMOUNT) {
      errors.push(`Amount too large in message ${index + 1}`);
    }
  }

  return errors;
}

/**
 * Estimates transaction fee (simplified implementation)
 * @param transaction TON transaction
 * @returns Estimated fee in nanotons
 */
export function estimateTransactionFee(transaction: TonTransaction): number {
  // Basic fee calculation (in production, use actual TON fee calculation)
  const baseFee = 1_000_000; // 0.001 TON base fee
  const messageFee = 500_000; // 0.0005 TON per message

  return baseFee + (transaction.messages.length * messageFee);
}

/**
 * Wallet management utilities
 */

/**
 * Extracts wallet information from TON Connect wallet object
 * @param wallet TON Connect wallet object
 * @returns Normalized wallet information
 */
export function extractWalletInfo(wallet: any): WalletInfo | null {
  try {
    if (!wallet || !wallet.account) {
      return null;
    }

    const { account } = wallet;

    return {
      address: account.address,
      network: account.chain?.toString() || 'unknown',
      publicKey: account.publicKey,
      walletVersion: wallet.device?.appVersion,
    };
  } catch (error) {
    console.error('Error extracting wallet info:', error);
    return null;
  }
}

/**
 * Checks if a wallet address matches expected network
 * @param address Wallet address
 * @param expectedNetwork Expected network ('mainnet' | 'testnet')
 * @returns true if address matches network
 */
export function validateWalletNetwork(address: string, expectedNetwork: string = TON_CONFIG.NETWORK): boolean {
  // In testnet, addresses often start with 'kQ' or 'EQ'
  // In mainnet, addresses typically start with 'EQ' or 'UQ'
  // This is a simplified check - production should use proper network detection

  if (expectedNetwork === 'testnet') {
    // Accept both testnet and mainnet addresses in testnet mode for development
    return validateTonAddress(address);
  }

  // For mainnet, be more strict
  return validateTonAddress(address) && !address.startsWith('kQ');
}

/**
 * Error handling utilities
 */

/**
 * Standardizes TON Connect error messages
 * @param error Original error
 * @returns Standardized error message
 */
export function standardizeTonError(error: unknown): string {
  if (error instanceof TonConnectError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Common TON Connect error patterns
    if (error.message.includes('user rejected')) {
      return 'Transaction was cancelled by user';
    }

    if (error.message.includes('insufficient funds')) {
      return 'Insufficient balance in wallet';
    }

    if (error.message.includes('network')) {
      return 'Network connection error. Please try again.';
    }

    if (error.message.includes('timeout')) {
      return 'Transaction timeout. Please try again.';
    }

    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Integration helpers for existing services
 */

/**
 * Converts transaction service data to TON transaction format
 * @param fromWallet Sender wallet address
 * @param toWallet Recipient wallet address
 * @param amount Amount in Corgi coins
 * @param memo Optional memo
 * @returns TON transaction object
 */
export function serviceTransactionToTonTransaction(
  fromWallet: string,
  toWallet: string,
  amount: number,
  memo?: string
): TonTransaction {
  return createTonTransaction({
    recipientAddress: toWallet,
    corgiCoinAmount: amount,
    memo,
  });
}

/**
 * Formats transaction hash for display
 * @param hash Transaction hash
 * @returns Formatted hash (shortened for display)
 */
export function formatTransactionHash(hash: string): string {
  if (!hash || hash.length < 10) {
    return hash;
  }

  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Development and testing utilities
 */

/**
 * Creates a mock transaction for testing (development only)
 * @param overrides Optional overrides for transaction properties
 * @returns Mock TON transaction
 */
export function createMockTransaction(overrides: Partial<TonTransaction> = {}): TonTransaction {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock transactions not allowed in production');
  }

  return {
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [
      {
        address: 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
        amount: '10000000', // 0.01 TON
      },
    ],
    ...overrides,
  };
}

/**
 * Export configuration and utilities
 */
export { TON_CONFIG as default };

/**
 * Type exports for external use
 */
export type {
  TonTransaction,
  TonTransactionMessage,
  WalletInfo,
  CreateTransactionOptions,
  CreatePurchaseTransactionOptions,
};