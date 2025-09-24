/**
 * BuddyService - Relationship management for User buddy pairs
 *
 * Handles buddy relationship operations for the Corgi Buddy TON Mini-App.
 * Manages buddy requests, confirmations, status checking, and user searching.
 *
 * Based on the data model specification in specs/001-you-need-to/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  BuddyPair,
  BuddyPairStatus,
  CreateBuddyPairInput,
  BuddyPairValidator,
  BuddyPairUtils,
  rowToBuddyPair,
  BuddyPairRow,
} from '@/models/BuddyPair';
import { UserProfile, UserUtils } from '@/models/User';
import { userService, UserNotFoundError } from '@/services/UserService';
import type Database from 'better-sqlite3';

/**
 * Custom error types for BuddyService operations
 */
export class BuddyServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'BuddyServiceError';
  }
}

export class BuddyValidationError extends BuddyServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class BuddyConflictError extends BuddyServiceError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', 400);
  }
}

export class BuddyNotFoundError extends BuddyServiceError {
  constructor(message: string) {
    super(message, 'BUDDY_NOT_FOUND', 404);
  }
}

/**
 * Result type for buddy search operation
 */
export interface BuddySearchResult {
  users: UserProfile[];
  hasMore: boolean;
}

/**
 * Enhanced buddy pair with user profile information
 */
export interface BuddyPairWithProfile {
  id: number;
  buddy: UserProfile;
  status: BuddyPairStatus;
  createdAt: string;
  confirmedAt: string | null;
  initiatedBy?: number;
}

/**
 * Result for buddy status check
 */
export interface BuddyStatusResult {
  status: 'no_buddy' | BuddyPairStatus;
  message?: string;
  id?: number;
  buddy?: UserProfile;
  createdAt?: string;
  confirmedAt?: string | null;
  initiatedBy?: number;
}

/**
 * BuddyService class providing all buddy relationship operations
 */
