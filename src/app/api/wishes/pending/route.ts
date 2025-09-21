import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { wishService } from '@/services/WishService';

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

interface PendingWishesResponse {
  wishes: WishResponse[];
  total: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/wishes/pending
 * Get pending wishes that need user's approval
 */
export async function GET(request: NextRequest): Promise<NextResponse<PendingWishesResponse | ErrorResponse>> {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Parse and validate limit and offset
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'limit must be a number between 1 and 100'
        },
        { status: 400 }
      );
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'offset must be a non-negative number'
        },
        { status: 400 }
      );
    }

    // Get pending wishes using WishService
    const queryParams = {
      limit,
      offset,
    };

    const result = await wishService.getPendingWishes(currentUserId, queryParams);

    // Map the response
    const mappedWishes: WishResponse[] = result.wishes.map(wish => ({
      id: wish.id,
      creatorId: wish.creator_id,
      buddyId: wish.buddy_id,
      description: wish.description,
      proposedAmount: wish.proposed_amount,
      status: wish.status,
      createdAt: wish.created_at,
      acceptedAt: wish.accepted_at,
      purchasedAt: wish.purchased_at,
      purchasedBy: wish.purchased_by,
    }));

    const response: PendingWishesResponse = {
      wishes: mappedWishes,
      total: result.total,
      hasMore: result.hasMore,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Pending wishes retrieval error:', error);

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
        message: 'An unexpected error occurred while retrieving pending wishes'
      },
      { status: 500 }
    );
  }
}