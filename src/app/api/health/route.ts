import { NextResponse } from 'next/server';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * GET /api/health
 * Health check endpoint for Docker and monitoring systems
 * Returns 200 OK if the service is running
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
