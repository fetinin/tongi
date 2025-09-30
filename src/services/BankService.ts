/**
 * BankService - Wallet operations for BankWallet entity
 *
 * Provides comprehensive bank wallet management operations for the Corgi Buddy TON Mini-App.
 * Handles bank wallet status, balance operations, and transaction tracking.
 *
 * Based on the data model specification in specs/001-initial-implementation/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  BankWallet,
  BankWalletInput,
  BankWalletUpdate,
  BankWalletStatus,
  BalanceOperation,
  BankWalletConstraints,
} from '@/models/BankWallet';
import type Database from 'better-sqlite3';

/**
 * Custom error types for BankService operations
 */
export class BankServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'BankServiceError';
  }
}

export class BankWalletNotFoundError extends BankServiceError {
  constructor() {
    super('Bank wallet not found', 'BANK_WALLET_NOT_FOUND', 404);
  }
}

export class BankWalletValidationError extends BankServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class InsufficientBankFundsError extends BankServiceError {
  constructor(required: number, available: number) {
    super(
      `Insufficient bank funds: required ${required}, available ${available}`,
      'INSUFFICIENT_BANK_FUNDS',
      400
    );
  }
}

export class BankWalletConflictError extends BankServiceError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR', 409);
  }
}

/**
 * Result type for balance operations
 */
export interface BalanceOperationResult {
  bankWallet: BankWallet;
  previousBalance: number;
  newBalance: number;
}

/**
 * BankService class providing all bank wallet related database operations
 */
