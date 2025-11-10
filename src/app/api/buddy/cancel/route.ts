import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import {
  buddyService,
  BuddyConflictError,
  BuddyNotFoundError,
  BuddyServiceError,
} from '@/services/BuddyService';
import { UserNotFoundError } from '@/services/UserService';

interface CancelSuccessResponse {
  success: true;
  message: string;
  cancelledRequestId: number;
  buddy?: {
    id: number;
    displayName: string;
    username: string | null;
  };
}

interface CancelErrorResponse {
  success: false;
  error: string;
  code: string;
}

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<CancelSuccessResponse | CancelErrorResponse>> {
  try {
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Authentication required',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    const userId = authResult.user!.id;

    const cancelledRequest = await buddyService.cancelPendingRequest(userId);

    return NextResponse.json(
      {
        success: true,
        message: 'Buddy request cancelled successfully',
        cancelledRequestId: cancelledRequest.id,
        buddy: cancelledRequest.buddy
          ? {
              id: cancelledRequest.buddy.id,
              displayName: cancelledRequest.buddy.displayName,
              username: cancelledRequest.buddy.username,
            }
          : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof BuddyNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'No pending buddy request found',
          code: 'NO_PENDING_REQUEST',
        },
        { status: 400 }
      );
    }

    if (error instanceof BuddyConflictError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode ?? 400 }
      );
    }

    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode ?? 404 }
      );
    }

    if (error instanceof BuddyServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode ?? 500 }
      );
    }

    console.error('buddy/cancel:DELETE unexpected error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error while cancelling buddy request',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
