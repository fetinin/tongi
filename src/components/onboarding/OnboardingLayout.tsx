/**
 * OnboardingLayout Component
 *
 * Wrapper component for onboarding screens (Welcome, Add Buddy).
 * Provides consistent layout structure with title, description, and content area.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md
 */

'use client';

import React, { type PropsWithChildren } from 'react';
import { Title, Text } from '@telegram-apps/telegram-ui';

export interface OnboardingLayoutProps extends PropsWithChildren {
  /** Screen title */
  title: string;
  /** Optional description text below title */
  description?: string;
  /** Optional footer content (e.g., help text, links) */
  footer?: React.ReactNode;
}

/**
 * Layout wrapper for onboarding screens
 *
 * Mobile-first design with:
 * - 320px minimum width support
 * - Centered content with max-width constraint
 * - Adequate padding for touch targets
 */
export function OnboardingLayout({
  title,
  description,
  footer,
  children,
}: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen min-w-[320px] flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header Section */}
        <div className="space-y-2 text-center">
          <Title level="1" weight="1" className="text-2xl sm:text-3xl">
            {title}
          </Title>
          {description && (
            <Text className="text-base text-gray-600 dark:text-gray-400">
              {description}
            </Text>
          )}
        </div>

        {/* Content Section */}
        <div className="space-y-4">{children}</div>

        {/* Footer Section */}
        {footer && (
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
