/**
 * Transaction Model for Corgi Buddy TON Cryptocurrency Mini-App
 *
 * Represents TON blockchain transactions for Corgi coin transfers.
 * Handles both reward transactions (from corgi sightings) and purchase transactions (from wishes).
 */

// Transaction status enumeration
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Transaction type enumeration
export enum TransactionType {
  REWARD = 'reward',
  PURCHASE = 'purchase'
}

// Related entity type enumeration for polymorphic relationships
export enum RelatedEntityType {
  CORGI_SIGHTING = 'corgi_sighting',
  WISH = 'wish'
}

// Core Transaction interface representing the database entity
export interface Transaction {
  /** Auto-increment primary key */
  id: number;

  /** TON blockchain transaction hash (nullable for pending transactions) */
  transaction_hash: string | null;

  /** Sender's TON wallet address */
  from_wallet: string;

  /** Recipient's TON wallet address */
  to_wallet: string;

  /** Corgi coins transferred (positive decimal) */
  amount: number;

  /** Type of transaction */
  transaction_type: TransactionType;

  /** ID of related entity (CorgiSighting or Wish) */
  related_entity_id: number | null;

  /** Type of related entity */
  related_entity_type: RelatedEntityType | null;

  /** Transaction status */
  status: TransactionStatus;

  /** Transaction initiation timestamp */
  created_at: Date;

  /** Transaction completion timestamp (nullable for pending/failed) */
  completed_at: Date | null;
}

// Interface for creating new transactions (excludes auto-generated fields)
export interface CreateTransactionInput {
  /** Sender's TON wallet address */
  from_wallet: string;

  /** Recipient's TON wallet address */
  to_wallet: string;

  /** Corgi coins to transfer (must be positive) */
  amount: number;

  /** Type of transaction */
  transaction_type: TransactionType;

  /** ID of related entity (required for reward/purchase tracking) */
  related_entity_id?: number;

  /** Type of related entity (required when related_entity_id is provided) */
  related_entity_type?: RelatedEntityType;
}

// Interface for updating existing transactions
export interface UpdateTransactionInput {
  /** TON blockchain transaction hash (set when transaction is submitted) */
  transaction_hash?: string;

  /** Transaction status update */
  status?: TransactionStatus;

  /** Transaction completion timestamp (set when status becomes completed/failed) */
  completed_at?: Date;
}

// Database row type (matches SQLite schema exactly)
export interface TransactionRow {
  id: number;
  transaction_hash: string | null;
  from_wallet: string;
  to_wallet: string;
  amount: string; // SQLite returns DECIMAL as string
  transaction_type: string;
  related_entity_id: number | null;
  related_entity_type: string | null;
  status: string;
  created_at: string; // SQLite returns DATETIME as string
  completed_at: string | null;
}

// Type guard functions for validation
export function isValidTransactionType(type: string): type is TransactionType {
  return Object.values(TransactionType).includes(type as TransactionType);
}

export function isValidTransactionStatus(status: string): status is TransactionStatus {
  return Object.values(TransactionStatus).includes(status as TransactionStatus);
}

export function isValidRelatedEntityType(type: string): type is RelatedEntityType {
  return Object.values(RelatedEntityType).includes(type as RelatedEntityType);
}

// Validation function for TON wallet addresses
export function isValidTonAddress(address: string): boolean {
  // TON addresses are typically 48 characters long and start with specific prefixes
  // This is a basic validation - in production, use the TON SDK for proper validation
  const tonAddressPattern = /^[A-Za-z0-9_-]{48}$/;
  return tonAddressPattern.test(address);
}

// Helper function to convert database row to Transaction model
export function fromDatabaseRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    transaction_hash: row.transaction_hash,
    from_wallet: row.from_wallet,
    to_wallet: row.to_wallet,
    amount: parseFloat(row.amount),
    transaction_type: row.transaction_type as TransactionType,
    related_entity_id: row.related_entity_id,
    related_entity_type: row.related_entity_type as RelatedEntityType | null,
    status: row.status as TransactionStatus,
    created_at: new Date(row.created_at),
    completed_at: row.completed_at ? new Date(row.completed_at) : null
  };
}

// Helper function to validate transaction creation input
export function validateCreateTransactionInput(input: CreateTransactionInput): string[] {
  const errors: string[] = [];

  // Validate wallet addresses
  if (!isValidTonAddress(input.from_wallet)) {
    errors.push('Invalid from_wallet TON address format');
  }

  if (!isValidTonAddress(input.to_wallet)) {
    errors.push('Invalid to_wallet TON address format');
  }

  // Validate amount
  if (input.amount <= 0) {
    errors.push('Amount must be positive');
  }

  if (!Number.isFinite(input.amount)) {
    errors.push('Amount must be a valid number');
  }

  // Validate transaction type
  if (!isValidTransactionType(input.transaction_type)) {
    errors.push('Invalid transaction_type');
  }

  // Validate related entity constraints
  if (input.related_entity_id !== undefined && input.related_entity_type === undefined) {
    errors.push('related_entity_type is required when related_entity_id is provided');
  }

  if (input.related_entity_type !== undefined && !isValidRelatedEntityType(input.related_entity_type)) {
    errors.push('Invalid related_entity_type');
  }

  // Validate business rules for transaction types
  if (input.transaction_type === TransactionType.REWARD) {
    if (input.related_entity_type !== RelatedEntityType.CORGI_SIGHTING) {
      errors.push('Reward transactions must be related to corgi_sighting');
    }
  }

  if (input.transaction_type === TransactionType.PURCHASE) {
    if (input.related_entity_type !== RelatedEntityType.WISH) {
      errors.push('Purchase transactions must be related to wish');
    }
  }

  return errors;
}

// Helper function to validate transaction update input
export function validateUpdateTransactionInput(input: UpdateTransactionInput): string[] {
  const errors: string[] = [];

  // Validate transaction hash if provided
  if (input.transaction_hash !== undefined && input.transaction_hash.length === 0) {
    errors.push('Transaction hash cannot be empty string');
  }

  // Validate status if provided
  if (input.status !== undefined && !isValidTransactionStatus(input.status)) {
    errors.push('Invalid transaction status');
  }

  return errors;
}

// Type for transaction queries with filters
export interface TransactionQuery {
  /** Filter by wallet address (either from or to) */
  wallet_address?: string;

  /** Filter by transaction status */
  status?: TransactionStatus;

  /** Filter by transaction type */
  transaction_type?: TransactionType;

  /** Filter by related entity type */
  related_entity_type?: RelatedEntityType;

  /** Filter by related entity ID */
  related_entity_id?: number;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Order by field (default: created_at DESC) */
  order_by?: 'created_at' | 'amount' | 'completed_at';

  /** Order direction */
  order_direction?: 'ASC' | 'DESC';
}

export default Transaction;