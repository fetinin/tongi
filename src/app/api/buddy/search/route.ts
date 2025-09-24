import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { userService } from '@/services/UserService';

interface UserSearchResponse {
  users: {
    id: number;
    telegramUsername: string | null;
    firstName: string;
    tonWalletAddress: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/buddy/search
 * Search for users by Telegram username for buddy pairing
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<UserSearchResponse | ErrorResponse>> {
  try {
    // Authenticate the request
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

    const currentUserId = authResult.user!.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required query parameter: username',
        },
        { status: 400 }
      );
    }

    // Clean the username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '').trim();

    if (cleanUsername.length < 2) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Username query must be at least 2 characters',
        },
        { status: 400 }
      );
    }

    // Search for users using UserService
    const userProfiles = await userService.searchUsersByUsername(cleanUsername);

    // We need to get the full user data, not just profiles
    // Get the actual User objects for the found profiles
    const users = await Promise.all(
      userProfiles
        .filter((profile) => profile.id !== currentUserId)
        .map(async (profile) => {
          const user = await userService.getUserById(profile.id);
          return user;
        })
    );

    // Filter out any null results and users that are the current user
    const validUsers = users.filter(
      (user): user is NonNullable<typeof user> =>
        user !== null && user.id !== currentUserId
    );

    if (validUsers.length === 0) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'No users found matching the search criteria',
        },
        { status: 404 }
      );
    }

    // Format response according to API spec
    const response: UserSearchResponse = {
      users: validUsers.map((user) => ({
        id: user.id,
        telegramUsername: user.telegram_username,
        firstName: user.first_name,
        tonWalletAddress: user.ton_wallet_address,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Buddy search error:', error);

    // Handle specific UserService errors
    if (error && typeof error === 'object' && 'code' in error) {
      const serviceError = error as {
        code: string;
        message: string;
        statusCode?: number;
      };

      return NextResponse.json(
        {
          error: serviceError.code,
          message: serviceError.message,
        },
        { status: serviceError.statusCode || 500 }
      );
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during user search',
      },
      { status: 500 }
    );
  }
}
