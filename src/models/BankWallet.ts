/**
 * BankWallet Model
 *
 * Represents the system-controlled wallet for Corgi coin distribution.
 * This is a singleton entity - only one bank wallet record is allowed.
 */

/**
 * Bank wallet entity interface representing the system wallet
 * for Corgi coin distribution in the TON blockchain.
 */
export interface BankWallet {
  /** Primary key - Always 1 (singleton) */
  id: 1;

  /** Bank wallet TON address - must be valid TON address format */
  wallet_address: string;

  /** Current Corgi coin balance - must be non-negative */
  current_balance: number;

  /** Total coins distributed to users - must be non-negative */
  total_distributed: number;

  /** Last transaction hash - nullable, unique when provided */
  last_transaction_hash: string | null;

  /** Last balance update timestamp */
  updated_at: Date;
}

/**
 * Input interface for creating/updating bank wallet
 * Excludes auto-generated fields like id and timestamps
 */
export interface BankWalletInput {
  /** Bank wallet TON address */
  wallet_address: string;

  /** Current Corgi coin balance */
  current_balance: number;

  /** Total coins distributed to users */
  total_distributed: number;

  /** Last transaction hash - optional */
  last_transaction_hash?: string | null;
}

/**
 * Partial interface for bank wallet updates
 * All fields are optional for partial updates
 */
export interface BankWalletUpdate {
  /** Bank wallet TON address */
  wallet_address?: string;

  /** Current Corgi coin balance */
  current_balance?: number;

  /** Total coins distributed to users */
  total_distributed?: number;

  /** Last transaction hash */
  last_transaction_hash?: string | null;
}

/**
 * Database row interface matching SQLite schema
 * Used for direct database operations with string dates
 */
export interface BankWalletRow {
  /** Primary key - Always 1 (singleton) */
  id: 1;

  /** Bank wallet TON address */
  wallet_address: string;

  /** Current Corgi coin balance as decimal */
  current_balance: number;

  /** Total coins distributed to users as decimal */
  total_distributed: number;

  /** Last transaction hash - nullable */
  last_transaction_hash: string | null;

  /** Last balance update timestamp as string */
  updated_at: string;
}

/**
 * Type for bank wallet balance operations
 */
export interface BalanceOperation {
  /** Amount to add or subtract */
  amount: number;

  /** Transaction hash associated with this operation */
  transaction_hash?: string;

  /** Description of the operation */
  description?: string;
}

/**
 * Validation constraints for bank wallet
 */
export const BankWalletConstraints = {
  /** Singleton ID - must always be 1 */
  SINGLETON_ID: 1 as const,

  /** Minimum balance allowed */
  MIN_BALANCE: 0,

  /** Minimum total distributed allowed */
  MIN_TOTAL_DISTRIBUTED: 0,

  /** Maximum decimal places for amounts */
  DECIMAL_PLACES: 2,

  /** TON address validation pattern */
  TON_ADDRESS_PATTERN: /^[A-Za-z0-9_-]{48}$/,
} as const;

/**
 * Utility type for bank wallet status
 */
export interface BankWalletStatus {
  /** Whether the wallet has sufficient balance */
  has_sufficient_balance: boolean;

  /** Current balance */
  current_balance: number;

  /** Total distributed */
  total_distributed: number;

  /** Last update timestamp */
  last_updated: Date;
}

export default BankWallet;
