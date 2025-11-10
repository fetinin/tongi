'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { retrieveRawLaunchParams } from '@tma.js/bridge';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/Auth/AuthProvider';
import type {
  GuardRedirectMap,
  OnboardingApiResponse,
  OnboardingErrorState,
  OnboardingStatusResponse,
} from '@/types/onboarding';

const DEFAULT_REDIRECTS: GuardRedirectMap = {
  welcome: '/onboarding/welcome',
  buddy: '/onboarding/buddy',
  complete: '/corgi',
};

interface UseOnboardingGuardOptions {
  redirects?: Partial<GuardRedirectMap>;
  autoRedirect?: boolean;
}

interface UseOnboardingGuardResult {
  status: OnboardingStatusResponse | null;
  isLoading: boolean;
  error: OnboardingErrorState | null;
  refresh: () => Promise<void>;
}

export function useOnboardingGuard(
  options: UseOnboardingGuardOptions = {}
): UseOnboardingGuardResult {
  const { redirects: customRedirects, autoRedirect = true } = options;
  const redirects = useMemo(
    () => ({ ...DEFAULT_REDIRECTS, ...customRedirects }),
    [customRedirects]
  );

  const { authenticatedFetch, isAuthenticated } = useAuth();
  const t = useTranslations('onboarding.guard');
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<OnboardingErrorState | null>(null);

  const networkError = useMemo<OnboardingErrorState>(
    () => ({
      type: 'network',
      message: t('errors.network'),
      retryable: true,
    }),
    [t]
  );

  const unauthorizedError = useMemo<OnboardingErrorState>(
    () => ({
      type: 'unauthorized',
      message: t('errors.unauthorized'),
      retryable: false,
    }),
    [t]
  );

  const mapValidationError = useCallback(
    (message?: string): OnboardingErrorState => ({
      type: 'validation_failed',
      message: message ?? t('errors.validation'),
      retryable: false,
    }),
    [t]
  );

  const applyRedirect = useCallback(
    (currentStatus: OnboardingStatusResponse) => {
      if (!autoRedirect) {
        return;
      }

      const step = currentStatus.onboarding.current_step;
      const target = redirects[step];

      if (step === 'complete') {
        const onboardingPaths = [redirects.welcome, redirects.buddy];
        if (onboardingPaths.includes(pathname)) {
          if (pathname !== target) {
            router.replace(target);
          }
        }
        return;
      }

      if (step === 'buddy') {
        if (pathname !== redirects.buddy) {
          router.replace(redirects.buddy);
        }
        return;
      }

      if (target && pathname !== target) {
        router.replace(target);
      }
    },
    [autoRedirect, redirects, pathname, router]
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setStatus(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = new Headers();
      const initData = resolveInitData();

      if (initData) {
        headers.set('x-telegram-init-data', initData);
      }

      const response = await authenticatedFetch('/api/onboarding/status', {
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        let parsed: Partial<OnboardingApiResponse> | undefined;
        let errorCode: string | undefined;
        try {
          parsed = (await response.json()) as OnboardingApiResponse;
          if (parsed && typeof parsed === 'object' && 'code' in parsed) {
            errorCode = String(parsed.code);
          }
        } catch (parseError) {
          // Ignore parsing errors; we'll fallback to generic messages
        }

        if (response.status === 401 || errorCode === 'AUTH_FAILED') {
          setStatus(null);
          setError(unauthorizedError);
          return;
        }

        if (
          response.status >= 500 ||
          errorCode === 'NETWORK_ERROR' ||
          errorCode === 'DATABASE_ERROR' ||
          errorCode === 'INTERNAL_ERROR'
        ) {
          setStatus(null);
          setError(networkError);
          return;
        }

        setStatus(null);
        setError(
          mapValidationError(
            parsed && 'error' in parsed ? parsed.error : undefined
          )
        );
        return;
      }

      const data = (await response.json()) as OnboardingStatusResponse;
      setStatus(data);
      setError(null);
      applyRedirect(data);
    } catch (_error) {
      setStatus(null);
      setError(networkError);
    } finally {
      setIsLoading(false);
    }
  }, [
    authenticatedFetch,
    isAuthenticated,
    applyRedirect,
    mapValidationError,
    networkError,
    unauthorizedError,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}

function resolveInitData(): string | null {
  try {
    const rawLaunchParams = retrieveRawLaunchParams();
    if (!rawLaunchParams) {
      return null;
    }

    const params = new URLSearchParams(rawLaunchParams);
    const tgWebAppData = params.get('tgWebAppData');

    return tgWebAppData ? decodeURIComponent(tgWebAppData) : null;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('useOnboardingGuard: unable to resolve init data', error);
    }
    return null;
  }
}
