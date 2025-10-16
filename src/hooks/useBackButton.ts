'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { backButton } from '@telegram-apps/sdk-react';

/**
 * Custom hook to manage Telegram back button visibility and navigation
 * - Hides back button on homepage (/)
 * - Shows back button on all other pages
 * - Navigates back in browser history when clicked
 */
export function useBackButton() {
  const pathname = usePathname();

  useEffect(() => {
    // Only run if back button methods are available
    if (!backButton.show.isAvailable() || !backButton.hide.isAvailable()) {
      return () => {}; // Return no-op cleanup to prevent dangling subscriptions
    }

    // Register click handler once (not conditional on pathname)
    const handleBackClick = () => {
      window.history.back();
    };

    const unsubscribe = backButton.onClick(handleBackClick);

    // Control visibility based on pathname
    const isHomePage = pathname === '/';
    if (isHomePage) {
      backButton.hide();
    } else {
      backButton.show();
    }

    // Always return cleanup to properly unsubscribe
    return () => {
      unsubscribe();
    };
  }, [pathname]);
}
