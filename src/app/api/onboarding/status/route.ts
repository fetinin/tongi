/**
 * GET /api/onboarding/status
 *
 * Returns user's current onboarding state derived from:
 * - Wallet connection status (users.ton_wallet_address)
 * - Buddy confirmation status (buddy_pairs table)
 *
 * Response includes current step (welcome|buddy|complete) for client-side routing.
 *
 * Based on specs/005-mobile-first-onboarding/contracts/README.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { onboardingService } from '@/services/OnboardingService';
import { UserNotFoundError } from '@/services/UserService';

/**
 * GET /api/onboarding/status
 *
 * Authenticates user via JWT and returns complete onboarding status
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request (validates JWT token from Telegram initData)
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    const userId = authResult.user!.id;

    // Get onboarding status using OnboardingService
    const status = await onboardingService.getOnboardingStatus(userId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Onboarding status error:', error);

    // Handle user not found
    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve onboarding status',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
