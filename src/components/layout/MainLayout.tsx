'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { OnboardingError } from '@/components/onboarding/OnboardingError';
import { BottomNavigation } from './BottomNavigation';

interface MainLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  contentClassName?: string;
}

export function MainLayout({
  title,
  subtitle,
  children,
  contentClassName,
}: MainLayoutProps) {
  const { isAuthenticated, user, login } = useAuth();
  const { onboardingState, isLoading, error, retry } = useOnboardingGuard();
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);
  const [dismissedScreenGuard, setDismissedScreenGuard] = useState(false);

  useEffect(() => {
    function evaluateViewport() {
      if (typeof window === 'undefined') {
        return;
      }
      setIsScreenTooSmall(window.innerWidth < 320);
    }

    evaluateViewport();
    window.addEventListener('resize', evaluateViewport);
    return () => {
      window.removeEventListener('resize', evaluateViewport);
    };
  }, []);

  const isOnboardingComplete = useMemo(() => {
    return onboardingState?.current_step === 'main';
  }, [onboardingState]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tg-theme-bg-color,#ffffff)] px-4">
        <Placeholder
          header="Welcome to Corgi Buddy"
          description="Connect with your Telegram account to continue your adventure."
          action={
            <button
              onClick={login}
              className="w-full rounded-full bg-corgi-black px-6 py-3 text-base font-medium text-corgi-white transition-opacity hover:opacity-90"
            >
              Sign in with Telegram
            </button>
          }
        >
          <span className="text-6xl" aria-hidden>
            🐕
          </span>
        </Placeholder>
      </div>
    );
  }

  if (isLoading || !onboardingState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tg-theme-bg-color,#ffffff)] px-4">
        <Placeholder
          header="Preparing your experience"
          description="Validating your onboarding progress."
        >
          <Spinner size="l" />
        </Placeholder>
      </div>
    );
  }

  if (isScreenTooSmall && !dismissedScreenGuard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tg-theme-bg-color,#ffffff)] px-4">
        <Placeholder
          header="Screen Too Small"
          description="This app is optimized for screens 320px wide or larger. Some features may not work properly."
          action={
            <Button
              mode="outline"
              size="m"
              className="min-h-[44px] touch-manipulation"
              onClick={() => setDismissedScreenGuard(true)}
            >
              Continue Anyway
            </Button>
          }
        >
          <span className="text-5xl" aria-hidden>
            📱
          </span>
        </Placeholder>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tg-theme-bg-color,#ffffff)] px-4">
        <OnboardingError error={error} onRetry={retry} />
      </div>
    );
  }

  if (!isOnboardingComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--tg-theme-bg-color,#ffffff)] px-4">
        <Placeholder
          header="Redirecting to onboarding"
          description="We are guiding you to the next onboarding step."
        >
          <Spinner size="m" />
        </Placeholder>
      </div>
    );
  }

  const contentClasses = [
    'px-4 pb-6 pt-2 sm:px-6',
    title || subtitle ? '-mt-2' : '',
    contentClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--tg-theme-bg-color,#ffffff)]">
      <div className="flex-1 overflow-y-auto pb-20">
        {(title || subtitle) && (
          <header className="space-y-1 px-4 pb-3 pt-5 sm:px-6">
            {title && (
              <h1 className="text-xl font-semibold text-[color:var(--tg-theme-text-color,#1c1c1d)]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-[color:var(--tg-theme-subtitle-text-color,#6b6b6d)]">
                {subtitle}
              </p>
            )}
          </header>
        )}
        <div className={contentClasses}>{children}</div>
      </div>
      <BottomNavigation />
    </div>
  );
}

export default MainLayout;
