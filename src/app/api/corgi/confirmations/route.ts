import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { corgiService } from '@/services/CorgiService';
import { handleApiError } from '@/lib/apiErrors';

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
export async function GET(
  request: NextRequest
): Promise<NextResponse<ConfirmationsListResponse | ErrorResponse>> {
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

    // Get pending confirmations using CorgiService
    const result = await corgiService.getPendingConfirmations(currentUserId);

    // Map the response
    const mappedConfirmations: CorgiSightingResponse[] =
      result.confirmations.map((sighting) => ({
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
    return handleApiError('corgi/confirmations:GET', error);
  }
}
