import crypto from 'crypto';
import jwt from 'jsonwebtoken';

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
const JWT_EXPIRES_IN = '30d';

/**
 * Validates Telegram initData using HMAC-SHA-256 signature verification
 * @param initData Raw Telegram initData string
 * @param botToken Telegram bot token for validation
 * @returns true if initData is valid and not expired
 */
export function validateInitData(initData: string, botToken: string): boolean {
  try {
    // Parse initData string manually to preserve encoding
    const params = initData.split('&');
    const data: Record<string, string> = {};
    let hash = '';

    for (const param of params) {
      const [key, value] = param.split('=');
      if (key === 'hash') {
        hash = value;
      } else {
        data[key] = value;
      }
    }

    if (!hash) {
      return false;
    }

    // Check auth_date (not older than 24 hours)
    const authDate = data.auth_date;
    if (!authDate) {
      return false;
    }

    const authTimestamp = parseInt(authDate, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 hours in seconds

    if (currentTimestamp - authTimestamp > maxAge) {
      return false;
    }

    // Create data check string by sorting keys alphabetically
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // Generate secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // console.log('Data check string:', dataCheckString);
    // console.log('Expected hash:', expectedHash);
    // console.log('Received hash:', hash);

    // Compare hashes
    return hash === expectedHash;
  } catch (error) {
    console.error('Error validating initData:', error);
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
  const userParam = encodeURIComponent(JSON.stringify(userData));

  const data = {
    auth_date: timestamp.toString(),
    user: userParam,
  };

  // Create data check string by sorting keys alphabetically
  const dataCheckString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key as keyof typeof data]}`)
    .join('\n');

  // console.log('Creating test data with dataCheckString:', dataCheckString);

  // Generate secret key from bot token
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate hash
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // console.log('Generated hash for test:', hash);

  return `auth_date=${timestamp}&user=${userParam}&hash=${hash}`;
}
