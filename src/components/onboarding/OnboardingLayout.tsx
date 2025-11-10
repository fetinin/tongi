'use client';

import { type PropsWithChildren, type ReactNode } from 'react';
import { miniApp, useSignal } from '@telegram-apps/sdk-react';
import { Placeholder, Section } from '@telegram-apps/telegram-ui';

interface OnboardingLayoutProps extends PropsWithChildren {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Provides a consistent mobile-first shell for onboarding screens.
 * Uses Telegram UI components to match the host platform appearance
 * and constrains the content width for 320px+ layouts.
 */
export function OnboardingLayout({
  title,
  description,
  icon,
  footer,
  className,
  children,
}: OnboardingLayoutProps) {
  const isDark = useSignal(miniApp.isDark);

  const containerClassName = [
    'flex min-h-screen w-full justify-center',
    'bg-[var(--tg-theme-bg-color,#ffffff)]',
    'text-[var(--tg-theme-text-color,#1c1c1d)]',
    isDark ? 'bg-[var(--tg-theme-bg-color,#0a0a0a)]' : '',
    className ?? '',
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div className={containerClassName}>
      <div className="flex min-w-[320px] max-w-md flex-1 flex-col gap-6 px-4 pb-[calc(24px+var(--tg-safe-area-inset-bottom,0px))] pt-8 sm:mx-auto sm:max-w-lg sm:px-6 lg:max-w-xl">
        <Section>
          <Placeholder header={title} description={description}>
            {icon ?? (
              <span className="text-5xl" aria-hidden>
                🐕
              </span>
            )}
          </Placeholder>
        </Section>

        <Section>
          <div className="flex flex-col gap-4">{children}</div>
        </Section>

        {footer ? <Section>{footer}</Section> : null}
      </div>
    </div>
  );
}

export default OnboardingLayout;
