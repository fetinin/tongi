import { NextRequest, NextResponse } from 'next/server';
import {
  extractUserFromAuth,
  validateInitData,
  extractUserData,
  type AuthTokenPayload,
} from '@/lib/telegram';

export interface AuthenticatedRequest extends NextRequest {
  user: AuthTokenPayload;
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthTokenPayload;
  error?: string;
}

/**
 * Middleware function to authenticate requests using JWT tokens
 * @param request The incoming Next.js request
 * @returns Authentication result with user data or error
 */
export function authenticateRequest(
  request: NextRequest
): AuthenticationResult {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      success: false,
      error: 'Missing authorization header',
    };
  }

  const user = extractUserFromAuth(authHeader);

  if (!user) {
    return {
      success: false,
      error: 'Invalid or expired token',
    };
  }

  return {
    success: true,
    user,
  };
}

/**
 * Higher-order function that wraps API route handlers with authentication
 * @param handler The API route handler function
 * @returns Wrapped handler that requires authentication
 */
export function withAuth<T extends unknown[]>(
  handler: (
    request: AuthenticatedRequest,
    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = authenticateRequest(request);

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Extend the request object with user data
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = authResult.user!;

    return handler(authenticatedRequest, ...args);
  };
}

/**
 * Utility function to get authenticated user from request
 * Used within authenticated API route handlers
 * @param request The authenticated request object
 * @returns User data from the JWT token
 */
export function getAuthenticatedUser(
  request: AuthenticatedRequest
): AuthTokenPayload {
  return request.user;
}

/**
 * Middleware for API routes that checks authentication but doesn't fail
 * Returns user data if authenticated, null if not
 * @param request The incoming Next.js request
 * @returns User data or null
 */
export function getOptionalAuth(request: NextRequest): AuthTokenPayload | null {
  const authResult = authenticateRequest(request);
  return authResult.success ? authResult.user! : null;
}

/**
 * Standalone authentication function for use in API routes
 * @param request The incoming Next.js request
 * @returns 401 Response if not authenticated, null if authenticated
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  const authResult = authenticateRequest(request);

  if (!authResult.success) {
    return NextResponse.json(
      {
        error: 'UNAUTHORIZED',
        message: authResult.error || 'Authentication required',
      },
      { status: 401 }
    );
  }

  return null; // No error, authentication succeeded
}

/**
 * Extract user ID from authenticated request
 * @param request The authenticated request object
 * @returns User's Telegram ID
 */
export function getUserId(request: AuthenticatedRequest): number {
  return request.user.id;
}

/**
 * Check if the authenticated user matches a specific user ID
 * @param request The authenticated request object
 * @param targetUserId The user ID to compare against
 * @returns true if the authenticated user matches the target ID
 */
export function isCurrentUser(
  request: AuthenticatedRequest,
  targetUserId: number
): boolean {
  return request.user.id === targetUserId;
}

/**
 * Validates Telegram initData and extracts user information
 * Used for API endpoints that receive raw Telegram authentication data
 * @param initData Telegram initData string from client
 * @returns User data if valid, null if invalid
 */
export async function validateTelegramAuth(
  initData: string
): Promise<AuthTokenPayload | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  // Validate initData signature
  if (!validateInitData(initData, botToken)) {
    return null;
  }

  // Extract user data
  const userData = extractUserData(initData);
  if (!userData) {
    return null;
  }

  // Return in AuthTokenPayload format for consistency
  return {
    id: userData.id,
    firstName: userData.firstName,
    username: userData.username || undefined,
  };
}
