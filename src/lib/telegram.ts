import jwt from 'jsonwebtoken';
import { validate, sign } from '@tma.js/init-data-node';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface NormalizedUser {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
}

export interface AuthTokenPayload {
  id: number;
  firstName: string;
  username?: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-development-secret';
const JWT_EXPIRES_IN = '3d';

/**
 * Validates Telegram initData using HMAC-SHA-256 signature verification
 * @param initData Raw Telegram initData string
 * @param botToken Telegram bot token for validation
 * @returns true if initData is valid and not expired
 */
export function validateInitData(initData: string, botToken: string): boolean {
  try {
    // Use library's validate function with 24-hour expiration
    validate(initData, botToken, { expiresIn: 24 * 60 * 60 });
    return true;
  } catch (error) {
    // Library throws errors for invalid signatures, expired data, etc.
    return false;
  }
}

/**
 * Extracts user data from Telegram initData string
 * @param initData Raw Telegram initData string
 * @returns Normalized user data or null if invalid
 */
export function extractUserData(initData: string): NormalizedUser | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');

    if (!userParam) {
      return null;
    }

    const rawUserData = JSON.parse(
      decodeURIComponent(userParam)
    ) as TelegramUser;

    // Validate the raw data first
    if (!validateUserData(rawUserData)) {
      return null;
    }

    // Return normalized data
    return normalizeUserData(rawUserData);
  } catch {
    return null;
  }
}

/**
 * Validates that user data contains required fields
 * @param userData User data object to validate
 * @returns true if valid user data
 */
export function validateUserData(userData: unknown): userData is TelegramUser {
  if (!userData || typeof userData !== 'object') {
    return false;
  }

  const user = userData as Record<string, unknown>;

  // Check required fields
  if (typeof user.id !== 'number' || user.id <= 0) {
    return false;
  }

  if (typeof user.first_name !== 'string' || user.first_name.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Normalizes Telegram user data to application format
 * @param userData Raw Telegram user data
 * @returns Normalized user data
 */
export function normalizeUserData(userData: TelegramUser): NormalizedUser {
  return {
    id: userData.id,
    firstName: userData.first_name,
    lastName: userData.last_name || null,
    username: userData.username || null,
    languageCode: userData.language_code || null,
  };
}

/**
 * Creates a JWT token for authenticated user
 * @param userData User data (partial NormalizedUser accepted)
 * @returns JWT token string
 */
export function createAuthToken(
  userData: Pick<NormalizedUser, 'id' | 'firstName'> &
    Partial<Pick<NormalizedUser, 'username'>>
): string {
  const payload: AuthTokenPayload = {
    id: userData.id,
    firstName: userData.firstName,
    username: userData.username || undefined,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifies and decodes a JWT token
 * @param token JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts and validates user from authorization header
 * @param authHeader Authorization header value
 * @returns User data or null if invalid
 */
export function extractUserFromAuth(
  authHeader: string | null
): AuthTokenPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  return verifyAuthToken(token);
}

/**
 * Creates valid test initData with proper HMAC signature (for testing only)
 * @param userData User data to include
 * @param botToken Bot token to sign with
 * @param authDate Optional auth date (defaults to current time)
 * @returns Valid initData string
 */
export function createTestInitData(
  userData: TelegramUser,
  botToken: string,
  authDate?: number
): string {
  const timestamp = authDate || Math.floor(Date.now() / 1000);

  // Build init data object for signing
  const initDataObject = {
    user: userData,
    auth_date: timestamp,
  };

  // Use library's sign function to create properly signed initData
  return sign(initDataObject, botToken, new Date(timestamp * 1000));
}
