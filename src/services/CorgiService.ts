/**
 * CorgiService - Sighting operations for Corgi reporting and confirmation
 *
 * Handles corgi sighting operations for the Corgi Buddy TON Mini-App.
 * Manages sighting creation, buddy confirmations, status updates, and history tracking.
 *
 * Based on the data model specification in specs/001-initial-implementation/data-model.md
 */

import { getDatabase, withTransaction } from '@/lib/database';
import {
  CorgiSighting,
  CorgiSightingStatus,
  CreateCorgiSightingInput,
  UpdateCorgiSightingInput,
  CorgiSightingValidator,
  CORGI_SIGHTING_VALIDATION,
  CORGI_SIGHTING_QUERIES,
} from '@/models/CorgiSighting';
import { buddyService, BuddyServiceError } from '@/services/BuddyService';
import { userService, UserNotFoundError } from '@/services/UserService';
import { notificationService } from '@/services/NotificationService';
import type Database from 'better-sqlite3';

/**
 * Custom error types for CorgiService operations
 */
export class CorgiServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CorgiServiceError';
  }
}

export class CorgiValidationError extends CorgiServiceError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class CorgiConflictError extends CorgiServiceError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', 400);
  }
}

export class CorgiNotFoundError extends CorgiServiceError {
  constructor(message: string) {
    super(message, 'SIGHTING_NOT_FOUND', 404);
  }
}

export class NoBuddyError extends CorgiServiceError {
  constructor(message: string) {
    super(message, 'NO_ACTIVE_BUDDY', 400);
  }
}

/**
 * Result type for sighting operations
 */
export interface SightingResult {
  sighting: CorgiSighting;
  rewardEarned?: number; // Corgi coins earned (only for confirmed sightings)
}

/**
 * Result type for confirmations list
 */
export interface ConfirmationsResult {
  confirmations: CorgiSighting[];
}

/**
 * Result type for sighting history
 */
export interface SightingHistoryResult {
  sightings: CorgiSighting[];
  totalCount: number;
  totalRewards: number; // Total Corgi coins earned from confirmed sightings
}

/**
 * CorgiService class providing all corgi sighting operations
 */
export class CorgiService {
  private static instance: CorgiService;
  private db: Database.Database;

  /**
   * Prepared statements for performance optimization
   */
  private statements = {
    createSighting: null as Database.Statement | null,
    getSightingById: null as Database.Statement | null,
    getPendingForBuddy: null as Database.Statement | null,
    getPendingForReporter: null as Database.Statement | null,
    getByReporter: null as Database.Statement | null,
    getByBuddy: null as Database.Statement | null,
    getConfirmedForReporter: null as Database.Statement | null,
    updateSightingStatus: null as Database.Statement | null,
  };

  private constructor() {
    this.db = getDatabase();
    this.initializeStatements();
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): CorgiService {
    if (!CorgiService.instance) {
      CorgiService.instance = new CorgiService();
    }
    return CorgiService.instance;
  }

  /**
   * Initialize prepared statements for optimized database access
   */
  private initializeStatements(): void {
    this.statements.createSighting = this.db.prepare(
      CORGI_SIGHTING_QUERIES.CREATE
    );

    this.statements.getSightingById = this.db.prepare(
      CORGI_SIGHTING_QUERIES.BY_ID
    );

    this.statements.getPendingForBuddy = this.db.prepare(
      CORGI_SIGHTING_QUERIES.PENDING_FOR_BUDDY
    );

    this.statements.getPendingForReporter = this.db.prepare(
      CORGI_SIGHTING_QUERIES.PENDING_FOR_REPORTER
    );

    this.statements.getByReporter = this.db.prepare(
      CORGI_SIGHTING_QUERIES.BY_REPORTER
    );

    this.statements.getByBuddy = this.db.prepare(
      CORGI_SIGHTING_QUERIES.BY_BUDDY
    );

    this.statements.getConfirmedForReporter = this.db.prepare(
      CORGI_SIGHTING_QUERIES.CONFIRMED_FOR_REPORTER
    );

    this.statements.updateSightingStatus = this.db.prepare(
      CORGI_SIGHTING_QUERIES.UPDATE_STATUS
    );
  }

  /**
   * Convert database row to CorgiSighting with proper type conversion
   */
  private mapRowToSighting(row: Record<string, unknown>): CorgiSighting {
    return {
      id: row.id as number,
      reporter_id: row.reporter_id as number,
      buddy_id: row.buddy_id as number,
      corgi_count: row.corgi_count as number,
      status: row.status as CorgiSightingStatus,
      created_at: row.created_at as string,
      responded_at: row.responded_at as string | null,
    };
  }

