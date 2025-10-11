/**
 * WishService - Wish management operations
 *
 * Handles wish creation, approval/rejection, retrieval, and marketplace operations
 * for the Corgi Buddy TON Mini-App. Manages the complete wish lifecycle from
 * creation to purchase.
 *
 * Based on the data model specification in specs/001-initial-implementation/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  Wish,
  WishStatus,
  CreateWishInput,
  WishWithUsers,
  WishQueryParams,
  WishValidator,
  WishValidation,
  WishDefaults,
} from '@/models/Wish';
import { userService, UserNotFoundError } from '@/services/UserService';
import { buddyService, BuddyServiceError } from '@/services/BuddyService';
import { notificationService } from '@/services/NotificationService';
import type Database from 'better-sqlite3';

/**
 * Custom error types for WishService operations
 */
export class WishServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'WishServiceError';
  }
}

export class WishValidationError extends WishServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class WishNotFoundError extends WishServiceError {
  constructor(wishId: number) {
    super(`Wish not found: ${wishId}`, 'WISH_NOT_FOUND', 404);
  }
}

export class WishConflictError extends WishServiceError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', 400);
  }
}

export class WishAuthorizationError extends WishServiceError {
  constructor(message: string) {
    super(message, 'NOT_AUTHORIZED', 404);
  }
}

export class WishStateError extends WishServiceError {
  constructor(message: string) {
    super(message, 'INVALID_STATE', 400);
  }
}

/**
 * Result type for wish queries with metadata
 */
export interface WishQueryResult {
  wishes: WishWithUsers[];
  total: number;
  hasMore: boolean;
}

/**
 * Result type for marketplace queries
 */
export interface MarketplaceResult {
  wishes: WishWithUsers[];
  total: number;
  hasMore: boolean;
}

/**
 * Input for responding to wishes
 */
export interface WishResponseInput {
  wishId: number;
  userId: number;
  accepted: boolean;
}

/**
 * WishService class providing all wish-related database operations
 */
