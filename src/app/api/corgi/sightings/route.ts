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

interface SightingsListResponse {
  sightings: CorgiSightingResponse[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/corgi/sightings
 * Report a new corgi sighting
 */
export async function POST(
  request: NextRequest
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

    // Parse request body
    const body = await request.json();
    const { corgiCount } = body;

    // Validate input
    if (!corgiCount || typeof corgiCount !== 'number') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'corgiCount is required and must be a number',
        },
        { status: 400 }
      );
    }

    if (corgiCount < 1 || corgiCount > 100) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'corgiCount must be between 1 and 100',
        },
        { status: 400 }
      );
    }

    // Create the sighting using CorgiService
    const result = await corgiService.createSighting(currentUserId, corgiCount);

    // Map the response
    const response: CorgiSightingResponse = {
      id: result.sighting.id,
      reporterId: result.sighting.reporter_id,
      buddyId: result.sighting.buddy_id,
      corgiCount: result.sighting.corgi_count,
      status: result.sighting.status,
      createdAt: result.sighting.created_at,
      respondedAt: result.sighting.responded_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError('corgi/sightings:POST', error);
  }
}

/**
 * GET /api/corgi/sightings
 * Get user's corgi sightings with optional status filter
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<SightingsListResponse | ErrorResponse>> {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Validate status filter if provided
    if (
      statusFilter &&
      !['pending', 'confirmed', 'denied'].includes(statusFilter)
    ) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'status must be one of: pending, confirmed, denied',
        },
        { status: 400 }
      );
    }

    // Get sightings based on filter
    let sightings;
    if (statusFilter === 'pending') {
      sightings = await corgiService.getPendingSightings(currentUserId);
    } else {
      const history = await corgiService.getSightingHistory(currentUserId);
      sightings = statusFilter
        ? history.sightings.filter((s) => s.status === statusFilter)
        : history.sightings;
    }

    // Map the response
    const mappedSightings: CorgiSightingResponse[] = sightings.map(
      (sighting) => ({
        id: sighting.id,
        reporterId: sighting.reporter_id,
        buddyId: sighting.buddy_id,
        corgiCount: sighting.corgi_count,
        status: sighting.status,
        createdAt: sighting.created_at,
        respondedAt: sighting.responded_at,
      })
    );

    const response: SightingsListResponse = {
      sightings: mappedSightings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError('corgi/sightings:GET', error);
  }
}
