/**
 * MainLayout Component
 *
 * Layout wrapper for main app screens after onboarding.
 * Combines content area with fixed bottom navigation bar.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md
 */

'use client';

import React, { type PropsWithChildren, useEffect, useState } from 'react';
import {
  BottomNavigation,
  createDefaultNavigationItems,
} from './BottomNavigation';

export interface MainLayoutProps extends PropsWithChildren {
  /** Optional CSS class for the content wrapper */
  className?: string;
}

/**
 * MainLayout Component
 *
 * Mobile-first design with:
 * - Fixed bottom navigation bar
 * - Content area with padding to prevent overlap with nav
 * - Minimum 320px width support
 * - 44px minimum navigation touch targets
 * - Responsive design for larger screens
 */
export function MainLayout({ children, className = '' }: MainLayoutProps) {
  const [navigationItems, setNavigationItems] = useState(() =>
    createDefaultNavigationItems()
  );

  useEffect(() => {
    // Validate minimum screen width (FR-017)
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 320) {
        console.warn('Minimum screen width is 320px. Current width:', width);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full min-w-[320px] min-h-screen bg-white dark:bg-gray-950">
      {/* Main content area with padding for bottom navigation */}
      <main className={`pb-20 pt-4 px-4 sm:px-6 ${className}`} role="main">
        {children}
      </main>

      {/* Fixed bottom navigation bar */}
      <BottomNavigation items={navigationItems} />
    </div>
  );
}
