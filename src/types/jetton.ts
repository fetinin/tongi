/**
 * Jetton Types
 *
 * Types specific to TEP-74 Jetton token operations, including
 * transfer parameters, wallet address resolution, and Jetton-specific operations.
 */

/**
 * Jetton Master Contract Address
 * Represents the master contract address for a specific Jetton token
 */
export interface JettonMasterAddress {
  address: string; // Master contract address
  symbol: string; // Token symbol (e.g., "CORGI")
  decimals: number; // Number of decimal places
  totalSupply?: bigint; // Total supply in smallest units
}

/**
 * Jetton Wallet Address
 * Each user has a unique Jetton wallet for each Jetton master contract
 */
export interface JettonWalletAddress {
  masterAddress: string; // Parent Jetton master address
  userAddress: string; // User's TON wallet address
  jettonWalletAddress: string; // Derived Jetton wallet address
  balance?: bigint; // Balance in smallest units (optional, may be queried separately)
}

/**
 * Jetton Transfer Parameters
 * Used to build TEP-74 compliant transfer messages
 */
export interface JettonTransferParams {
  masterAddress: string; // Jetton master contract address
  senderJettonWallet: string; // Sender's Jetton wallet address
  destination: string; // Recipient's TON wallet address
  amount: bigint; // Amount in smallest units (amount × 10^decimals)
  queryId?: number; // Optional query ID for tracking
  forwardAmount?: bigint; // Amount to forward to destination (TON nanotons)
  forwardPayload?: string; // Optional forward payload
}

/**
 * Jetton Transfer Message Builder Result
 * Result of building a TEP-74 transfer message
 */
export interface JettonTransferMessageResult {
  jettonWalletAddress: string; // Jetton wallet that initiates transfer
  transferBody: any; // Serialized transfer body (Cell)
  queryId: number; // Query ID used for this transfer
  amount: bigint; // Amount being transferred
}

/**
 * Jetton Transfer Broadcast Result
 * Result after broadcasting a Jetton transfer to the network
 */
export interface JettonTransferBroadcastResult {
  transactionHash: string; // Transaction hash
  seqNo: number; // Sequence number from wallet
  fromAddress: string; // From wallet address
  toAddress: string; // Recipient wallet address
  amount: bigint; // Amount transferred
  timestamp: Date;
}

/**
 * Jetton Balance Info
 * Information about a user's Jetton balance
 */
export interface JettonBalanceInfo {
  masterAddress: string; // Jetton master address
  userAddress: string; // User's TON wallet
  jettonWalletAddress: string; // User's Jetton wallet
  balance: bigint; // Balance in smallest units
  lastUpdated: Date;
}

/**
 * Jetton Operation Codes (TEP-74)
 * Standard operation codes for Jetton operations
 */
export const JETTON_OP_CODES = {
  TRANSFER: 0xf8a7ea5, // Jetton transfer
  TRANSFER_NOTIFICATION: 0x7362d09c, // Notification to recipient
  BURN: 0x595f07fb, // Burn Jettons
  BURN_NOTIFICATION: 0x7bdd97de, // Burn notification
} as const;

/**
 * Jetton Error Types
 */
export type JettonErrorType =
  | 'invalid_master_address'
  | 'invalid_wallet_address'
  | 'insufficient_balance'
  | 'contract_error'
  | 'invalid_transfer_params'
  | 'unknown_error';

export interface JettonError {
  type: JettonErrorType;
  message: string;
  exitCode?: number;
  originalError?: Error;
}