export class WishService {
  private static instance: WishService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    createWish: null as Database.Statement | null,
    getWishById: null as Database.Statement | null,
    getWishWithUsers: null as Database.Statement | null,
    updateWishStatus: null as Database.Statement | null,
    getUserWishes: null as Database.Statement | null,
    getPendingWishes: null as Database.Statement | null,
    getMarketplaceWishes: null as Database.Statement | null,
    countUserWishes: null as Database.Statement | null,
    countPendingWishes: null as Database.Statement | null,
    countMarketplaceWishes: null as Database.Statement | null,
    getUserWishesWithFilters: null as Database.Statement | null,
    countUserWishesWithFilters: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): WishService {
    if (!WishService.instance) {
      WishService.instance = new WishService();
    }
    return WishService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.createWish = this.db.prepare(`
      INSERT INTO wishes (creator_id, buddy_id, description, proposed_amount, status)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    this.statements.getWishById = this.db.prepare(`
      SELECT * FROM wishes WHERE id = ?
    `);

    this.statements.getWishWithUsers = this.db.prepare(`
      SELECT
        w.*,
        creator.first_name as creator_first_name,
        creator.telegram_username as creator_telegram_username,
        buddy.first_name as buddy_first_name,
        buddy.telegram_username as buddy_telegram_username,
        purchaser.first_name as purchaser_first_name,
        purchaser.telegram_username as purchaser_telegram_username
      FROM wishes w
      JOIN users creator ON w.creator_id = creator.id
      JOIN users buddy ON w.buddy_id = buddy.id
      LEFT JOIN users purchaser ON w.purchased_by = purchaser.id
      WHERE w.id = ?
    `);

    this.statements.updateWishStatus = this.db.prepare(`
      UPDATE wishes
      SET status = ?, accepted_at = ?, purchased_at = ?, purchased_by = ?
      WHERE id = ?
      RETURNING *
    `);

    this.statements.getUserWishes = this.db.prepare(`
      SELECT
        w.*,
        creator.first_name as creator_first_name,
        creator.telegram_username as creator_telegram_username,
        buddy.first_name as buddy_first_name,
        buddy.telegram_username as buddy_telegram_username,
        purchaser.first_name as purchaser_first_name,
        purchaser.telegram_username as purchaser_telegram_username
      FROM wishes w
      JOIN users creator ON w.creator_id = creator.id
      JOIN users buddy ON w.buddy_id = buddy.id
      LEFT JOIN users purchaser ON w.purchased_by = purchaser.id
      WHERE w.creator_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.getPendingWishes = this.db.prepare(`
      SELECT
        w.*,
        creator.first_name as creator_first_name,
        creator.telegram_username as creator_telegram_username,
        buddy.first_name as buddy_first_name,
        buddy.telegram_username as buddy_telegram_username
      FROM wishes w
      JOIN users creator ON w.creator_id = creator.id
      JOIN users buddy ON w.buddy_id = buddy.id
      WHERE w.buddy_id = ? AND w.status = 'pending'
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.getMarketplaceWishes = this.db.prepare(`
      SELECT
        w.*,
        creator.first_name as creator_first_name,
        creator.telegram_username as creator_telegram_username,
        buddy.first_name as buddy_first_name,
        buddy.telegram_username as buddy_telegram_username
      FROM wishes w
      JOIN users creator ON w.creator_id = creator.id
      JOIN users buddy ON w.buddy_id = buddy.id
      WHERE w.status = 'accepted'
      ORDER BY w.accepted_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.countUserWishes = this.db.prepare(`
      SELECT COUNT(*) as count FROM wishes WHERE creator_id = ?
    `);

    this.statements.countPendingWishes = this.db.prepare(`
      SELECT COUNT(*) as count FROM wishes WHERE buddy_id = ? AND status = 'pending'
    `);

    this.statements.countMarketplaceWishes = this.db.prepare(`
      SELECT COUNT(*) as count FROM wishes WHERE status = 'accepted'
    `);

    this.statements.getUserWishesWithFilters = this.db.prepare(`
      SELECT
        w.*,
        creator.first_name as creator_first_name,
        creator.telegram_username as creator_telegram_username,
        buddy.first_name as buddy_first_name,
        buddy.telegram_username as buddy_telegram_username,
        purchaser.first_name as purchaser_first_name,
        purchaser.telegram_username as purchaser_telegram_username
      FROM wishes w
      JOIN users creator ON w.creator_id = creator.id
      JOIN users buddy ON w.buddy_id = buddy.id
      LEFT JOIN users purchaser ON w.purchased_by = purchaser.id
      WHERE w.creator_id = ? AND w.status = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.statements.countUserWishesWithFilters = this.db.prepare(`
      SELECT COUNT(*) as count FROM wishes WHERE creator_id = ? AND status = ?
    `);
  }

  /**
   * Convert database row to Wish object with proper type conversion
   */
  private mapRowToWish(row: Record<string, unknown>): Wish {
    return {
      id: row.id as number,
      creator_id: row.creator_id as number,
      buddy_id: row.buddy_id as number,
      description: row.description as string,
      proposed_amount: row.proposed_amount as number,
      status: row.status as WishStatus,
      created_at: row.created_at as string,
      accepted_at: row.accepted_at as string | null,
      purchased_at: row.purchased_at as string | null,
      purchased_by: row.purchased_by as number | null,
    };
  }

  /**
   * Convert database row with user joins to WishWithUsers object
   */
  private mapRowToWishWithUsers(row: Record<string, unknown>): WishWithUsers {
    const wish = this.mapRowToWish(row as Record<string, unknown>);

    return {
      ...wish,
      creator: {
        id: wish.creator_id,
        first_name: row.creator_first_name as string,
        telegram_username: row.creator_telegram_username as string | null,
      },
      buddy: {
        id: wish.buddy_id,
        first_name: row.buddy_first_name as string,
        telegram_username: row.buddy_telegram_username as string | null,
      },
      purchaser: row.purchaser_first_name
        ? {
            id: wish.purchased_by!,
            first_name: row.purchaser_first_name as string,
            telegram_username: row.purchaser_telegram_username as string | null,
          }
        : undefined,
    };
  }

  /**
   * Create a new wish
   */
  public async createWish(
    creatorId: number,
    description: string,
    proposedAmount: number
  ): Promise<WishWithUsers> {
    // Validate description and amount first
    if (!WishValidator.isValidDescription(description)) {
      throw new WishValidationError(
        `Description must be ${WishValidation.DESCRIPTION_MIN_LENGTH}-${WishValidation.DESCRIPTION_MAX_LENGTH} characters`
      );
    }

    if (!WishValidator.isValidAmount(proposedAmount)) {
      throw new WishValidationError(
        `Proposed amount must be between ${WishValidation.AMOUNT_MIN} and ${WishValidation.AMOUNT_MAX}`
      );
    }

    try {
      // Get user's active buddy outside transaction
      const buddyStatus = await buddyService.getBuddyStatus(creatorId);
      if (
        !buddyStatus ||
        buddyStatus.status !== 'active' ||
        !buddyStatus.buddy
      ) {
        throw new WishConflictError(
          'User must have an active buddy relationship to create wishes'
        );
      }

      const creatorUser = await userService.getUserById(creatorId);
      if (!creatorUser) {
        throw new UserNotFoundError(creatorId);
      }

      const buddyId = buddyStatus.buddy!.id;

      // Validate user pair (description and amount already validated above)
      if (!WishValidator.isValidUserPair(creatorId, buddyId)) {
        throw new WishValidationError(
          'Creator and buddy must be different valid users'
        );
      }

      const result = withTransaction(() => {
        // Create the wish
        const row = this.statements.createWish!.get(
          creatorId,
          buddyId,
          description,
          proposedAmount,
          WishDefaults.status
        );

        const wish = this.mapRowToWish(row as Record<string, unknown>);

        // Get the wish with user information
        const wishWithUsersRow = this.statements.getWishWithUsers!.get(wish.id);
        return this.mapRowToWishWithUsers(
          wishWithUsersRow as Record<string, unknown>
        );
      });
      // Notify buddy about new wish
      if (buddyStatus.buddy) {
        await notificationService
          .notifyWishCreated(
            buddyStatus.buddy.id,
            creatorUser.first_name,
            description,
            proposedAmount
          )
          .catch(() => {});
      }
      return result;
    } catch (error) {
      if (
        error instanceof WishServiceError ||
        error instanceof UserNotFoundError ||
        error instanceof BuddyServiceError
      ) {
        throw error;
      }

      throw new WishServiceError(
        `Failed to create wish: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get wish by ID
   */
  public async getWishById(wishId: number): Promise<Wish | null> {
    try {
      const row = this.statements.getWishById!.get(wishId);
      return row ? this.mapRowToWish(row as Record<string, unknown>) : null;
    } catch (error) {
      throw new WishServiceError(
        `Failed to get wish by ID: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get wish with user information by ID
   */
  public async getWishWithUsersById(
    wishId: number
  ): Promise<WishWithUsers | null> {
    try {
      const row = this.statements.getWishWithUsers!.get(wishId);
      return row
        ? this.mapRowToWishWithUsers(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new WishServiceError(
        `Failed to get wish with users: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Respond to a wish (accept or reject)
   */
  public async respondToWish(input: WishResponseInput): Promise<WishWithUsers> {
    const { wishId, userId, accepted } = input;

    if (typeof accepted !== 'boolean') {
      throw new WishValidationError(
        'Response must include a boolean "accepted" field'
      );
    }

    try {
      // Get the wish outside transaction
      const wish = await this.getWishById(wishId);
      if (!wish) {
        throw new WishNotFoundError(wishId);
      }

      const buddyUser = await userService.getUserById(userId);
      if (!buddyUser) {
        throw new UserNotFoundError(userId);
      }

      const result = withTransaction(() => {
        // Verify the user is the buddy for this wish
        if (wish.buddy_id !== userId) {
          throw new WishAuthorizationError(
            'User is not authorized to respond to this wish'
          );
        }

        // Verify the wish is in pending status
        if (wish.status !== 'pending') {
          if (wish.status === 'accepted' || wish.status === 'rejected') {
            throw new WishStateError('Wish has already been responded to');
          } else if (wish.status === 'purchased') {
            throw new WishStateError(
              'Wish has already been purchased and cannot be modified'
            );
          } else {
            throw new WishStateError(
              `Cannot respond to wish in ${wish.status} status`
            );
          }
        }

        // Verify the user is not trying to respond to their own wish
        if (wish.creator_id === userId) {
          throw new WishConflictError('Cannot respond to your own wish');
        }

        // Update the wish status
        const newStatus: WishStatus = accepted ? 'accepted' : 'rejected';
        const acceptedAt = new Date().toISOString();

        const updatedRow = this.statements.updateWishStatus!.get(
          newStatus,
          acceptedAt,
          null, // purchased_at
          null, // purchased_by
          wishId
        );

        this.mapRowToWish(updatedRow as Record<string, unknown>);

        // Get the updated wish with user information
        const wishWithUsersRow = this.statements.getWishWithUsers!.get(wishId);
        return this.mapRowToWishWithUsers(
          wishWithUsersRow as Record<string, unknown>
        );
      });
      // Notify creator about buddy response
      const updated = await this.getWishWithUsersById(wishId);
      if (updated) {
        await notificationService
          .notifyWishResponded(
            updated.creator_id,
            buddyUser.first_name,
            input.accepted,
            updated.description
          )
          .catch(() => {});
      }
      return result;
    } catch (error) {
      if (error instanceof WishServiceError) {
        throw error;
      }

      throw new WishServiceError(
        `Failed to respond to wish: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get wishes created by a user
   */
  public async getUserWishes(
    userId: number,
    params: WishQueryParams = {}
  ): Promise<WishQueryResult> {
    try {
      const limit = Math.min(params.limit || 50, 100);
      const offset = params.offset || 0;

      let rows: Record<string, unknown>[];
      let countResult: { count: number };

      if (params.status) {
        // Filter by status
        rows = this.statements.getUserWishesWithFilters!.all(
          userId,
          params.status,
          limit,
          offset
        ) as Record<string, unknown>[];
        countResult = this.statements.countUserWishesWithFilters!.get(
          userId,
          params.status
        ) as { count: number };
      } else {
        // Get all wishes for user
        rows = this.statements.getUserWishes!.all(
          userId,
          limit,
          offset
        ) as Record<string, unknown>[];
        countResult = this.statements.countUserWishes!.get(userId) as {
          count: number;
        };
      }

      const wishes = rows.map((row) =>
        this.mapRowToWishWithUsers(row as Record<string, unknown>)
      );
      const total = countResult.count;
      const hasMore = offset + limit < total;

      return {
        wishes,
        total,
        hasMore,
      };
    } catch (error) {
      throw new WishServiceError(
        `Failed to get user wishes: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get pending wishes for a user to approve
   */
  public async getPendingWishes(
    buddyId: number,
    params: WishQueryParams = {}
  ): Promise<WishQueryResult> {
    try {
      const limit = Math.min(params.limit || 50, 100);
      const offset = params.offset || 0;

      const rows = this.statements.getPendingWishes!.all(
        buddyId,
        limit,
        offset
      ) as Record<string, unknown>[];
      const countResult = this.statements.countPendingWishes!.get(buddyId) as {
        count: number;
      };

      const wishes = rows.map((row) =>
        this.mapRowToWishWithUsers(row as Record<string, unknown>)
      );
      const total = countResult.count;
      const hasMore = offset + limit < total;

      return {
        wishes,
        total,
        hasMore,
      };
    } catch (error) {
      throw new WishServiceError(
        `Failed to get pending wishes: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get marketplace wishes (accepted wishes available for purchase)
   */
  public async getMarketplaceWishes(
    params: WishQueryParams = {}
  ): Promise<MarketplaceResult> {
    try {
      const limit = Math.min(params.limit || 50, 100);
      const offset = params.offset || 0;

      const rows = this.statements.getMarketplaceWishes!.all(
        limit,
        offset
      ) as Record<string, unknown>[];
      const countResult = this.statements.countMarketplaceWishes!.get() as {
        count: number;
      };

      const wishes = rows.map((row) =>
        this.mapRowToWishWithUsers(row as Record<string, unknown>)
      );
      const total = countResult.count;
      const hasMore = offset + limit < total;

      return {
        wishes,
        total,
        hasMore,
      };
    } catch (error) {
      throw new WishServiceError(
        `Failed to get marketplace wishes: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Purchase a wish (mark as purchased)
   */
  public async purchaseWish(
    wishId: number,
    purchaserId: number
  ): Promise<WishWithUsers> {
    try {
      // Get the wish outside transaction
      const wish = await this.getWishById(wishId);
      if (!wish) {
        throw new WishNotFoundError(wishId);
      }

      const purchaser = await userService.getUserById(purchaserId);
      if (!purchaser) {
        throw new UserNotFoundError(purchaserId);
      }

      const result = withTransaction(() => {
        // Verify the wish is in accepted status
        if (wish.status !== 'accepted') {
          if (wish.status === 'pending') {
            throw new WishStateError(
              'Wish must be accepted before it can be purchased'
            );
          } else if (wish.status === 'rejected') {
            throw new WishStateError('Cannot purchase a rejected wish');
          } else if (wish.status === 'purchased') {
            throw new WishStateError('Wish has already been purchased');
          } else {
            throw new WishStateError(
              `Cannot purchase wish in ${wish.status} status`
            );
          }
        }

        // Verify purchaser exists
        if (!userService.userExists(purchaserId)) {
          throw new UserNotFoundError(purchaserId);
        }

        // Verify purchaser is not the creator or buddy
        if (wish.creator_id === purchaserId) {
          throw new WishConflictError('Cannot purchase your own wish');
        }
        if (wish.buddy_id === purchaserId) {
          throw new WishConflictError('Cannot purchase a wish you approved');
        }

        // Update the wish to purchased status
        const purchasedAt = new Date().toISOString();

        const updatedRow = this.statements.updateWishStatus!.get(
          'purchased',
          wish.accepted_at, // Keep original accepted_at
          purchasedAt,
          purchaserId,
          wishId
        );

        this.mapRowToWish(updatedRow as Record<string, unknown>);

        // Get the updated wish with user information
        const wishWithUsersRow = this.statements.getWishWithUsers!.get(wishId);
        return this.mapRowToWishWithUsers(
          wishWithUsersRow as Record<string, unknown>
        );
      });
      // Notify creator that wish was purchased
      const updated = await this.getWishWithUsersById(wishId);
      if (updated) {
        await notificationService
          .notifyWishPurchased(
            updated.creator_id,
            purchaser.first_name,
            updated.description,
            updated.proposed_amount
          )
          .catch(() => {});
      }
      return result;
    } catch (error) {
      if (
        error instanceof WishServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }

      throw new WishServiceError(
        `Failed to purchase wish: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if user has permission to access a wish
   */
  public async hasWishAccess(wishId: number, userId: number): Promise<boolean> {
    try {
      const wish = await this.getWishById(wishId);
      if (!wish) {
        return false;
      }

      // Creator and buddy always have access
      return wish.creator_id === userId || wish.buddy_id === userId;
    } catch {
      return false;
    }
  }

  /**
   * Validate wish ID parameter
   */
  public static validateWishId(wishId: string | number): number {
    const id = typeof wishId === 'string' ? parseInt(wishId, 10) : wishId;

    if (isNaN(id) || id <= 0 || !Number.isInteger(id)) {
      throw new WishValidationError(
        'Invalid wish ID: must be a positive integer'
      );
    }

    return id;
  }
}

/**
 * Export singleton instance for convenience
 */
export const wishService = WishService.getInstance();

/**
 * Export default singleton instance
 */
export default wishService;
