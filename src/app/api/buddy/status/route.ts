import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { buddyService } from '@/services/BuddyService';

interface BuddyPairResponse {
  id: number;
  buddy: {
    id: number;
    telegramUsername: string | null;
    firstName: string;
    tonWalletAddress: string | null;
    createdAt: string;
  };
  status: string;
  initiatedBy: number;
  createdAt: string;
  confirmedAt: string | null;
}

interface NoBuddyResponse {
  status: string;
  message: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/buddy/status
 * Get current buddy relationship status for authenticated user
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BuddyPairResponse | NoBuddyResponse | ErrorResponse>> {
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

    // Get buddy status using BuddyService
    const buddyStatus = await buddyService.getBuddyStatus(currentUserId);

    // If no buddy relationship exists
    if (buddyStatus.status === 'no_buddy') {
      const response: NoBuddyResponse = {
        status: 'no_buddy',
        message: buddyStatus.message || 'No active buddy relationship',
      };
      return NextResponse.json(response, { status: 200 });
    }

    // If buddy relationship exists (pending, active, or dissolved)
    const response: BuddyPairResponse = {
      id: buddyStatus.id!,
      buddy: {
        id: buddyStatus.buddy!.id,
        telegramUsername: buddyStatus.buddy!.username,
        firstName: buddyStatus.buddy!.displayName,
        tonWalletAddress: buddyStatus.buddy!.hasWallet ? 'connected' : null,
        createdAt: buddyStatus.buddy!.memberSince.toISOString(),
      },
      status: buddyStatus.status,
      initiatedBy: buddyStatus.initiatedBy!,
      createdAt: buddyStatus.createdAt!,
      confirmedAt: buddyStatus.confirmedAt || null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Buddy status error:', error);

    // Handle specific BuddyService errors
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
        message: 'An unexpected error occurred while retrieving buddy status',
      },
      { status: 500 }
    );
  }
}
