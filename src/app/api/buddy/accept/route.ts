import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { buddyService } from '@/services/BuddyService';
import { handleApiError } from '@/lib/apiErrors';

interface BuddyAcceptInput {
  buddyPairId: number;
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
 * POST /api/buddy/accept
 * Accept a pending buddy request
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

    const userId = authResult.user!.id;

    // Parse request body
    const body: BuddyAcceptInput = await request.json();

    if (!body.buddyPairId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: buddyPairId',
        },
        { status: 400 }
      );
    }

    // Validate buddyPairId is a number
    const buddyPairId = Number(body.buddyPairId);
    if (!Number.isInteger(buddyPairId) || buddyPairId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'buddyPairId must be a positive integer',
        },
        { status: 400 }
      );
    }

    // Accept buddy request using BuddyService
    const buddyPairWithProfile = await buddyService.confirmBuddyRequest(
      buddyPairId,
      userId
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

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError('buddy/accept:POST', error);
  }
}
