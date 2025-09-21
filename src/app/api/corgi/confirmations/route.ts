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
}

interface ConfirmationsListResponse {
  confirmations: CorgiSightingResponse[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/corgi/confirmations
 * Get pending confirmation requests for the authenticated user
 */
export async function GET(request: NextRequest): Promise<NextResponse<ConfirmationsListResponse | ErrorResponse>> {
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

    // Get pending confirmations using CorgiService
    const result = await corgiService.getPendingConfirmations(currentUserId);

    // Map the response
    const mappedConfirmations: CorgiSightingResponse[] = result.confirmations.map(sighting => ({
      id: sighting.id,
      reporterId: sighting.reporter_id,
      buddyId: sighting.buddy_id,
      corgiCount: sighting.corgi_count,
      status: sighting.status,
      createdAt: sighting.created_at,
      respondedAt: sighting.responded_at,
    }));

    const response: ConfirmationsListResponse = {
      confirmations: mappedConfirmations,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Corgi confirmations retrieval error:', error);

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
        message: 'An unexpected error occurred while retrieving pending confirmations'
      },
      { status: 500 }
    );
  }
}