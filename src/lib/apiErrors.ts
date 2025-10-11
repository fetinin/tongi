import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface ServiceLikeError {
  code?: string;
  message?: string;
  statusCode?: number;
}

export function handleApiError(scope: string, error: unknown) {
  logger.error(scope, 'API handler error', error);

  // Known service error format
  if (error && typeof error === 'object' && 'code' in error) {
    const e = error as ServiceLikeError;
    const status = e.statusCode || mapErrorCodeToStatus(e.code);
    return NextResponse.json(
      {
        error: e.code || 'INTERNAL_ERROR',
        message: e.message || 'Unexpected error',
      },
      { status }
    );
  }

  // Fallback generic error
  return NextResponse.json(
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    { status: 500 }
  );
}

function mapErrorCodeToStatus(code?: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
    case 'WISH_NOT_FOUND':
    case 'SIGHTING_NOT_FOUND':
    case 'TRANSACTION_NOT_FOUND':
    case 'BANK_WALLET_NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}
