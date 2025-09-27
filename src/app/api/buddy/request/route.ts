import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { buddyService } from '@/services/BuddyService';
import { handleApiError } from '@/lib/apiErrors';

interface BuddyRequestInput {
  targetUserId: number;
}

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

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/buddy/request
 * Send buddy request to another user
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<BuddyPairResponse | ErrorResponse>> {
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

    const requesterId = authResult.user!.id;

    // Parse request body
    const body: BuddyRequestInput = await request.json();

    if (!body.targetUserId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: targetUserId',
        },
        { status: 400 }
      );
    }

    // Validate targetUserId is a number
    const targetUserId = Number(body.targetUserId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'targetUserId must be a positive integer',
        },
        { status: 400 }
      );
    }

    // Prevent users from buddy requesting themselves
    if (targetUserId === requesterId) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Cannot send buddy request to yourself',
        },
        { status: 400 }
      );
    }

    // Create buddy request using BuddyService
    const buddyPairWithProfile = await buddyService.createBuddyRequest(
      requesterId,
      targetUserId
    );

    // Format response according to API spec
    const response: BuddyPairResponse = {
      id: buddyPairWithProfile.id,
      buddy: {
        id: buddyPairWithProfile.buddy.id,
        telegramUsername: buddyPairWithProfile.buddy.username,
        firstName: buddyPairWithProfile.buddy.displayName,
        tonWalletAddress: buddyPairWithProfile.buddy.hasWallet
          ? 'connected'
          : null,
        createdAt: buddyPairWithProfile.buddy.memberSince.toISOString(),
      },
      status: buddyPairWithProfile.status,
      initiatedBy: buddyPairWithProfile.initiatedBy!,
      createdAt: buddyPairWithProfile.createdAt,
      confirmedAt: buddyPairWithProfile.confirmedAt,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError('buddy/request:POST', error);
  }
}
