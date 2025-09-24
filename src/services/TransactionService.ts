/**
 * TransactionService - TON operations for Transaction entity
 *
 * Provides comprehensive transaction management operations for the Corgi Buddy TON Mini-App.
 * Handles transaction creation, retrieval, updates, and TON blockchain integration.
 *
 * Based on the data model specification in specs/001-you-need-to/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQuery,
  TransactionRow,
  TransactionStatus,
  TransactionType,
  RelatedEntityType,
  fromDatabaseRow,
  validateCreateTransactionInput,
  validateUpdateTransactionInput,
} from '@/models/Transaction';
import { BankWallet } from '@/models/BankWallet';
import type Database from 'better-sqlite3';

/**
 * Custom error types for TransactionService operations
 */
export class TransactionServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TransactionServiceError';
  }
}

export class TransactionNotFoundError extends TransactionServiceError {
  constructor(identifier: string | number) {
    super(`Transaction not found: ${identifier}`, 'TRANSACTION_NOT_FOUND', 404);
  }
}

export class TransactionValidationError extends TransactionServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class InsufficientFundsError extends TransactionServiceError {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      'INSUFFICIENT_FUNDS',
      400
    );
  }
}

export class TransactionConflictError extends TransactionServiceError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR', 409);
  }
}

/**
 * Result type for transaction creation with bank wallet updates
 */
export interface CreateTransactionResult {
  transaction: Transaction;
  bankWalletUpdated: boolean;
}

/**
 * Transaction query result with pagination metadata
 */
