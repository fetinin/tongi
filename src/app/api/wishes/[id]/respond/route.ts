import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { wishService, WishService } from '@/services/WishService';

interface WishResponse {
  id: number;
  creatorId: number;
  buddyId: number;
  description: string;
  proposedAmount: number;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  purchasedAt: string | null;
  purchasedBy: number | null;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/wishes/[id]/respond
 * Accept or reject a wish request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<WishResponse | ErrorResponse>> {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required'
        },
        { status: 401 }
      );
    }

    const currentUserId = authResult.user!.id;

    // Validate and parse wish ID
    let wishId: number;
    try {
      wishId = WishService.validateWishId(params.id);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Invalid wish ID'
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { accepted } = body;

    // Validate input
    if (typeof accepted !== 'boolean') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'accepted is required and must be a boolean'
        },
        { status: 400 }
      );
    }

    // Respond to the wish using WishService
    const result = await wishService.respondToWish({
      wishId,
      userId: currentUserId,
      accepted,
    });

    // Map the response
    const response: WishResponse = {
      id: result.id,
      creatorId: result.creator_id,
      buddyId: result.buddy_id,
      description: result.description,
      proposedAmount: result.proposed_amount,
      status: result.status,
      createdAt: result.created_at,
      acceptedAt: result.accepted_at,
      purchasedAt: result.purchased_at,
      purchasedBy: result.purchased_by,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Wish response error:', error);

    // Handle specific WishService errors
    if (error && typeof error === 'object' && 'code' in error) {
      const serviceError = error as { code: string; message: string; statusCode?: number };

      return NextResponse.json(
        {
          error: serviceError.code,
          message: serviceError.message
        },
        { status: serviceError.statusCode || 500 }
      );
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while responding to the wish'
      },
      { status: 500 }
    );
  }
}