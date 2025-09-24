/**
 * Wish Model
 *
 * Represents a purchase request with proposed Corgi coin amount.
 * Users create wishes that their buddies must accept before they become
 * available for purchase in the marketplace.
 */

/**
 * Valid status values for a wish throughout its lifecycle
 */
export type WishStatus = 'pending' | 'accepted' | 'rejected' | 'purchased';

/**
 * Core Wish interface representing the database entity
 */
export interface Wish {
  /** Auto-increment primary key */
  id: number;

  /** User creating the wish (Telegram user ID) */
  creator_id: number;

  /** Buddy who must accept the wish (Telegram user ID) */
  buddy_id: number;

  /** Wish description (1-500 characters) */
  description: string;

  /** Proposed Corgi coins amount (0.01-1000.00) */
  proposed_amount: number;

  /** Current status of the wish */
  status: WishStatus;

  /** Wish creation timestamp */
  created_at: string;

  /** Buddy acceptance timestamp (null if not accepted) */
  accepted_at: string | null;

  /** Purchase completion timestamp (null if not purchased) */
  purchased_at: string | null;

  /** User who purchased the wish (null if not purchased) */
  purchased_by: number | null;
}

/**
 * Input data for creating a new wish
 */
export interface CreateWishInput {
  /** User creating the wish */
  creator_id: number;

  /** Buddy who must accept the wish */
  buddy_id: number;

  /** Wish description */
  description: string;

  /** Proposed Corgi coins amount */
  proposed_amount: number;
}

/**
 * Input data for updating wish status
 */
export interface UpdateWishStatusInput {
  /** Wish ID to update */
  id: number;

  /** New status */
  status: WishStatus;

  /** User performing the action (for purchase) */
  user_id?: number;
}

/**
 * Response data for wish operations
 */
export interface WishResponse {
  /** The wish data */
  wish: Wish;

  /** Operation success status */
  success: boolean;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Extended wish data with related user information
 */
export interface WishWithUsers extends Wish {
  /** Creator user information */
  creator: {
    id: number;
    first_name: string;
    telegram_username: string | null;
  };

  /** Buddy user information */
  buddy: {
    id: number;
    first_name: string;
    telegram_username: string | null;
  };

  /** Purchaser user information (if purchased) */
  purchaser?: {
    id: number;
    first_name: string;
    telegram_username: string | null;
  };
}

/**
 * Query parameters for filtering wishes
 */
export interface WishQueryParams {
  /** Filter by creator user ID */
  creator_id?: number;

  /** Filter by buddy user ID */
  buddy_id?: number;

  /** Filter by status */
  status?: WishStatus;

  /** Filter by purchaser user ID */
  purchased_by?: number;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort order (newest first by default) */
  sort_order?: 'asc' | 'desc';
}

/**
 * Validation constraints for wish fields
 */
export const WishValidation = {
  /** Description length constraints */
  DESCRIPTION_MIN_LENGTH: 1,
  DESCRIPTION_MAX_LENGTH: 500,

  /** Proposed amount constraints */
  AMOUNT_MIN: 0.01,
  AMOUNT_MAX: 1000.0,

  /** Decimal precision for amounts */
  AMOUNT_DECIMAL_PLACES: 2,
} as const;

/**
 * Helper functions for wish validation
 */
export class WishValidator {
  /**
   * Validates wish description
   */
  static isValidDescription(description: string): boolean {
    return (
      typeof description === 'string' &&
      description.trim().length >= WishValidation.DESCRIPTION_MIN_LENGTH &&
      description.length <= WishValidation.DESCRIPTION_MAX_LENGTH
    );
  }

  /**
   * Validates proposed amount
   */
  static isValidAmount(amount: number): boolean {
    return (
      typeof amount === 'number' &&
      !isNaN(amount) &&
      amount >= WishValidation.AMOUNT_MIN &&
      amount <= WishValidation.AMOUNT_MAX &&
      Number.isFinite(amount)
    );
  }

  /**
   * Validates user IDs are different (creator cannot be buddy)
   */
  static isValidUserPair(creator_id: number, buddy_id: number): boolean {
    return (
      typeof creator_id === 'number' &&
      typeof buddy_id === 'number' &&
      creator_id !== buddy_id &&
      creator_id > 0 &&
      buddy_id > 0
    );
  }

  /**
   * Validates status transition
   */
  static isValidStatusTransition(
    current: WishStatus,
    next: WishStatus
  ): boolean {
    const validTransitions: Record<WishStatus, WishStatus[]> = {
      pending: ['accepted', 'rejected'],
      accepted: ['purchased'],
      rejected: [], // Terminal state
      purchased: [], // Terminal state
    };

    return validTransitions[current]?.includes(next) ?? false;
  }

  /**
   * Validates complete wish input
   */
  static validateCreateInput(input: CreateWishInput): string[] {
    const errors: string[] = [];

    if (!this.isValidDescription(input.description)) {
      errors.push(
        `Description must be ${WishValidation.DESCRIPTION_MIN_LENGTH}-${WishValidation.DESCRIPTION_MAX_LENGTH} characters`
      );
    }

    if (!this.isValidAmount(input.proposed_amount)) {
      errors.push(
        `Proposed amount must be between ${WishValidation.AMOUNT_MIN} and ${WishValidation.AMOUNT_MAX}`
      );
    }

    if (!this.isValidUserPair(input.creator_id, input.buddy_id)) {
      errors.push('Creator and buddy must be different valid users');
    }

    return errors;
  }
}

/**
 * Type guard to check if an object is a valid Wish
 */
export function isWish(obj: unknown): obj is Wish {
  const candidate = obj as Record<string, unknown>;
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof candidate.id === 'number' &&
    typeof candidate.creator_id === 'number' &&
    typeof candidate.buddy_id === 'number' &&
    typeof candidate.description === 'string' &&
    typeof candidate.proposed_amount === 'number' &&
    ['pending', 'accepted', 'rejected', 'purchased'].includes(
      candidate.status as string
    ) &&
    typeof candidate.created_at === 'string'
  );
}

/**
 * Default values for wish creation
 */
export const WishDefaults = {
  status: 'pending' as WishStatus,
  accepted_at: null,
  purchased_at: null,
  purchased_by: null,
} as const;

export default Wish;