export interface TransactionQueryResult {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * TransactionService class providing all transaction-related database operations
 */
export class TransactionService {
  private static instance: TransactionService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    getTransactionById: null as Database.Statement | null,
    getTransactionByHash: null as Database.Statement | null,
    createTransaction: null as Database.Statement | null,
    updateTransaction: null as Database.Statement | null,
    deleteTransaction: null as Database.Statement | null,
    getTransactionsByUser: null as Database.Statement | null,
    getTransactionsByStatus: null as Database.Statement | null,
    getTransactionsByType: null as Database.Statement | null,
    getTransactionsByRelatedEntity: null as Database.Statement | null,
    countTransactionsByUser: null as Database.Statement | null,
    countTotalTransactions: null as Database.Statement | null,
    getBankWallet: null as Database.Statement | null,
    updateBankWallet: null as Database.Statement | null,
    getUserWalletAddress: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.getTransactionById = this.db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `);

    this.statements.getTransactionByHash = this.db.prepare(`
      SELECT * FROM transactions WHERE transaction_hash = ?
    `);

    this.statements.createTransaction = this.db.prepare(`
      INSERT INTO transactions (
        transaction_hash, from_wallet, to_wallet, amount,
        transaction_type, related_entity_id, related_entity_type, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    this.statements.updateTransaction = this.db.prepare(`
      UPDATE transactions
      SET transaction_hash = COALESCE(?, transaction_hash),
          status = COALESCE(?, status),
          completed_at = COALESCE(?, completed_at)
      WHERE id = ?
      RETURNING *
    `);

    this.statements.deleteTransaction = this.db.prepare(`
      DELETE FROM transactions WHERE id = ?
    `);

    this.statements.getTransactionsByUser = this.db.prepare(`
      SELECT t.* FROM transactions t
      JOIN users u1 ON t.from_wallet = u1.ton_wallet_address
      JOIN users u2 ON t.to_wallet = u2.ton_wallet_address
      WHERE u1.id = ? OR u2.id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.getTransactionsByStatus = this.db.prepare(`
      SELECT * FROM transactions
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.getTransactionsByType = this.db.prepare(`
      SELECT * FROM transactions
      WHERE transaction_type = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.getTransactionsByRelatedEntity = this.db.prepare(`
      SELECT * FROM transactions
      WHERE related_entity_type = ? AND related_entity_id = ?
      ORDER BY created_at DESC
    `);

    this.statements.countTransactionsByUser = this.db.prepare(`
      SELECT COUNT(*) as count FROM transactions t
      JOIN users u1 ON t.from_wallet = u1.ton_wallet_address
      JOIN users u2 ON t.to_wallet = u2.ton_wallet_address
      WHERE u1.id = ? OR u2.id = ?
    `);

    this.statements.countTotalTransactions = this.db.prepare(`
      SELECT COUNT(*) as count FROM transactions
      WHERE 1 = 1
    `);

    this.statements.getBankWallet = this.db.prepare(`
      SELECT * FROM bank_wallet WHERE id = 1
    `);

    this.statements.updateBankWallet = this.db.prepare(`
      UPDATE bank_wallet
      SET current_balance = ?,
          total_distributed = ?,
          last_transaction_hash = ?
      WHERE id = 1
      RETURNING *
    `);

    this.statements.getUserWalletAddress = this.db.prepare(`
      SELECT ton_wallet_address FROM users WHERE id = ?
    `);
  }

  /**
   * Convert database row to Transaction object with proper type conversions
   */
  private mapRowToTransaction(row: Record<string, unknown>): Transaction {
    return fromDatabaseRow(row as unknown as TransactionRow);
  }

  /**
   * Convert database row to BankWallet object
   */
  private mapRowToBankWallet(row: Record<string, unknown>): BankWallet {
    return {
      id: 1,
      wallet_address: row.wallet_address as string,
      current_balance: parseFloat(row.current_balance as string),
      total_distributed: parseFloat(row.total_distributed as string),
      last_transaction_hash: row.last_transaction_hash as string | null,
      updated_at: new Date(row.updated_at as string),
    };
  }

  /**
   * Get transaction by ID
   */
  public async getTransactionById(id: number): Promise<Transaction | null> {
    try {
      const row = this.statements.getTransactionById!.get(id);
      return row
        ? this.mapRowToTransaction(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to retrieve transaction by ID: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get transaction by blockchain hash
   */
  public async getTransactionByHash(hash: string): Promise<Transaction | null> {
    try {
      const row = this.statements.getTransactionByHash!.get(hash);
      return row
        ? this.mapRowToTransaction(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to retrieve transaction by hash: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Create a new transaction
   */
  public async createTransaction(
    transactionData: CreateTransactionInput
  ): Promise<CreateTransactionResult> {
    // Validate input data
    const validationErrors = validateCreateTransactionInput(transactionData);
    if (validationErrors.length > 0) {
      throw new TransactionValidationError(
        `Validation failed: ${validationErrors.join(', ')}`
      );
    }

    try {
      return withTransaction(() => {
        let bankWalletUpdated = false;

        // For reward transactions, check bank wallet balance and update it
        if (transactionData.transaction_type === TransactionType.REWARD) {
          const bankWalletRow = this.statements.getBankWallet!.get();
          if (!bankWalletRow) {
            throw new TransactionServiceError(
              'Bank wallet not initialized',
              'BANK_WALLET_ERROR'
            );
          }

          const bankWallet = this.mapRowToBankWallet(
            bankWalletRow as Record<string, unknown>
          );

          // Check if bank has sufficient balance
          if (bankWallet.current_balance < transactionData.amount) {
            throw new InsufficientFundsError(
              transactionData.amount,
              bankWallet.current_balance
            );
          }

          // Update bank wallet balance
          const newBalance =
            bankWallet.current_balance - transactionData.amount;
          const newTotalDistributed =
            bankWallet.total_distributed + transactionData.amount;

          this.statements.updateBankWallet!.run(
            newBalance,
            newTotalDistributed,
            null // transaction_hash will be updated when blockchain confirms
          );

          bankWalletUpdated = true;
        }

        // Create the transaction
        const row = this.statements.createTransaction!.get(
          null, // transaction_hash starts null for pending transactions
          transactionData.from_wallet,
          transactionData.to_wallet,
          transactionData.amount,
          transactionData.transaction_type,
          transactionData.related_entity_id || null,
          transactionData.related_entity_type || null,
          TransactionStatus.PENDING
        );

        const transaction = this.mapRowToTransaction(
          row as Record<string, unknown>
        );

        return {
          transaction,
          bankWalletUpdated,
        };
      });
    } catch (error) {
      if (error instanceof TransactionServiceError) {
        throw error;
      }

      // Handle database constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new TransactionConflictError('Transaction hash already exists');
        }
        if (error.code === 'SQLITE_CONSTRAINT_CHECK') {
          throw new TransactionValidationError(
            'Transaction amount must be positive'
          );
        }
      }

      throw new TransactionServiceError(
        `Failed to create transaction: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update an existing transaction
   */
  public async updateTransaction(
    id: number,
    updateData: UpdateTransactionInput
  ): Promise<Transaction> {
    // Validate input data
    const validationErrors = validateUpdateTransactionInput(updateData);
    if (validationErrors.length > 0) {
      throw new TransactionValidationError(
        `Validation failed: ${validationErrors.join(', ')}`
      );
    }

    try {
      return withTransaction(() => {
        // Check if transaction exists
        const existingTransaction = this.statements.getTransactionById!.get(id);
        if (!existingTransaction) {
          throw new TransactionNotFoundError(id);
        }

        // Prepare update values
        const completedAt =
          updateData.status === TransactionStatus.COMPLETED ||
          updateData.status === TransactionStatus.FAILED
            ? new Date().toISOString()
            : updateData.completed_at?.toISOString() || null;

        // Update the transaction
        const updatedRow = this.statements.updateTransaction!.get(
          updateData.transaction_hash || null,
          updateData.status || null,
          completedAt,
          id
        );

        // If updating bank wallet's last transaction hash for completed transactions
        if (
          updateData.transaction_hash &&
          updateData.status === TransactionStatus.COMPLETED
        ) {
          const transaction = this.mapRowToTransaction(
            existingTransaction as Record<string, unknown>
          );
          if (transaction.transaction_type === TransactionType.REWARD) {
            const bankWalletRow = this.statements.getBankWallet!.get();
            if (bankWalletRow) {
              const bankWallet = this.mapRowToBankWallet(
                bankWalletRow as Record<string, unknown>
              );
              this.statements.updateBankWallet!.run(
                bankWallet.current_balance,
                bankWallet.total_distributed,
                updateData.transaction_hash
              );
            }
          }
        }

        return this.mapRowToTransaction(updatedRow as Record<string, unknown>);
      });
    } catch (error) {
      if (error instanceof TransactionServiceError) {
        throw error;
      }

      throw new TransactionServiceError(
        `Failed to update transaction: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Delete a transaction (rarely used, mainly for cleanup)
   */
  public async deleteTransaction(id: number): Promise<boolean> {
    try {
      return withTransaction(() => {
        const result = this.statements.deleteTransaction!.run(id);
        return result.changes > 0;
      });
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to delete transaction: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Query transactions with comprehensive filtering and pagination
   */
  public async queryTransactions(
    query: TransactionQuery
  ): Promise<TransactionQueryResult> {
    try {
      const limit = Math.min(query.limit || 20, 100); // Cap at 100
      const offset = query.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      let transactions: Transaction[] = [];
      let total = 0;

      if (query.wallet_address) {
        // Find user ID from wallet address
        const userRow = this.db
          .prepare('SELECT id FROM users WHERE ton_wallet_address = ?')
          .get(query.wallet_address);

        if (userRow) {
          const userId = (userRow as { id: number }).id;

          // Apply additional filters
          let sql = `
            SELECT t.* FROM transactions t
            JOIN users u1 ON t.from_wallet = u1.ton_wallet_address
            JOIN users u2 ON t.to_wallet = u2.ton_wallet_address
            WHERE (u1.id = ? OR u2.id = ?)
          `;

          const params: (string | number)[] = [userId, userId];

          if (query.status) {
            sql += ' AND t.status = ?';
            params.push(query.status);
          }

          if (query.transaction_type) {
            sql += ' AND t.transaction_type = ?';
            params.push(query.transaction_type);
          }

          if (query.related_entity_type) {
            sql += ' AND t.related_entity_type = ?';
            params.push(query.related_entity_type);
          }

          if (query.related_entity_id) {
            sql += ' AND t.related_entity_id = ?';
            params.push(query.related_entity_id);
          }

          const orderBy = query.order_by || 'created_at';
          const orderDirection = query.order_direction || 'DESC';
          sql += ` ORDER BY t.${orderBy} ${orderDirection}`;
          sql += ' LIMIT ? OFFSET ?';
          params.push(limit, offset);

          const rows = this.db.prepare(sql).all(...params);
          transactions = rows.map((row) =>
            this.mapRowToTransaction(row as Record<string, unknown>)
          );

          // Get total count
          const countRow = this.statements.countTransactionsByUser!.get(
            userId,
            userId
          ) as { count: number };
          total = countRow.count;
        }
      } else if (query.status) {
        const rows = this.statements.getTransactionsByStatus!.all(
          query.status,
          limit,
          offset
        );
        transactions = rows.map((row) =>
          this.mapRowToTransaction(row as Record<string, unknown>)
        );

        // Get total count for status
        const countRow = this.db
          .prepare(
            'SELECT COUNT(*) as count FROM transactions WHERE status = ?'
          )
          .get(query.status) as { count: number };
        total = countRow.count;
      } else if (query.transaction_type) {
        const rows = this.statements.getTransactionsByType!.all(
          query.transaction_type,
          limit,
          offset
        );
        transactions = rows.map((row) =>
          this.mapRowToTransaction(row as Record<string, unknown>)
        );

        // Get total count for type
        const countRow = this.db
          .prepare(
            'SELECT COUNT(*) as count FROM transactions WHERE transaction_type = ?'
          )
          .get(query.transaction_type) as { count: number };
        total = countRow.count;
      } else {
        // Get all transactions
        const rows = this.db
          .prepare(
            `
          SELECT * FROM transactions
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `
          )
          .all(limit, offset);
        transactions = rows.map((row) =>
          this.mapRowToTransaction(row as Record<string, unknown>)
        );

        // Get total count
        const countRow = this.statements.countTotalTransactions!.get() as {
          count: number;
        };
        total = countRow.count;
      }

      return {
        transactions,
        total,
        page,
        limit,
        hasMore: offset + transactions.length < total,
      };
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to query transactions: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get transactions by related entity (corgi sighting or wish)
   */
  public async getTransactionsByRelatedEntity(
    entityType: RelatedEntityType,
    entityId: number
  ): Promise<Transaction[]> {
    try {
      const rows = this.statements.getTransactionsByRelatedEntity!.all(
        entityType,
        entityId
      );
      return rows.map((row) =>
        this.mapRowToTransaction(row as Record<string, unknown>)
      );
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to get transactions by related entity: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get user's transaction history (convenience method)
   */
  public async getUserTransactions(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<TransactionQueryResult> {
    try {
      // Get user's wallet address
      const userRow = this.statements.getUserWalletAddress!.get(userId);
      if (
        !userRow ||
        !(userRow as { ton_wallet_address: string }).ton_wallet_address
      ) {
        return {
          transactions: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        };
      }

      const walletAddress = (userRow as { ton_wallet_address: string })
        .ton_wallet_address;
      const offset = (page - 1) * limit;

      return this.queryTransactions({
        wallet_address: walletAddress,
        limit,
        offset,
      });
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to get user transactions: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get bank wallet status
   */
  public async getBankWalletStatus(): Promise<BankWallet | null> {
    try {
      const row = this.statements.getBankWallet!.get();
      return row
        ? this.mapRowToBankWallet(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new TransactionServiceError(
        `Failed to get bank wallet status: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Create reward transaction for corgi sighting confirmation
   */
  public async createRewardTransaction(
    recipientWallet: string,
    amount: number,
    corgiSightingId: number
  ): Promise<CreateTransactionResult> {
    const bankWallet = await this.getBankWalletStatus();
    if (!bankWallet) {
      throw new TransactionServiceError(
        'Bank wallet not initialized',
        'BANK_WALLET_ERROR'
      );
    }

    const transactionData: CreateTransactionInput = {
      from_wallet: bankWallet.wallet_address,
      to_wallet: recipientWallet,
      amount,
      transaction_type: TransactionType.REWARD,
      related_entity_id: corgiSightingId,
      related_entity_type: RelatedEntityType.CORGI_SIGHTING,
    };

    return this.createTransaction(transactionData);
  }

  /**
   * Create purchase transaction for wish fulfillment
   */
  public async createPurchaseTransaction(
    buyerWallet: string,
    sellerWallet: string,
    amount: number,
    wishId: number
  ): Promise<CreateTransactionResult> {
    const transactionData: CreateTransactionInput = {
      from_wallet: buyerWallet,
      to_wallet: sellerWallet,
      amount,
      transaction_type: TransactionType.PURCHASE,
      related_entity_id: wishId,
      related_entity_type: RelatedEntityType.WISH,
    };

    return this.createTransaction(transactionData);
  }

  /**
   * Confirm transaction completion with blockchain hash
   */
  public async confirmTransaction(
    id: number,
    transactionHash: string
  ): Promise<Transaction> {
    if (!transactionHash || transactionHash.trim().length === 0) {
      throw new TransactionValidationError('Transaction hash is required');
    }

    const updateData: UpdateTransactionInput = {
      transaction_hash: transactionHash,
      status: TransactionStatus.COMPLETED,
      completed_at: new Date(),
    };

    return this.updateTransaction(id, updateData);
  }

  /**
   * Mark transaction as failed
   */
  public async failTransaction(id: number): Promise<Transaction> {
    const updateData: UpdateTransactionInput = {
      status: TransactionStatus.FAILED,
      completed_at: new Date(),
    };

    return this.updateTransaction(id, updateData);
  }
}

/**
 * Export singleton instance for convenience
 */
export const transactionService = TransactionService.getInstance();

/**
 * Export default singleton instance
 */
export default transactionService;
