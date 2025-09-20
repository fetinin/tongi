/**
 * UserService - CRUD operations for User entity
 *
 * Provides comprehensive user management operations for the Corgi Buddy TON Mini-App.
 * Handles user creation, retrieval, updates, and Telegram authentication integration.
 *
 * Based on the data model specification in specs/001-you-need-to/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  User,
  CreateUserData,
  UpdateUserData,
  UserWithState,
  UserProfile,
  TelegramUser,
  UserValidation,
  UserUtils,
} from '@/models/User';
import type Database from 'better-sqlite3';

/**
 * Custom error types for UserService operations
 */
export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

export class UserNotFoundError extends UserServiceError {
  constructor(identifier: string | number) {
    super(`User not found: ${identifier}`, 'USER_NOT_FOUND', 404);
  }
}

export class UserValidationError extends UserServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UserConflictError extends UserServiceError {
  constructor(message: string) {
    super(message, 'CONFLICT_ERROR', 409);
  }
}

/**
 * Result type for findOrCreateUser operation
 */
export interface FindOrCreateResult {
  user: User;
  isNewUser: boolean;
}

/**
 * UserService class providing all user-related database operations
 */
export class UserService {
  private static instance: UserService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    getUserById: null as Database.Statement | null,
    getUserByUsername: null as Database.Statement | null,
    createUser: null as Database.Statement | null,
    updateUser: null as Database.Statement | null,
    deleteUser: null as Database.Statement | null,
    searchUsers: null as Database.Statement | null,
    checkUserExists: null as Database.Statement | null,
    updateWalletAddress: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.getUserById = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);

    this.statements.getUserByUsername = this.db.prepare(`
      SELECT * FROM users WHERE telegram_username = ?
    `);

    this.statements.createUser = this.db.prepare(`
      INSERT INTO users (id, telegram_username, first_name, ton_wallet_address)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    this.statements.updateUser = this.db.prepare(`
      UPDATE users
      SET telegram_username = ?, first_name = ?, ton_wallet_address = ?
      WHERE id = ?
      RETURNING *
    `);

    this.statements.deleteUser = this.db.prepare(`
      DELETE FROM users WHERE id = ?
    `);

    this.statements.searchUsers = this.db.prepare(`
      SELECT * FROM users
      WHERE telegram_username LIKE ?
      ORDER BY created_at DESC
      LIMIT 50
    `);

    this.statements.checkUserExists = this.db.prepare(`
      SELECT id FROM users WHERE id = ?
    `);

    this.statements.updateWalletAddress = this.db.prepare(`
      UPDATE users
      SET ton_wallet_address = ?
      WHERE id = ?
      RETURNING *
    `);
  }

  /**
   * Validate user data before database operations
   */
  private validateUserData(userData: CreateUserData | UpdateUserData): void {
    // Validate Telegram ID
    if ('id' in userData && !UserValidation.isValidTelegramId(userData.id)) {
      throw new UserValidationError('Invalid Telegram user ID');
    }

    // Validate first name
    if ('first_name' in userData && userData.first_name && !UserValidation.isValidFirstName(userData.first_name)) {
      throw new UserValidationError('Invalid first name: must be 1-64 characters');
    }

    // Validate username if provided
    if ('telegram_username' in userData && userData.telegram_username && !UserValidation.isValidUsername(userData.telegram_username)) {
      throw new UserValidationError('Invalid username: must be 5-32 alphanumeric characters or underscores');
    }

    // Validate TON wallet address if provided
    if ('ton_wallet_address' in userData && userData.ton_wallet_address && !UserValidation.isValidTonAddress(userData.ton_wallet_address)) {
      throw new UserValidationError('Invalid TON wallet address format');
    }
  }

  /**
   * Convert database row to User object with proper date parsing
   */
  private mapRowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as number,
      telegram_username: row.telegram_username as string | null,
      first_name: row.first_name as string,
      ton_wallet_address: row.ton_wallet_address as string | null,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  /**
   * Get user by Telegram ID
   */
  public async getUserById(id: number): Promise<User | null> {
    try {
      const row = this.statements.getUserById!.get(id);
      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      throw new UserServiceError(
        `Failed to retrieve user by ID: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get user by Telegram username
   */
  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      // Remove @ symbol if present
      const cleanUsername = username.replace(/^@/, '');
      const row = this.statements.getUserByUsername!.get(cleanUsername);
      return row ? this.mapRowToUser(row) : null;
    } catch (error) {
      throw new UserServiceError(
        `Failed to retrieve user by username: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Create a new user
   */
  public async createUser(userData: CreateUserData): Promise<User> {
    this.validateUserData(userData);

    try {
      return withTransaction(() => {
        // Check if user already exists
        const existingUser = this.statements.checkUserExists!.get(userData.id);
        if (existingUser) {
          throw new UserConflictError(`User with ID ${userData.id} already exists`);
        }

        // Create the user
        const row = this.statements.createUser!.get(
          userData.id,
          userData.telegram_username || null,
          userData.first_name,
          userData.ton_wallet_address || null
        );

        return this.mapRowToUser(row);
      });
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }

      // Handle database constraint violations
      if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new UserConflictError('Username already taken');
      }

      throw new UserServiceError(
        `Failed to create user: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update an existing user
   */
  public async updateUser(userData: UpdateUserData): Promise<User> {
    this.validateUserData(userData);

    try {
      return withTransaction(() => {
        // Check if user exists
        const existingUser = this.statements.getUserById!.get(userData.id);
        if (!existingUser) {
          throw new UserNotFoundError(userData.id);
        }

        // Update with provided values or keep existing ones
        const updatedRow = this.statements.updateUser!.get(
          userData.telegram_username !== undefined ? userData.telegram_username : existingUser.telegram_username,
          userData.first_name !== undefined ? userData.first_name : existingUser.first_name,
          userData.ton_wallet_address !== undefined ? userData.ton_wallet_address : existingUser.ton_wallet_address,
          userData.id
        );

        return this.mapRowToUser(updatedRow);
      });
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }

      // Handle database constraint violations
      if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new UserConflictError('Username already taken');
      }

      throw new UserServiceError(
        `Failed to update user: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Delete a user (cascade deletes related records)
   */
  public async deleteUser(id: number): Promise<boolean> {
    try {
      return withTransaction(() => {
        const result = this.statements.deleteUser!.run(id);
        return result.changes > 0;
      });
    } catch (error) {
      throw new UserServiceError(
        `Failed to delete user: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Find existing user or create new one from Telegram data
   * This is the main method for user authentication/registration
   */
  public async findOrCreateUser(telegramUser: TelegramUser): Promise<FindOrCreateResult> {
    try {
      // First, try to find existing user
      const existingUser = await this.getUserById(telegramUser.id);

      if (existingUser) {
        // Update user data if needed (Telegram data might have changed)
        const userData: UpdateUserData = {
          id: telegramUser.id,
          telegram_username: telegramUser.username || null,
          first_name: telegramUser.first_name,
          // Don't update wallet address - that's handled separately
        };

        const updatedUser = await this.updateUser(userData);
        return { user: updatedUser, isNewUser: false };
      }

      // Create new user
      const createData = UserUtils.fromTelegramUser(telegramUser);
      const newUser = await this.createUser(createData);
      return { user: newUser, isNewUser: true };

    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      throw new UserServiceError(
        `Failed to find or create user: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update user's TON wallet address
   */
  public async updateWalletAddress(userId: number, walletAddress: string): Promise<User> {
    // Validate wallet address
    if (!UserValidation.isValidTonAddress(walletAddress)) {
      throw new UserValidationError('Invalid TON wallet address format');
    }

    try {
      return withTransaction(() => {
        // Check if user exists
        const existingUser = this.statements.getUserById!.get(userId);
        if (!existingUser) {
          throw new UserNotFoundError(userId);
        }

        const updatedRow = this.statements.updateWalletAddress!.get(
          walletAddress,
          userId
        );

        return this.mapRowToUser(updatedRow);
      });
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      throw new UserServiceError(
        `Failed to update wallet address: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get user with computed state information
   * Requires checking buddy relationships (will be enhanced when BuddyService is available)
   */
  public async getUserWithState(userId: number): Promise<UserWithState | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return null;
      }

      // TODO: Check for buddy relationships when BuddyService is implemented
      // For now, assume no buddy relationships
      const hasBuddy = false;
      const state = UserUtils.getUserState(user, hasBuddy);

      return {
        ...user,
        state,
        hasWallet: Boolean(user.ton_wallet_address),
        hasBuddy,
      };
    } catch (error) {
      throw new UserServiceError(
        `Failed to get user with state: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Search users by username pattern (for buddy finding)
   */
  public async searchUsersByUsername(usernameQuery: string): Promise<UserProfile[]> {
    try {
      // Clean and validate search query
      const cleanQuery = usernameQuery.replace(/^@/, '').trim();
      if (cleanQuery.length < 2) {
        throw new UserValidationError('Search query must be at least 2 characters');
      }

      const searchPattern = `%${cleanQuery}%`;
      const rows = this.statements.searchUsers!.all(searchPattern);

      return rows.map((row) => {
        const user = this.mapRowToUser(row);
        return UserUtils.toProfile(user);
      });
    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }
      throw new UserServiceError(
        `Failed to search users: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if a user exists (lightweight check)
   */
  public async userExists(userId: number): Promise<boolean> {
    try {
      const result = this.statements.checkUserExists!.get(userId);
      return Boolean(result);
    } catch (error) {
      throw new UserServiceError(
        `Failed to check user existence: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const userService = UserService.getInstance();

/**
 * Export default singleton instance
 */
export default userService;