  /**
   * Create a new corgi sighting (report sighting)
   */
  public async createSighting(
    reporterId: number,
    corgiCount: number
  ): Promise<SightingResult> {
    try {
      // First, get the reporter's active buddy
      const buddyStatus = await buddyService.getBuddyStatus(reporterId);
      if (buddyStatus.status !== 'active' || !buddyStatus.buddy) {
        throw new NoBuddyError(
          'User must have an active buddy to report corgi sightings'
        );
      }

      const buddyId = buddyStatus.buddy.id;

      // Validate input
      const createInput: CreateCorgiSightingInput = {
        reporter_id: reporterId,
        buddy_id: buddyId,
        corgi_count: corgiCount,
      };

      const validationErrors =
        CorgiSightingValidator.validateCreateInput(createInput);
      if (validationErrors.length > 0) {
        throw new CorgiValidationError(validationErrors[0]);
      }

      const reporterUser = await userService.getUserById(reporterId);
      if (!reporterUser) {
        throw new UserNotFoundError(reporterId);
      }

      const result = withTransaction(() => {
        // Check if both users still exist
        if (!userService.userExists(reporterId)) {
          throw new UserNotFoundError(reporterId);
        }
        if (!userService.userExists(buddyId)) {
          throw new UserNotFoundError(buddyId);
        }

        // Create the sighting
        const createdAt = new Date().toISOString();
        const result = this.statements.createSighting!.run(
          reporterId,
          buddyId,
          corgiCount,
          CORGI_SIGHTING_VALIDATION.DEFAULT_STATUS,
          createdAt
        );

        // Get the created sighting
        const sightingId = result.lastInsertRowid as number;
        const row = this.statements.getSightingById!.get(sightingId);
        if (!row) {
          throw new CorgiServiceError(
            'Failed to retrieve created sighting',
            'DATABASE_ERROR'
          );
        }

        const sighting = this.mapRowToSighting(row as Record<string, unknown>);

        return {
          sighting,
        };
      });
      // Best-effort notify buddy about new sighting
      await notificationService
        .notifyNewSighting(buddyId, reporterUser.first_name, corgiCount)
        .catch(() => {});
      return result;
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError ||
        error instanceof BuddyServiceError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to create sighting: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get pending confirmations for a buddy (sightings they need to confirm)
   */
  public async getPendingConfirmations(
    buddyId: number
  ): Promise<ConfirmationsResult> {
    try {
      // Check if user exists
      if (!(await userService.userExists(buddyId))) {
        throw new UserNotFoundError(buddyId);
      }

      const rows = this.statements.getPendingForBuddy!.all(buddyId);
      const confirmations = rows.map((row) =>
        this.mapRowToSighting(row as Record<string, unknown>)
      );

      return {
        confirmations,
      };
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to get pending confirmations: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Confirm or deny a corgi sighting
   */
  public async confirmSighting(
    sightingId: number,
    buddyId: number,
    confirmed: boolean
  ): Promise<SightingResult> {
    try {
      const confirmerUser = await userService.getUserById(buddyId);
      if (!confirmerUser) {
        throw new UserNotFoundError(buddyId);
      }

      const result = withTransaction(() => {
        // Get the sighting
        const row = this.statements.getSightingById!.get(sightingId);
        if (!row) {
          throw new CorgiNotFoundError('Corgi sighting not found');
        }

        const sighting = this.mapRowToSighting(row as Record<string, unknown>);

        // Verify the buddy is authorized to confirm this sighting
        if (sighting.buddy_id !== buddyId) {
          throw new CorgiValidationError(
            'User is not authorized to confirm this sighting'
          );
        }

        // Verify the sighting is pending
        if (sighting.status !== 'pending') {
          throw new CorgiConflictError('Sighting is not in pending status');
        }

        // Update the status
        const newStatus: CorgiSightingStatus = confirmed
          ? 'confirmed'
          : 'denied';
        const respondedAt = new Date().toISOString();

        const updateInput: UpdateCorgiSightingInput = {
          status: newStatus,
          responded_at: respondedAt,
        };

        const validationErrors =
          CorgiSightingValidator.validateUpdateInput(updateInput);
        if (validationErrors.length > 0) {
          throw new CorgiValidationError(validationErrors[0]);
        }

        this.statements.updateSightingStatus!.run(
          newStatus,
          respondedAt,
          sightingId
        );

        // Get the updated sighting
        const updatedRow = this.statements.getSightingById!.get(sightingId);
        if (!updatedRow) {
          throw new CorgiServiceError(
            'Failed to retrieve updated sighting',
            'DATABASE_ERROR'
          );
        }

        const updatedSighting = this.mapRowToSighting(
          updatedRow as Record<string, unknown>
        );

        // Calculate reward if confirmed
        let rewardEarned: number | undefined;
        if (confirmed) {
          rewardEarned = this.calculateReward(updatedSighting.corgi_count);
        }

        return {
          sighting: updatedSighting,
          rewardEarned,
        };
      });
      // Notify reporter of confirmation outcome
      const updated = await this.getSightingById(sightingId);
      if (updated) {
        await notificationService
          .notifySightingResponse(
            updated.reporter_id,
            confirmerUser.first_name,
            confirmed,
            result.rewardEarned
          )
          .catch(() => {});
      }
      return result;
    } catch (error) {
      if (error instanceof CorgiServiceError) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to confirm sighting: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get sighting history for a user (as reporter)
   */
  public async getSightingHistory(
    reporterId: number,
    limit?: number
  ): Promise<SightingHistoryResult> {
    try {
      // Check if user exists
      if (!(await userService.userExists(reporterId))) {
        throw new UserNotFoundError(reporterId);
      }

      let rows: unknown[];
      if (limit) {
        const stmt = this.db.prepare(
          `${CORGI_SIGHTING_QUERIES.BY_REPORTER} LIMIT ?`
        );
        rows = stmt.all(reporterId, limit);
      } else {
        rows = this.statements.getByReporter!.all(reporterId);
      }

      const sightings = rows.map((row) =>
        this.mapRowToSighting(row as Record<string, unknown>)
      );

      // Calculate total rewards from confirmed sightings
      const confirmedSightings = sightings.filter(
        (s) => s.status === 'confirmed'
      );
      const totalRewards = confirmedSightings.reduce((total, sighting) => {
        return total + this.calculateReward(sighting.corgi_count);
      }, 0);

      return {
        sightings,
        totalCount: sightings.length,
        totalRewards,
      };
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to get sighting history: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get pending sightings for a reporter (sightings awaiting confirmation)
   */
  public async getPendingSightings(
    reporterId: number
  ): Promise<CorgiSighting[]> {
    try {
      // Check if user exists
      if (!(await userService.userExists(reporterId))) {
        throw new UserNotFoundError(reporterId);
      }

      const rows = this.statements.getPendingForReporter!.all(reporterId);
      return rows.map((row) =>
        this.mapRowToSighting(row as Record<string, unknown>)
      );
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to get pending sightings: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get a single sighting by ID
   */
  public async getSightingById(
    sightingId: number
  ): Promise<CorgiSighting | null> {
    try {
      const row = this.statements.getSightingById!.get(sightingId);
      return row ? this.mapRowToSighting(row as Record<string, unknown>) : null;
    } catch (error) {
      throw new CorgiServiceError(
        `Failed to get sighting: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get confirmed sightings for calculating total rewards
   */
  public async getConfirmedSightings(
    reporterId: number
  ): Promise<CorgiSighting[]> {
    try {
      // Check if user exists
      if (!(await userService.userExists(reporterId))) {
        throw new UserNotFoundError(reporterId);
      }

      const rows = this.statements.getConfirmedForReporter!.all(reporterId);
      return rows.map((row) =>
        this.mapRowToSighting(row as Record<string, unknown>)
      );
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to get confirmed sightings: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Calculate reward for a confirmed sighting
   * Based on corgi count: 1 corgi = 1 coin, 2-5 corgis = 2 coins each, 6+ corgis = 3 coins each
   */
  private calculateReward(corgiCount: number): number {
    if (corgiCount === 1) {
      return 1;
    } else if (corgiCount >= 2 && corgiCount <= 5) {
      return corgiCount * 2;
    } else {
      return corgiCount * 3;
    }
  }

  /**
   * Get total rewards earned by a user
   */
  public async getTotalRewards(reporterId: number): Promise<number> {
    try {
      const confirmedSightings = await this.getConfirmedSightings(reporterId);
      return confirmedSightings.reduce((total, sighting) => {
        return total + this.calculateReward(sighting.corgi_count);
      }, 0);
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to calculate total rewards: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if a user can report a sighting (has active buddy)
   */
  public async canReportSighting(userId: number): Promise<boolean> {
    try {
      const buddyStatus = await buddyService.getBuddyStatus(userId);
      return buddyStatus.status === 'active';
    } catch (error) {
      console.warn('Failed to check buddy status for sighting eligibility:', error);
      return false;
    }
  }

  /**
   * Get statistics for a user's sighting activity
   */
  public async getUserSightingStats(userId: number): Promise<{
    totalSightings: number;
    confirmedSightings: number;
    deniedSightings: number;
    pendingSightings: number;
    totalRewards: number;
    totalCorgisSpotted: number;
  }> {
    try {
      const sightingHistory = await this.getSightingHistory(userId);
      const sightings = sightingHistory.sightings;

      const confirmedSightings = sightings.filter(
        (s) => s.status === 'confirmed'
      );
      const deniedSightings = sightings.filter((s) => s.status === 'denied');
      const pendingSightings = sightings.filter((s) => s.status === 'pending');

      const totalCorgisSpotted = confirmedSightings.reduce(
        (total, s) => total + s.corgi_count,
        0
      );

      return {
        totalSightings: sightings.length,
        confirmedSightings: confirmedSightings.length,
        deniedSightings: deniedSightings.length,
        pendingSightings: pendingSightings.length,
        totalRewards: sightingHistory.totalRewards,
        totalCorgisSpotted,
      };
    } catch (error) {
      if (
        error instanceof CorgiServiceError ||
        error instanceof UserNotFoundError
      ) {
        throw error;
      }
      throw new CorgiServiceError(
        `Failed to get user sighting stats: ${error}`,
        'DATABASE_ERROR'
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const corgiService = CorgiService.getInstance();

/**
 * Export default singleton instance
 */
export default corgiService;
