import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { buddyService } from '@/services/BuddyService';
import { handleApiError } from '@/lib/apiErrors';

interface BuddyCancelInput {
  buddyPairId: number;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * DELETE /api/buddy/cancel
 * Cancel a pending buddy request (only by the request initiator)
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
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
    const body: BuddyCancelInput = await request.json();

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

    // Cancel the buddy request
    const cancelled = await buddyService.cancelBuddyRequest(
      buddyPairId,
      userId
    );

    if (!cancelled) {
      return NextResponse.json(
        {
          error: 'OPERATION_FAILED',
          message: 'Failed to cancel buddy request',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Buddy request cancelled successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError('buddy/cancel:DELETE', error);
  }
}
