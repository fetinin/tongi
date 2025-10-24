import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { corgiService, BlockchainError } from '@/services/CorgiService';
import { handleApiError } from '@/lib/apiErrors';

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
 *
 * Error Handling & Client Retry Strategy:
 * - 503 (Service Unavailable): Blockchain transaction failed with retryable error
 *   Client should implement exponential backoff retry (3-5 attempts recommended)
 * - 500 (Internal Server Error): Non-retryable blockchain error or other failure
 *   Client should display error message and allow manual retry
 *
 * Recommended Client Implementation:
 * - Use optimistic UI pattern: show success immediately, rollback on error
 * - Implement retry logic with exponential backoff for 503 errors
 * - Display user-friendly error messages for 500 errors
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<CorgiSightingResponse | ErrorResponse>> {
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

    // Await params since they're now async in Next.js 15
    const resolvedParams = await params;

    // Parse and validate sighting ID
    const sightingId = parseInt(resolvedParams.id, 10);
    if (isNaN(sightingId) || sightingId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid sighting ID',
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
          message: 'confirmed field is required and must be a boolean',
        },
        { status: 400 }
      );
    }

    // Confirm the sighting using CorgiService
    const result = await corgiService.confirmSighting(
      sightingId,
      currentUserId,
      confirmed
    );

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
    // Handle BlockchainError specifically
    if (error instanceof BlockchainError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.statusCode } // 503 for retryable, 500 for non-retryable
      );
    }

    // Handle all other errors
    return handleApiError('corgi/confirm:POST', error);
  }
}
