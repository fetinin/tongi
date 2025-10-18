/**
 * Blockchain Types
 *
 * Core types for TON blockchain interactions, transaction management,
 * and network configuration.
 */

/**
 * TON Network Configuration
 */
export type TONNetwork = 'testnet' | 'mainnet';

export interface TONNetworkConfig {
  network: TONNetwork;
  endpoint: string;
  apiKey?: string;
}

/**
 * Transaction Status Types
 */
export type TransactionStatus =
  | 'pending'
  | 'broadcasting'
  | 'completed'
  | 'failed';

export interface TransactionStatusUpdate {
  txHash: string;
  status: TransactionStatus;
  exitCode?: number; // 0 = success, non-zero = failure
  confirmationTime?: Date;
  error?: string;
}

/**
 * Wallet Types
 */
export interface WalletAddress {
  friendly: string; // User-friendly format (0QA123...)
  raw: string; // Raw format for on-chain operations
  bounceable: boolean;
  testnet: boolean;
}

export interface WalletBalance {
  address: string;
  balanceTON: bigint; // Balance in nanoTON
  balanceJettons?: Map<string, bigint>; // Jetton master -> balance
  timestamp: Date;
}

/**
 * Gas & Fee Types
 */
export interface GasEstimate {
  estimatedGasAmount: bigint; // In nanoTON
  minTONBalance: bigint; // Minimum TON needed
}

export interface TransactionFee {
  storageFee: bigint;
  gasFee: bigint;
  totalFee: bigint;
}

/**
 * Blockchain Transaction Types
 */
export interface BlockchainTransaction {
  hash: string; // Transaction hash (BOC hash)
  seqNo?: number; // Sequence number from wallet
  fromAddress: string;
  toAddress: string;
  amount?: bigint;
  exitCode?: number; // 0 = success
  logicalTime?: number;
  blockHeight?: number;
  confirmationTime?: Date;
  isSuccessful: boolean;
}

/**
 * Jetton Contract Call Result
 */
export interface JettonContractCallResult {
  stack: any[]; // TVM stack result
  exit_code: number; // 0 = success
}

/**
 * Error Classification for Retry Logic
 */
export type ErrorClassification = 'retryable' | 'non_retryable';

export interface ClassifiedError {
  classification: ErrorClassification;
  message: string;
  code?: string;
  originalError: Error;
}

/**
 * Webhook Event Types
 */
export interface TONAPIWebhookEvent {
  type: 'transaction_confirmation';
  tx_hash: string;
  status: 'success' | 'failure';
  exit_code?: number;
  timestamp: number;
}

export interface WebhookSignature {
  timestamp: number;
  signature: string;
}