export class BankService {
  private static instance: BankService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    getBankWallet: null as Database.Statement | null,
    createBankWallet: null as Database.Statement | null,
    updateBankWallet: null as Database.Statement | null,
    updateBalance: null as Database.Statement | null,
    updateLastTransaction: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): BankService {
    if (!BankService.instance) {
      BankService.instance = new BankService();
    }
    return BankService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.getBankWallet = this.db.prepare(`
      SELECT * FROM bank_wallet WHERE id = ?
    `);

    this.statements.createBankWallet = this.db.prepare(`
      INSERT INTO bank_wallet (
        id, wallet_address, current_balance, total_distributed, last_transaction_hash
      )
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    this.statements.updateBankWallet = this.db.prepare(`
      UPDATE bank_wallet
      SET wallet_address = COALESCE(?, wallet_address),
          current_balance = COALESCE(?, current_balance),
          total_distributed = COALESCE(?, total_distributed),
          last_transaction_hash = COALESCE(?, last_transaction_hash),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `);

    this.statements.updateBalance = this.db.prepare(`
      UPDATE bank_wallet
      SET current_balance = ?,
          total_distributed = ?,
          last_transaction_hash = COALESCE(?, last_transaction_hash),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `);

    this.statements.updateLastTransaction = this.db.prepare(`
      UPDATE bank_wallet
      SET last_transaction_hash = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `);
  }

  /**
   * Convert database row to BankWallet object with proper type conversions
   */
  private mapRowToBankWallet(row: Record<string, unknown>): BankWallet {
    return {
      id: BankWalletConstraints.SINGLETON_ID,
      wallet_address: row.wallet_address as string,
      current_balance: parseFloat(row.current_balance as string),
      total_distributed: parseFloat(row.total_distributed as string),
      last_transaction_hash: row.last_transaction_hash as string | null,
      updated_at: new Date(row.updated_at as string),
    };
  }

  /**
   * Validate bank wallet input data
   */
  private validateBankWalletInput(data: BankWalletInput): string[] {
    const errors: string[] = [];

    // Validate wallet address
    if (
      !data.wallet_address ||
      !BankWalletConstraints.TON_ADDRESS_PATTERN.test(data.wallet_address)
    ) {
      errors.push('Invalid TON wallet address format');
    }

    // Validate balance
    if (data.current_balance < BankWalletConstraints.MIN_BALANCE) {
      errors.push(
        `Current balance must be at least ${BankWalletConstraints.MIN_BALANCE}`
      );
    }

    // Validate total distributed
    if (data.total_distributed < BankWalletConstraints.MIN_TOTAL_DISTRIBUTED) {
      errors.push(
        `Total distributed must be at least ${BankWalletConstraints.MIN_TOTAL_DISTRIBUTED}`
      );
    }

    // Validate decimal places
    const balanceDecimals = (
      data.current_balance.toString().split('.')[1] || ''
    ).length;
    const distributedDecimals = (
      data.total_distributed.toString().split('.')[1] || ''
    ).length;

    if (balanceDecimals > BankWalletConstraints.DECIMAL_PLACES) {
      errors.push(
        `Current balance cannot have more than ${BankWalletConstraints.DECIMAL_PLACES} decimal places`
      );
    }

    if (distributedDecimals > BankWalletConstraints.DECIMAL_PLACES) {
      errors.push(
        `Total distributed cannot have more than ${BankWalletConstraints.DECIMAL_PLACES} decimal places`
      );
    }

    return errors;
  }

  /**
   * Get bank wallet status (singleton)
   */
  public async getBankWalletStatus(): Promise<BankWallet | null> {
    try {
      const row = this.statements.getBankWallet!.get(
        BankWalletConstraints.SINGLETON_ID
      );
      return row
        ? this.mapRowToBankWallet(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new BankServiceError(
        `Failed to retrieve bank wallet status: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Initialize bank wallet (creates if doesn't exist)
   */
  public async initializeBankWallet(
    walletData: BankWalletInput
  ): Promise<BankWallet> {
    // Validate input data
    const validationErrors = this.validateBankWalletInput(walletData);
    if (validationErrors.length > 0) {
      throw new BankWalletValidationError(
        `Validation failed: ${validationErrors.join(', ')}`
      );
    }

    try {
      return withTransaction(() => {
        // Check if bank wallet already exists
        const existingWallet = this.statements.getBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID
        );
        if (existingWallet) {
          throw new BankWalletConflictError('Bank wallet already exists');
        }

        // Create the bank wallet
        const row = this.statements.createBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID,
          walletData.wallet_address,
          walletData.current_balance,
          walletData.total_distributed,
          walletData.last_transaction_hash || null
        );

        return this.mapRowToBankWallet(row as Record<string, unknown>);
      });
    } catch (error) {
      if (error instanceof BankServiceError) {
        throw error;
      }

      // Handle database constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new BankWalletConflictError('Bank wallet already exists');
        }
        if (error.code === 'SQLITE_CONSTRAINT_CHECK') {
          throw new BankWalletValidationError(
            'Bank wallet data violates constraints'
          );
        }
      }

      throw new BankServiceError(
        `Failed to initialize bank wallet: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update bank wallet data
   */
  public async updateBankWallet(
    updateData: BankWalletUpdate
  ): Promise<BankWallet> {
    try {
      return withTransaction(() => {
        // Check if bank wallet exists
        const existingWallet = this.statements.getBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID
        );
        if (!existingWallet) {
          throw new BankWalletNotFoundError();
        }

        // Validate updated data if provided
        if (
          updateData.wallet_address &&
          !BankWalletConstraints.TON_ADDRESS_PATTERN.test(
            updateData.wallet_address
          )
        ) {
          throw new BankWalletValidationError(
            'Invalid TON wallet address format'
          );
        }

        if (
          updateData.current_balance !== undefined &&
          updateData.current_balance < BankWalletConstraints.MIN_BALANCE
        ) {
          throw new BankWalletValidationError(
            `Current balance must be at least ${BankWalletConstraints.MIN_BALANCE}`
          );
        }

        if (
          updateData.total_distributed !== undefined &&
          updateData.total_distributed <
            BankWalletConstraints.MIN_TOTAL_DISTRIBUTED
        ) {
          throw new BankWalletValidationError(
            `Total distributed must be at least ${BankWalletConstraints.MIN_TOTAL_DISTRIBUTED}`
          );
        }

        // Update the bank wallet
        const updatedRow = this.statements.updateBankWallet!.get(
          updateData.wallet_address || null,
          updateData.current_balance || null,
          updateData.total_distributed || null,
          updateData.last_transaction_hash !== undefined
            ? updateData.last_transaction_hash
            : null,
          BankWalletConstraints.SINGLETON_ID
        );

        return this.mapRowToBankWallet(updatedRow as Record<string, unknown>);
      });
    } catch (error) {
      if (error instanceof BankServiceError) {
        throw error;
      }

      throw new BankServiceError(
        `Failed to update bank wallet: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Add funds to bank wallet
   */
  public async addToBalance(
    operation: BalanceOperation
  ): Promise<BalanceOperationResult> {
    if (operation.amount <= 0) {
      throw new BankWalletValidationError('Amount must be positive');
    }

    try {
      return withTransaction(() => {
        const existingWallet = this.statements.getBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID
        );
        if (!existingWallet) {
          throw new BankWalletNotFoundError();
        }

        const bankWallet = this.mapRowToBankWallet(
          existingWallet as Record<string, unknown>
        );
        const previousBalance = bankWallet.current_balance;
        const newBalance = previousBalance + operation.amount;

        // Update balance
        const updatedRow = this.statements.updateBalance!.get(
          newBalance,
          bankWallet.total_distributed, // total_distributed doesn't change when adding funds
          operation.transaction_hash || null,
          BankWalletConstraints.SINGLETON_ID
        );

        const updatedWallet = this.mapRowToBankWallet(
          updatedRow as Record<string, unknown>
        );

        return {
          bankWallet: updatedWallet,
          previousBalance,
          newBalance,
        };
      });
    } catch (error) {
      if (error instanceof BankServiceError) {
        throw error;
      }

      throw new BankServiceError(
        `Failed to add to bank balance: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Deduct funds from bank wallet (for distributions)
   */
  public async deductFromBalance(
    operation: BalanceOperation
  ): Promise<BalanceOperationResult> {
    if (operation.amount <= 0) {
      throw new BankWalletValidationError('Amount must be positive');
    }

    try {
      return withTransaction(() => {
        const existingWallet = this.statements.getBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID
        );
        if (!existingWallet) {
          throw new BankWalletNotFoundError();
        }

        const bankWallet = this.mapRowToBankWallet(
          existingWallet as Record<string, unknown>
        );
        const previousBalance = bankWallet.current_balance;

        // Check if sufficient funds
        if (previousBalance < operation.amount) {
          throw new InsufficientBankFundsError(
            operation.amount,
            previousBalance
          );
        }

        const newBalance = previousBalance - operation.amount;
        const newTotalDistributed =
          bankWallet.total_distributed + operation.amount;

        // Update balance and total distributed
        const updatedRow = this.statements.updateBalance!.get(
          newBalance,
          newTotalDistributed,
          operation.transaction_hash || null,
          BankWalletConstraints.SINGLETON_ID
        );

        const updatedWallet = this.mapRowToBankWallet(
          updatedRow as Record<string, unknown>
        );

        return {
          bankWallet: updatedWallet,
          previousBalance,
          newBalance,
        };
      });
    } catch (error) {
      if (error instanceof BankServiceError) {
        throw error;
      }

      throw new BankServiceError(
        `Failed to deduct from bank balance: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update last transaction hash
   */
  public async updateLastTransactionHash(
    transactionHash: string
  ): Promise<BankWallet> {
    if (!transactionHash || transactionHash.trim().length === 0) {
      throw new BankWalletValidationError('Transaction hash is required');
    }

    try {
      return withTransaction(() => {
        const existingWallet = this.statements.getBankWallet!.get(
          BankWalletConstraints.SINGLETON_ID
        );
        if (!existingWallet) {
          throw new BankWalletNotFoundError();
        }

        const updatedRow = this.statements.updateLastTransaction!.get(
          transactionHash,
          BankWalletConstraints.SINGLETON_ID
        );

        return this.mapRowToBankWallet(updatedRow as Record<string, unknown>);
      });
    } catch (error) {
      if (error instanceof BankServiceError) {
        throw error;
      }

      throw new BankServiceError(
        `Failed to update last transaction hash: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get bank wallet status summary
   */
  public async getBankWalletStatusSummary(): Promise<BankWalletStatus | null> {
    const bankWallet = await this.getBankWalletStatus();

    if (!bankWallet) {
      return null;
    }

    return {
      has_sufficient_balance: bankWallet.current_balance > 0,
      current_balance: bankWallet.current_balance,
      total_distributed: bankWallet.total_distributed,
      last_updated: bankWallet.updated_at,
    };
  }

  /**
   * Check if bank wallet has sufficient funds for an operation
   */
  public async hasSufficientFunds(amount: number): Promise<boolean> {
    const bankWallet = await this.getBankWalletStatus();
    return bankWallet ? bankWallet.current_balance >= amount : false;
  }

  /**
   * Get bank wallet for transaction operations (used by TransactionService)
   */
  public async getBankWalletForTransactions(): Promise<BankWallet> {
    const bankWallet = await this.getBankWalletStatus();
    if (!bankWallet) {
      throw new BankWalletNotFoundError();
    }
    return bankWallet;
  }
}

/**
 * Export singleton instance for convenience
 */
export const bankService = BankService.getInstance();

/**
 * Export default singleton instance
 */
export default bankService;