export class BuddyService {
  private static instance: BuddyService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    createBuddyPair: null as Database.Statement | null,
    getBuddyPairById: null as Database.Statement | null,
    getBuddyPairByUsers: null as Database.Statement | null,
    getBuddyPairForUser: null as Database.Statement | null,
    updateBuddyPairStatus: null as Database.Statement | null,
    checkExistingRelationship: null as Database.Statement | null,
    getUserActiveBuddy: null as Database.Statement | null,
    getUserPendingBuddy: null as Database.Statement | null,
    dissolveBuddyPair: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): BuddyService {
    if (!BuddyService.instance) {
      BuddyService.instance = new BuddyService();
    }
    return BuddyService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.createBuddyPair = this.db.prepare(`
      INSERT INTO buddy_pairs (user1_id, user2_id, initiated_by, status)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    this.statements.getBuddyPairById = this.db.prepare(`
      SELECT * FROM buddy_pairs WHERE id = ?
    `);

    this.statements.getBuddyPairByUsers = this.db.prepare(`
      SELECT * FROM buddy_pairs
      WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `);

    this.statements.getBuddyPairForUser = this.db.prepare(`
      SELECT * FROM buddy_pairs
      WHERE (user1_id = ? OR user2_id = ?) AND status IN ('pending', 'active')
      ORDER BY created_at DESC
      LIMIT 1
    `);

    this.statements.updateBuddyPairStatus = this.db.prepare(`
      UPDATE buddy_pairs
      SET status = ?, confirmed_at = ?
      WHERE id = ?
      RETURNING *
    `);

    this.statements.checkExistingRelationship = this.db.prepare(`
      SELECT id, status FROM buddy_pairs
      WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
      AND status IN ('pending', 'active')
    `);

    this.statements.getUserActiveBuddy = this.db.prepare(`
      SELECT * FROM buddy_pairs
      WHERE (user1_id = ? OR user2_id = ?) AND status = 'active'
    `);

    this.statements.getUserPendingBuddy = this.db.prepare(`
      SELECT * FROM buddy_pairs
      WHERE (user1_id = ? OR user2_id = ?) AND status = 'pending'
    `);

    this.statements.dissolveBuddyPair = this.db.prepare(`
      UPDATE buddy_pairs
      SET status = 'dissolved'
      WHERE id = ?
      RETURNING *
    `);
  }

  /**
   * Convert database row to BuddyPair with proper type conversion
   */
  private mapRowToBuddyPair(row: Record<string, unknown>): BuddyPair {
    return rowToBuddyPair(row as unknown as BuddyPairRow);
  }

  /**
   * Create a new buddy pair (send buddy request)
   */
  public async createBuddyRequest(
    requesterId: number,
    targetUserId: number
  ): Promise<BuddyPairWithProfile> {
    // Validate input
    const [user1_id, user2_id] = BuddyPairUtils.normalizeUserIds(
      requesterId,
      targetUserId
    );

    const createInput: CreateBuddyPairInput = {
      user1_id,
      user2_id,
      initiated_by: requesterId,
    };

    const validationErrors =
      BuddyPairValidator.validateCreateInput(createInput);
    if (validationErrors.length > 0) {
      throw new BuddyValidationError(validationErrors[0]);
    }

    try {
      // Get the target user's profile outside transaction
      const targetUser = await userService.getUserById(targetUserId);
      if (!targetUser) {
        throw new UserNotFoundError(targetUserId);
      }

      return withTransaction(() => {
        // Check if both users exist
        if (!userService.userExists(requesterId)) {
          throw new UserNotFoundError(requesterId);
        }
        if (!userService.userExists(targetUserId)) {
          throw new UserNotFoundError(targetUserId);
        }

        // Check if requester already has an active or pending buddy
        const existingRequesterRelationship =
          this.statements.getBuddyPairForUser!.get(requesterId, requesterId);
        if (existingRequesterRelationship) {
          throw new BuddyConflictError(
            'User already has an active or pending buddy relationship'
          );
        }

        // Check if target user already has an active or pending buddy
        const existingTargetRelationship =
          this.statements.getBuddyPairForUser!.get(targetUserId, targetUserId);
        if (existingTargetRelationship) {
          throw new BuddyConflictError(
            'Target user already has an active or pending buddy relationship'
          );
        }

        // Check if relationship already exists between these users
        const existingRelationship =
          this.statements.checkExistingRelationship!.get(
            user1_id,
            user2_id,
            user2_id,
            user1_id
          );
        if (existingRelationship) {
          throw new BuddyConflictError(
            'Buddy relationship already exists between these users'
          );
        }

        // Create the buddy pair
        const row = this.statements.createBuddyPair!.get(
          user1_id,
          user2_id,
          requesterId,
          BuddyPairStatus.PENDING
        );

        const buddyPair = this.mapRowToBuddyPair(
          row as Record<string, unknown>
        );

        // Convert target user to profile
        const buddyProfile: UserProfile = UserUtils.toProfile(targetUser);

        return {
          id: buddyPair.id,
          buddy: buddyProfile,
          status: buddyPair.status,
          createdAt: buddyPair.created_at,
          confirmedAt: buddyPair.confirmed_at,
          initiatedBy: buddyPair.initiated_by,
        };
      });
    } catch (error) {
      if (
        error instanceof BuddyServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ) {
        throw new BuddyConflictError(
          'Buddy relationship already exists between these users'
        );
      }

      throw new BuddyServiceError(
        `Failed to create buddy request: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get buddy status for a user
   */
  public async getBuddyStatus(userId: number): Promise<BuddyStatusResult> {
    try {
      // Check if user exists
      if (!(await userService.userExists(userId))) {
        throw new UserNotFoundError(userId);
      }

      // First check for active buddy
      const activeBuddy = this.statements.getUserActiveBuddy!.get(
        userId,
        userId
      );
      if (activeBuddy) {
        const buddyPair = this.mapRowToBuddyPair(
          activeBuddy as Record<string, unknown>
        );
        const buddyId = BuddyPairUtils.getBuddyId(buddyPair, userId);

        if (buddyId) {
          const buddyUser = await userService.getUserById(buddyId);
          if (buddyUser) {
            const buddyProfile: UserProfile = UserUtils.toProfile(buddyUser);

            return {
              status: buddyPair.status,
              id: buddyPair.id,
              buddy: buddyProfile,
              createdAt: buddyPair.created_at,
              confirmedAt: buddyPair.confirmed_at,
              initiatedBy: buddyPair.initiated_by,
            };
          }
        }
      }

      // Check for pending buddy
      const pendingBuddy = this.statements.getUserPendingBuddy!.get(
        userId,
        userId
      );
      if (pendingBuddy) {
        const buddyPair = this.mapRowToBuddyPair(
          pendingBuddy as Record<string, unknown>
        );
        const buddyId = BuddyPairUtils.getBuddyId(buddyPair, userId);

        if (buddyId) {
          const buddyUser = await userService.getUserById(buddyId);
          if (buddyUser) {
            const buddyProfile: UserProfile = UserUtils.toProfile(buddyUser);

            return {
              status: buddyPair.status,
              id: buddyPair.id,
              buddy: buddyProfile,
              createdAt: buddyPair.created_at,
              confirmedAt: buddyPair.confirmed_at,
              initiatedBy: buddyPair.initiated_by,
            };
          }
        }
      }

      // No buddy relationship found
      return {
        status: 'no_buddy',
        message: 'No active buddy relationship',
      };
    } catch (error) {
      if (
        error instanceof BuddyServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new BuddyServiceError(
        `Failed to get buddy status: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Confirm a pending buddy request (make it active)
   */
  public async confirmBuddyRequest(
    buddyPairId: number,
    confirmingUserId: number
  ): Promise<BuddyPairWithProfile> {
    try {
      // Get the buddy pair first to determine buddy user
      const row = this.statements.getBuddyPairById!.get(buddyPairId);
      if (!row) {
        throw new BuddyNotFoundError('Buddy pair not found');
      }

      const buddyPair = this.mapRowToBuddyPair(row as Record<string, unknown>);
      const buddyId = BuddyPairUtils.getBuddyId(buddyPair, confirmingUserId);
      if (!buddyId) {
        throw new BuddyServiceError(
          'Could not determine buddy ID',
          'INTERNAL_ERROR'
        );
      }

      // Fetch buddy user before transaction
      const buddyUser = await userService.getUserById(buddyId);
      if (!buddyUser) {
        throw new UserNotFoundError(buddyId);
      }

      return withTransaction(() => {
        // Re-get the buddy pair in case it changed
        const row = this.statements.getBuddyPairById!.get(buddyPairId);
        if (!row) {
          throw new BuddyNotFoundError('Buddy pair not found');
        }

        const buddyPair = this.mapRowToBuddyPair(
          row as Record<string, unknown>
        );

        // Verify the confirming user is part of this relationship
        if (!BuddyPairUtils.isUserInPair(buddyPair, confirmingUserId)) {
          throw new BuddyValidationError('User is not part of this buddy pair');
        }

        // Verify the relationship is pending
        if (buddyPair.status !== BuddyPairStatus.PENDING) {
          throw new BuddyConflictError('Buddy pair is not in pending status');
        }

        // Verify the confirming user is not the one who initiated the request
        if (buddyPair.initiated_by === confirmingUserId) {
          throw new BuddyConflictError('Cannot confirm your own buddy request');
        }

        // Update to active status
        const confirmedAt = new Date().toISOString();
        const updatedRow = this.statements.updateBuddyPairStatus!.get(
          BuddyPairStatus.ACTIVE,
          confirmedAt,
          buddyPairId
        );

        const updatedBuddyPair = this.mapRowToBuddyPair(
          updatedRow as Record<string, unknown>
        );

        // Convert buddy user to profile (already fetched outside transaction)
        const buddyProfile: UserProfile = UserUtils.toProfile(buddyUser);

        return {
          id: updatedBuddyPair.id,
          buddy: buddyProfile,
          status: updatedBuddyPair.status,
          createdAt: updatedBuddyPair.created_at,
          confirmedAt: updatedBuddyPair.confirmed_at,
          initiatedBy: updatedBuddyPair.initiated_by,
        };
      });
    } catch (error) {
      if (
        error instanceof BuddyServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new BuddyServiceError(
        `Failed to confirm buddy request: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Dissolve an active buddy relationship
   */
  public async dissolveBuddyRelationship(
    buddyPairId: number,
    requestingUserId: number
  ): Promise<boolean> {
    try {
      return withTransaction(() => {
        // Get the buddy pair
        const row = this.statements.getBuddyPairById!.get(buddyPairId);
        if (!row) {
          throw new BuddyNotFoundError('Buddy pair not found');
        }

        const buddyPair = this.mapRowToBuddyPair(
          row as Record<string, unknown>
        );

        // Verify the requesting user is part of this relationship
        if (!BuddyPairUtils.isUserInPair(buddyPair, requestingUserId)) {
          throw new BuddyValidationError('User is not part of this buddy pair');
        }

        // Verify the relationship is active
        if (buddyPair.status !== BuddyPairStatus.ACTIVE) {
          throw new BuddyConflictError(
            'Can only dissolve active buddy relationships'
          );
        }

        // Update to dissolved status
        const result = this.statements.dissolveBuddyPair!.run(buddyPairId);
        return result.changes > 0;
      });
    } catch (error) {
      if (error instanceof BuddyServiceError) {
        throw error;
      }
      throw new BuddyServiceError(
        `Failed to dissolve buddy relationship: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Search for users by username (for finding potential buddies)
   */
  public async searchUsers(
    query: string,
    searchingUserId: number,
    limit: number = 20
  ): Promise<BuddySearchResult> {
    try {
      // Use UserService to search for users
      const users = await userService.searchUsersByUsername(query);

      // Filter out the searching user
      const filteredUsers = users.filter((user) => user.id !== searchingUserId);

      // Limit results
      const limitedUsers = filteredUsers.slice(0, limit);
      const hasMore = filteredUsers.length > limit;

      return {
        users: limitedUsers,
        hasMore,
      };
    } catch (error) {
      if (error instanceof BuddyServiceError) {
        throw error;
      }
      throw new BuddyServiceError(
        `Failed to search users: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get buddy pair by ID
   */
  public async getBuddyPairById(id: number): Promise<BuddyPair | null> {
    try {
      const row = this.statements.getBuddyPairById!.get(id);
      return row
        ? this.mapRowToBuddyPair(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new BuddyServiceError(
        `Failed to get buddy pair: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if two users have any relationship (active, pending, or dissolved)
   */
  public async getUsersRelationship(
    user1Id: number,
    user2Id: number
  ): Promise<BuddyPair | null> {
    try {
      const [normalizedUser1, normalizedUser2] =
        BuddyPairUtils.normalizeUserIds(user1Id, user2Id);
      const row = this.statements.getBuddyPairByUsers!.get(
        normalizedUser1,
        normalizedUser2,
        normalizedUser2,
        normalizedUser1
      );
      return row
        ? this.mapRowToBuddyPair(row as Record<string, unknown>)
        : null;
    } catch (error) {
      throw new BuddyServiceError(
        `Failed to get user relationship: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if user has an active buddy
   */
  public async hasActiveBuddy(userId: number): Promise<boolean> {
    try {
      const activeBuddy = this.statements.getUserActiveBuddy!.get(
        userId,
        userId
      );
      return Boolean(activeBuddy);
    } catch (error) {
      throw new BuddyServiceError(
        `Failed to check active buddy: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const buddyService = BuddyService.getInstance();

/**
 * Export default singleton instance
 */
export default buddyService;
