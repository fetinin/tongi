/**
 * CorgiSighting Model
 *
 * Represents a user's report of spotted corgis requiring buddy confirmation.
 * Part of the Corgi Buddy TON Cryptocurrency Mini-App.
 */

/**
 * Valid statuses for a corgi sighting confirmation
 */
export type CorgiSightingStatus = 'pending' | 'confirmed' | 'denied';

/**
 * Core CorgiSighting interface representing the database entity
 */
export interface CorgiSighting {
  /** Auto-increment primary key */
  id: number;

  /** Telegram user ID of the user reporting the sighting */
  reporter_id: number;

  /** Telegram user ID of the buddy who must confirm the sighting */
  buddy_id: number;

  /** Number of corgis spotted (1-100) */
  corgi_count: number;

  /** Current confirmation status */
  status: CorgiSightingStatus;

  /** Timestamp when the sighting was reported */
  created_at: string; // ISO 8601 datetime string

  /** Timestamp when the buddy responded (nullable) */
  responded_at: string | null; // ISO 8601 datetime string or null
}

/**
 * Input data for creating a new corgi sighting
 * Excludes auto-generated fields
 */
export interface CreateCorgiSightingInput {
  /** Telegram user ID of the user reporting the sighting */
  reporter_id: number;

  /** Telegram user ID of the buddy who must confirm the sighting */
  buddy_id: number;

  /** Number of corgis spotted (1-100) */
  corgi_count: number;
}

/**
 * Input data for updating a corgi sighting status
 */
export interface UpdateCorgiSightingInput {
  /** New confirmation status */
  status: CorgiSightingStatus;

  /** Timestamp when the buddy responded (automatically set) */
  responded_at?: string; // ISO 8601 datetime string
}

/**
 * Validation rules for CorgiSighting
 */
export const CORGI_SIGHTING_VALIDATION = {
  /** Minimum number of corgis that can be spotted */
  MIN_CORGI_COUNT: 1,

  /** Maximum number of corgis that can be spotted */
  MAX_CORGI_COUNT: 100,

  /** Valid status values */
  VALID_STATUSES: ['pending', 'confirmed', 'denied'] as const,

  /** Default status for new sightings */
  DEFAULT_STATUS: 'pending' as CorgiSightingStatus,
} as const;

/**
 * Utility functions for CorgiSighting validation
 */
export class CorgiSightingValidator {
  /**
   * Validates corgi count is within acceptable range
   */
  static isValidCorgiCount(count: number): boolean {
    return (
      Number.isInteger(count) &&
      count >= CORGI_SIGHTING_VALIDATION.MIN_CORGI_COUNT &&
      count <= CORGI_SIGHTING_VALIDATION.MAX_CORGI_COUNT
    );
  }

  /**
   * Validates status is a valid CorgiSightingStatus
   */
  static isValidStatus(status: string): status is CorgiSightingStatus {
    return CORGI_SIGHTING_VALIDATION.VALID_STATUSES.includes(
      status as CorgiSightingStatus
    );
  }

  /**
   * Validates that reporter and buddy are different users
   */
  static isValidUserPair(reporterId: number, buddyId: number): boolean {
    return reporterId !== buddyId;
  }

  /**
   * Validates a complete CreateCorgiSightingInput object
   */
  static validateCreateInput(input: CreateCorgiSightingInput): string[] {
    const errors: string[] = [];

    if (!this.isValidCorgiCount(input.corgi_count)) {
      errors.push(
        `corgi_count must be between ${CORGI_SIGHTING_VALIDATION.MIN_CORGI_COUNT} and ${CORGI_SIGHTING_VALIDATION.MAX_CORGI_COUNT}`
      );
    }

    if (!this.isValidUserPair(input.reporter_id, input.buddy_id)) {
      errors.push('reporter_id and buddy_id must be different users');
    }

    if (!Number.isInteger(input.reporter_id) || input.reporter_id <= 0) {
      errors.push('reporter_id must be a positive integer');
    }

    if (!Number.isInteger(input.buddy_id) || input.buddy_id <= 0) {
      errors.push('buddy_id must be a positive integer');
    }

    return errors;
  }

  /**
   * Validates an UpdateCorgiSightingInput object
   */
  static validateUpdateInput(input: UpdateCorgiSightingInput): string[] {
    const errors: string[] = [];

    if (!this.isValidStatus(input.status)) {
      errors.push(
        `status must be one of: ${CORGI_SIGHTING_VALIDATION.VALID_STATUSES.join(', ')}`
      );
    }

    if (input.responded_at !== undefined && input.responded_at !== null) {
      const date = new Date(input.responded_at);
      if (isNaN(date.getTime())) {
        errors.push('responded_at must be a valid ISO 8601 datetime string');
      }
    }

    return errors;
  }
}

/**
 * Database query helpers for CorgiSighting
 */
export const CORGI_SIGHTING_QUERIES = {
  /** Get pending confirmations for a specific buddy */
  PENDING_FOR_BUDDY: `
    SELECT * FROM corgi_sightings
    WHERE buddy_id = ? AND status = 'pending'
    ORDER BY created_at ASC
  `,

  /** Get user's pending sightings */
  PENDING_FOR_REPORTER: `
    SELECT * FROM corgi_sightings
    WHERE reporter_id = ? AND status = 'pending'
  `,

  /** Get all sightings for a user (as reporter) */
  BY_REPORTER: `
    SELECT * FROM corgi_sightings
    WHERE reporter_id = ?
    ORDER BY created_at DESC
  `,

  /** Get all sightings for a user (as buddy) */
  BY_BUDDY: `
    SELECT * FROM corgi_sightings
    WHERE buddy_id = ?
    ORDER BY created_at DESC
  `,

  /** Get confirmed sightings for a user (for calculating rewards) */
  CONFIRMED_FOR_REPORTER: `
    SELECT * FROM corgi_sightings
    WHERE reporter_id = ? AND status = 'confirmed'
    ORDER BY responded_at DESC
  `,

  /** Create new sighting */
  CREATE: `
    INSERT INTO corgi_sightings (reporter_id, buddy_id, corgi_count, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,

  /** Update sighting status */
  UPDATE_STATUS: `
    UPDATE corgi_sightings
    SET status = ?, responded_at = ?
    WHERE id = ?
  `,

  /** Get single sighting by ID */
  BY_ID: `
    SELECT * FROM corgi_sightings
    WHERE id = ?
  `,
} as const;
