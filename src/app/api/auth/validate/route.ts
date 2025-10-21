import { NextRequest, NextResponse } from 'next/server';
import {
  validateInitData,
  extractUserData,
  createAuthToken,
} from '@/lib/telegram';
import { userService } from '@/services/UserService';
import { handleApiError } from '@/lib/apiErrors';

interface AuthValidateRequest {
  initData: string;
  tonWalletAddress?: string;
}

interface AuthResponse {
  user: {
    id: number;
    firstName: string;
    username: string | null;
    tonWalletAddress: string | null;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
  isNewUser: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/auth/validate
 * Validates Telegram user authentication and creates/updates user record
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AuthResponse | ErrorResponse>> {
  try {
    // Parse request body
    const body: AuthValidateRequest = await request.json();

    if (!body.initData) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: initData',
        },
        { status: 400 }
      );
    }

    // Get bot token from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json(
        {
          error: 'SERVER_ERROR',
          message: 'Authentication service not properly configured',
        },
        { status: 500 }
      );
    }

    // Validate Telegram initData
    const isValidInitData = validateInitData(body.initData, botToken);
    if (!isValidInitData) {
      return NextResponse.json(
        {
          error: 'INVALID_AUTH',
          message: 'Invalid or expired Telegram authentication data',
        },
        { status: 401 }
      );
    }

    // Extract user data from initData
    const telegramUserData = extractUserData(body.initData);
    if (!telegramUserData) {
      return NextResponse.json(
        {
          error: 'INVALID_USER_DATA',
          message: 'Could not extract valid user data from initData',
        },
        { status: 401 }
      );
    }

    // Convert to Telegram user format expected by UserService
    const telegramUser = {
      id: telegramUserData.id,
      first_name: telegramUserData.firstName,
      last_name: telegramUserData.lastName || undefined,
      username: telegramUserData.username || undefined,
      language_code: telegramUserData.languageCode || undefined,
    };

    // Find or create user in database
    const { user, isNewUser } =
      await userService.findOrCreateUser(telegramUser);

    // Update wallet address if provided
    let finalUser = user;
    if (
      body.tonWalletAddress &&
      body.tonWalletAddress !== user.ton_wallet_address
    ) {
      finalUser = await userService.updateWalletAddress(
        user.id,
        body.tonWalletAddress
      );
    }

    // Generate JWT token
    const token = createAuthToken({
      id: finalUser.id,
      firstName: finalUser.first_name,
      username: finalUser.telegram_username || undefined,
    });

    // Return authentication response
    const response: AuthResponse = {
      user: {
        id: finalUser.id,
        firstName: finalUser.first_name,
        username: finalUser.telegram_username,
        tonWalletAddress: finalUser.ton_wallet_address,
        createdAt: finalUser.created_at.toISOString(),
        updatedAt: finalUser.updated_at.toISOString(),
      },
      token,
      isNewUser,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError('auth/validate:POST', error);
  }
}
