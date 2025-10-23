/**
 * User Model for Corgi Buddy TON Cryptocurrency Mini-App
 *
 * Represents an authenticated Telegram user with TON wallet integration.
 * Based on the data model specification in specs/001-initial-implementation/data-model.md
 */

/**
 * User registration and wallet connection states
 */
export type UserState =
  | 'UNREGISTERED'
  | 'REGISTERED'
  | 'WALLET_CONNECTED'
  | 'BUDDY_PAIRED';

/**
 * Core User interface representing the database entity
 */
export interface User {
  /** Telegram user ID (bigint) - Primary Key */
  id: number;

  /** Telegram @username (nullable) */
  telegram_username: string | null;

  /** User's first name from Telegram (required) */
  first_name: string;

  /** Connected TON wallet address (nullable) */
  ton_wallet_address: string | null;

  /** Registration timestamp */
  created_at: Date;

  /** Last activity timestamp */
  updated_at: Date;
}

/**
 * User data for creation (excludes auto-generated fields)
 */
export interface CreateUserData {
  /** Telegram user ID */
  id: number;

  /** Telegram @username (optional) */
  telegram_username?: string | null;

  /** User's first name from Telegram */
  first_name: string;

  /** Connected TON wallet address (optional) */
  ton_wallet_address?: string | null;
}

/**
 * User data for updates (all fields optional except ID)
 */
export interface UpdateUserData {
  /** Telegram user ID */
  id: number;

  /** Telegram @username */
  telegram_username?: string | null;

  /** User's first name from Telegram */
  first_name?: string;

  /** Connected TON wallet address */
  ton_wallet_address?: string | null;
}

/**
 * User with computed state information
 */
export interface UserWithState extends User {
  /** Current user state based on data */
  state: UserState;

  /** Whether user has a connected TON wallet */
  hasWallet: boolean;

  /** Whether user has an active buddy pair */
  hasBuddy: boolean;
}

/**
 * User profile information for display
 */
export interface UserProfile {
  /** Telegram user ID */
  id: number;

  /** Display name (first_name or username) */
  displayName: string;

  /** Telegram @username (if available) */
  username: string | null;

  /** Whether user has connected wallet */
  hasWallet: boolean;

  /** Registration date */
  memberSince: Date;
}

/**
 * Telegram InitData user object structure
 * Based on Telegram Mini Apps documentation
 */
export interface TelegramUser {
  /** Telegram user ID */
  id: number;

  /** User's first name */
  first_name: string;

  /** User's last name (optional) */
  last_name?: string;

  /** Username (optional) */
  username?: string;

  /** User's language code */
  language_code?: string;

  /** Whether user is a premium subscriber */
  is_premium?: boolean;

  /** Whether user allows write access to PMs */
  allows_write_to_pm?: boolean;

  /** User's photo URL (optional) */
  photo_url?: string;
}

/**
 * User validation rules and constraints
 */
export const UserValidation = {
  /** Telegram user ID must be positive */
  isValidTelegramId: (id: number): boolean => id > 0,

  /** First name length constraints */
  isValidFirstName: (name: string): boolean =>
    name.length >= 1 && name.length <= 64,

  /** TON wallet address format validation (basic check) */
  isValidTonAddress: (address: string): boolean =>
    /^[0-9a-fA-F]{48}$|^(EQ|kQ)[0-9a-zA-Z_-]{46}$/.test(address),

  /** Username format validation (Telegram format) */
  isValidUsername: (username: string): boolean =>
    /^[a-zA-Z0-9_]{5,32}$/.test(username),
} as const;

/**
 * User utility functions
 */
export const UserUtils = {
  /**
   * Determine user state based on user data and relationships
   */
  getUserState: (user: User, hasBuddy: boolean = false): UserState => {
    if (hasBuddy) return 'BUDDY_PAIRED';
    if (user.ton_wallet_address) return 'WALLET_CONNECTED';
    return 'REGISTERED';
  },

  /**
   * Get display name for user (first_name or @username)
   */
  getDisplayName: (user: User): string => {
    return user.first_name || user.telegram_username || `User ${user.id}`;
  },

  /**
   * Create user profile from user data
   */
  toProfile: (user: User): UserProfile => ({
    id: user.id,
    displayName: UserUtils.getDisplayName(user),
    username: user.telegram_username,
    hasWallet: Boolean(user.ton_wallet_address),
    memberSince: user.created_at,
  }),

  /**
   * Convert Telegram user data to CreateUserData
   */
  fromTelegramUser: (telegramUser: TelegramUser): CreateUserData => ({
    id: telegramUser.id,
    telegram_username: telegramUser.username || null,
    first_name: telegramUser.first_name,
    ton_wallet_address: null,
  }),
} as const;

/**
 * User type guards
 */
export const UserTypeGuards = {
  /**
   * Check if user has a connected wallet
   */
  hasWallet: (user: User): user is User & { ton_wallet_address: string } =>
    Boolean(user.ton_wallet_address),

  /**
   * Check if user has username
   */
  hasUsername: (user: User): user is User & { telegram_username: string } =>
    Boolean(user.telegram_username),
} as const;

export default User;
