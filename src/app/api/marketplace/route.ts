import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { wishService } from '@/services/WishService';

interface MarketplaceWishResponse {
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
  creator: {
    id: number;
    firstName: string;
    createdAt: string;
  };
  timeRemaining: string;
}

interface MarketplaceListResponse {
  wishes: MarketplaceWishResponse[];
  total: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Helper function to calculate time remaining until wish expiration
 * For now, returns a placeholder as expiration logic is not yet implemented
 */
function calculateTimeRemaining(_acceptedAt: string): string {
  // TODO: Implement actual expiration logic based on business requirements
  // For now, return a placeholder indicating no expiration
  return 'No expiration';
}

/**
 * GET /api/marketplace
 * Get marketplace wishes (accepted wishes available for purchase)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<MarketplaceListResponse | ErrorResponse>> {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Parse and validate limit
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'limit must be a number between 1 and 100',
        },
        { status: 400 }
      );
    }

    // Parse and validate offset
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'offset must be a non-negative number',
        },
        { status: 400 }
      );
    }

    // Get marketplace wishes using WishService
    const queryParams = {
      limit,
      offset,
    };

    const result = await wishService.getMarketplaceWishes(queryParams);

    // Map the response to match API contract
    const mappedWishes: MarketplaceWishResponse[] = result.wishes.map(
      (wish) => ({
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
        creator: {
          id: wish.creator.id,
          firstName: wish.creator.first_name,
          createdAt: wish.created_at, // Using wish created_at as profile created_at placeholder
        },
        timeRemaining: calculateTimeRemaining(wish.accepted_at!),
      })
    );

    const response: MarketplaceListResponse = {
      wishes: mappedWishes,
      total: result.total,
      hasMore: result.hasMore,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Marketplace retrieval error:', error);

    // Handle specific WishService errors
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
        message:
          'An unexpected error occurred while retrieving marketplace wishes',
      },
      { status: 500 }
    );
  }
}
