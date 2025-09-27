import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { wishService, WishService } from '@/services/WishService';
import { handleApiError } from '@/lib/apiErrors';

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
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<WishResponse | ErrorResponse>> {
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

    // Await params in Next.js 15+
    const resolvedParams = await params;

    // Validate and parse wish ID
    let wishId: number;
    try {
      wishId = WishService.validateWishId(resolvedParams.id);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Invalid wish ID',
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
          message: 'accepted is required and must be a boolean',
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
    return handleApiError('wishes/respond:POST', error);
  }
}
