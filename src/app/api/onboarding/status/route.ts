import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, validateTelegramAuth } from '@/middleware/auth';
import { onboardingService } from '@/services/OnboardingService';
import { logger } from '@/lib/logger';
import type {
  OnboardingApiResponse,
  OnboardingErrorResponse,
} from '@/types/onboarding';

function mapCodeToStatus(code?: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_REQUEST':
    case 'BUDDY_NOT_FOUND':
      return 400;
    case 'AUTH_FAILED':
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'USER_NOT_FOUND':
    case 'NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

function mapCodeToMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'AUTH_FAILED':
      return 'Authentication failed';
    case 'USER_NOT_FOUND':
      return 'User record not found';
    case 'VALIDATION_ERROR':
      return 'We could not validate your onboarding progress.';
    case 'INVALID_REQUEST':
      return 'The onboarding request was invalid.';
    case 'BUDDY_NOT_FOUND':
      return 'Buddy relationship not found.';
    case 'DATABASE_ERROR':
      return 'Failed to retrieve onboarding status.';
    default:
      return fallback ?? 'Failed to retrieve onboarding status.';
  }
}

function buildErrorResponse(
  code: string,
  message: string | undefined,
  status: number
): NextResponse<OnboardingErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message ?? mapCodeToMessage(code),
      code,
    },
    { status }
  );
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<OnboardingApiResponse>> {
  try {
    const authResult = authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      const response: OnboardingErrorResponse = {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const initDataHeader = request.headers.get('x-telegram-init-data');
    if (initDataHeader) {
      const telegramUser = await validateTelegramAuth(initDataHeader);
      if (!telegramUser || telegramUser.id !== authResult.user.id) {
        const response: OnboardingErrorResponse = {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        };
        return NextResponse.json(response, { status: 401 });
      }
    }

    const onboardingStatus = await onboardingService.deriveOnboardingState({
      userId: authResult.user.id,
    });

    return NextResponse.json(onboardingStatus, { status: 200 });
  } catch (error) {
    logger.error(
      'api:onboarding/status',
      'Failed to resolve onboarding status',
      error
    );

    if (error && typeof error === 'object') {
      const code =
        'code' in error
          ? String((error as { code?: string }).code)
          : 'INTERNAL_ERROR';
      const statusCode =
        'statusCode' in error &&
        typeof (error as { statusCode?: number }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : mapCodeToStatus(code);
      const message =
        'message' in error &&
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : undefined;

      return buildErrorResponse(code, message, statusCode);
    }

    return buildErrorResponse('INTERNAL_ERROR', undefined, 500);
  }
}
