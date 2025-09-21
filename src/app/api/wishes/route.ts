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

interface WishesListResponse {
  wishes: WishResponse[];
  total: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/wishes
 * Create a new wish
 */
export async function POST(request: NextRequest): Promise<NextResponse<WishResponse | ErrorResponse>> {
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

    // Parse request body
    const body = await request.json();
    const { description, proposedAmount } = body;

    // Validate input
    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'description is required and must be a string'
        },
        { status: 400 }
      );
    }

    if (!proposedAmount || typeof proposedAmount !== 'number') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'proposedAmount is required and must be a number'
        },
        { status: 400 }
      );
    }

    if (proposedAmount < 0.01 || proposedAmount > 1000) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'proposedAmount must be between 0.01 and 1000'
        },
        { status: 400 }
      );
    }

    if (description.trim().length < 1 || description.length > 500) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'description must be between 1 and 500 characters'
        },
        { status: 400 }
      );
    }

    // Create the wish using WishService
    const result = await wishService.createWish(currentUserId, description.trim(), proposedAmount);

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

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Wish creation error:', error);

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
        message: 'An unexpected error occurred while creating the wish'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wishes
 * Get user's wishes with optional status filter
 */
export async function GET(request: NextRequest): Promise<NextResponse<WishesListResponse | ErrorResponse>> {
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
    const statusFilter = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate status filter if provided
    if (statusFilter && !['pending', 'accepted', 'rejected', 'purchased'].includes(statusFilter)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'status must be one of: pending, accepted, rejected, purchased'
        },
        { status: 400 }
      );
    }

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

    // Get wishes using WishService
    const queryParams = {
      status: statusFilter as 'pending' | 'accepted' | 'rejected' | 'purchased' | undefined,
      limit,
      offset,
    };

    const result = await wishService.getUserWishes(currentUserId, queryParams);

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

    const response: WishesListResponse = {
      wishes: mappedWishes,
      total: result.total,
      hasMore: result.hasMore,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Wishes retrieval error:', error);

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
        message: 'An unexpected error occurred while retrieving wishes'
      },
      { status: 500 }
    );
  }
}