import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { corgiService } from '@/services/CorgiService';

interface CorgiSightingResponse {
  id: number;
  reporterId: number;
  buddyId: number;
  corgiCount: number;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  rewardEarned?: number;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/corgi/confirm/[id]
 * Confirm or deny a corgi sighting
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<CorgiSightingResponse | ErrorResponse>> {
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

    // Parse and validate sighting ID
    const sightingId = parseInt(params.id, 10);
    if (isNaN(sightingId) || sightingId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid sighting ID'
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { confirmed } = body;

    // Validate input
    if (typeof confirmed !== 'boolean') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'confirmed field is required and must be a boolean'
        },
        { status: 400 }
      );
    }

    // Confirm the sighting using CorgiService
    const result = await corgiService.confirmSighting(sightingId, currentUserId, confirmed);

    // Map the response
    const response: CorgiSightingResponse = {
      id: result.sighting.id,
      reporterId: result.sighting.reporter_id,
      buddyId: result.sighting.buddy_id,
      corgiCount: result.sighting.corgi_count,
      status: result.sighting.status,
      createdAt: result.sighting.created_at,
      respondedAt: result.sighting.responded_at,
      rewardEarned: result.rewardEarned,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Corgi sighting confirmation error:', error);

    // Handle specific CorgiService errors
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
        message: 'An unexpected error occurred while confirming the sighting'
      },
      { status: 500 }
    );
  }
}