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
      return;
    }

    const isHomePage = pathname === '/';

    if (isHomePage) {
      // Hide back button on homepage
      backButton.hide();
    } else {
      // Show back button on other pages
      backButton.show();

      // Set up click handler to navigate back
      const handleBackClick = () => {
        window.history.back();
      };

      const unsubscribe = backButton.onClick(handleBackClick);

      // Cleanup: remove click listener when component unmounts or route changes
      return () => {
        unsubscribe();
      };
    }
  }, [pathname]);
}
