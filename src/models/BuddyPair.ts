/**
 * BuddyPair Model
 * Represents the bidirectional relationship between two users in the Corgi Buddy app.
 */

/**
 * Enum for buddy pair status values
 */
export enum BuddyPairStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISSOLVED = 'dissolved',
}

/**
 * Interface representing a BuddyPair entity from the database
 */
export interface BuddyPair {
  /** Auto-increment primary key */
  id: number;

  /** First user's Telegram ID (Foreign Key → User.id) */
  user1_id: number;

  /** Second user's Telegram ID (Foreign Key → User.id) */
  user2_id: number;

  /** User who initiated the pairing (Foreign Key → User.id) */
  initiated_by: number;

  /** Pairing status */
  status: BuddyPairStatus;

  /** Pairing initiation timestamp */
  created_at: string;

  /** Pairing confirmation timestamp (nullable) */
  confirmed_at: string | null;
}

/**
 * Interface for creating a new buddy pair
 */
export interface CreateBuddyPairInput {
  /** First user's Telegram ID */
  user1_id: number;

  /** Second user's Telegram ID */
  user2_id: number;

  /** User who initiated the pairing */
  initiated_by: number;
}

/**
 * Interface for updating a buddy pair
 */
export interface UpdateBuddyPairInput {
  /** Updated status */
  status?: BuddyPairStatus;

  /** Confirmation timestamp (set when status changes to active) */
  confirmed_at?: string | null;
}

/**
 * Interface for buddy pair query filters
 */
export interface BuddyPairFilters {
  /** Filter by user ID (either user1_id or user2_id) */
  user_id?: number;

  /** Filter by specific status */
  status?: BuddyPairStatus;

  /** Filter by who initiated the pairing */
  initiated_by?: number;
}

/**
 * Validation functions for BuddyPair data
 */
export class BuddyPairValidator {
  /**
   * Validates that user1_id and user2_id are different (cannot buddy with self)
   */
  static validateDifferentUsers(user1_id: number, user2_id: number): boolean {
    return user1_id !== user2_id;
  }

  /**
   * Validates that initiated_by is either user1_id or user2_id
   */
  static validateInitiator(
    user1_id: number,
    user2_id: number,
    initiated_by: number
  ): boolean {
    return initiated_by === user1_id || initiated_by === user2_id;
  }

  /**
   * Validates a CreateBuddyPairInput object
   */
  static validateCreateInput(input: CreateBuddyPairInput): string[] {
    const errors: string[] = [];

    if (!this.validateDifferentUsers(input.user1_id, input.user2_id)) {
      errors.push('Users cannot buddy with themselves');
    }

    if (
      !this.validateInitiator(
        input.user1_id,
        input.user2_id,
        input.initiated_by
      )
    ) {
      errors.push('initiated_by must be either user1_id or user2_id');
    }

    if (input.user1_id <= 0 || input.user2_id <= 0 || input.initiated_by <= 0) {
      errors.push('All user IDs must be positive integers');
    }

    return errors;
  }
}

/**
 * Utility functions for BuddyPair operations
 */
export class BuddyPairUtils {
  /**
   * Ensures consistent ordering of user IDs (user1_id < user2_id)
   * This helps maintain the unique constraint in the database
   */
  static normalizeUserIds(
    user1_id: number,
    user2_id: number
  ): [number, number] {
    return user1_id < user2_id ? [user1_id, user2_id] : [user2_id, user1_id];
  }

  /**
   * Gets the buddy ID for a given user in a buddy pair
   */
  static getBuddyId(buddyPair: BuddyPair, userId: number): number | null {
    if (buddyPair.user1_id === userId) {
      return buddyPair.user2_id;
    } else if (buddyPair.user2_id === userId) {
      return buddyPair.user1_id;
    }
    return null;
  }

  /**
   * Checks if a user is part of a buddy pair
   */
  static isUserInPair(buddyPair: BuddyPair, userId: number): boolean {
    return buddyPair.user1_id === userId || buddyPair.user2_id === userId;
  }

  /**
   * Checks if a buddy pair is active
   */
  static isActive(buddyPair: BuddyPair): boolean {
    return buddyPair.status === BuddyPairStatus.ACTIVE;
  }

  /**
   * Checks if a buddy pair is pending confirmation
   */
  static isPending(buddyPair: BuddyPair): boolean {
    return buddyPair.status === BuddyPairStatus.PENDING;
  }
}

/**
 * Type for database row returned from SQLite queries
 * (SQLite returns bigints as numbers for user IDs)
 */
export interface BuddyPairRow {
  id: number;
  user1_id: number;
  user2_id: number;
  initiated_by: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
}

/**
 * Converts a database row to a BuddyPair object with proper typing
 */
export function rowToBuddyPair(row: BuddyPairRow): BuddyPair {
  return {
    id: row.id,
    user1_id: row.user1_id,
    user2_id: row.user2_id,
    initiated_by: row.initiated_by,
    status: row.status as BuddyPairStatus,
    created_at: row.created_at,
    confirmed_at: row.confirmed_at,
  };
}

export default BuddyPair;
