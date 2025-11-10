/**
 * BottomNavigation Component
 *
 * Mobile-first bottom tab navigation for the main app after onboarding.
 * Provides navigation between Corgi Sighting and Settings screens.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md and Constitution principles
 */

'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  testId?: string;
}

export interface BottomNavigationProps {
  /** Navigation items */
  items: BottomNavigationItem[];
  /** Optional CSS class */
  className?: string;
}

/**
 * Simple icon components for navigation
 * Using SVG for Telegram UI compatibility
 */
function DogIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      className={`h-6 w-6 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2c-3.3 0-4.8 1.5-5.6 2.8-.8 1.3-.9 3-1 4.2-.1 1.2-.2 2.5-.5 3.5-.7 2.3-2.2 3.5-3 4 1.3 1.2 3.8 2.5 6.1 2.5 1.2 0 2.3-.3 3 -.7.7.4 1.8.7 3 .7 2.3 0 4.8-1.3 6.1-2.5-.8-.5-2.3-1.7-3-4-.3-1-.4-2.3-.5-3.5-.1-1.2-.2-2.9-1-4.2C16.8 3.5 15.3 2 12 2zm-2 7c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm4 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z" />
    </svg>
  );
}

function SettingsIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      className={`h-6 w-6 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M19.1 12.9a6 6 0 0 0 .1-1.9 6 6 0 0 0-.1-1.9l2.1-1.6c.2-.1.2-.6.1-.9l-2-3.5c-.1-.2-.6-.3-.9-.2l-2.5 1c-.5-.4-1.1-.7-1.7-1l-.4-2.6c0-.2-.2-.4-.5-.4h-4c-.2 0-.4.2-.4.5l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.5-1c-.2-.1-.8 0-.9.2l-2 3.5c-.1.2-.1.7.1.9l2.1 1.6c-.1.6-.1 1.2-.1 1.9s.1 1.3.1 1.9l-2.1 1.6c-.2.1-.2.6-.1.9l2 3.5c.1.2.6.3.9.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.2 0 .4-.2.4-.5l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.8 0 .9-.2l2-3.5c.1-.2.1-.7-.1-.9l-2.1-1.6zM12 15.6c-2 0-3.6-1.6-3.6-3.6s1.6-3.6 3.6-3.6 3.6 1.6 3.6 3.6-1.6 3.6-3.6 3.6z" />
    </svg>
  );
}

/**
 * BottomNavigation Component
 *
 * Mobile-first design with:
 * - Fixed bottom position for easy thumb access
 * - 44px minimum height for touch targets (accessibility)
 * - Active state indication with color change
 * - Smooth transitions
 * - Dark mode support via Telegram theme
 */
export function BottomNavigation({
  items,
  className = '',
}: BottomNavigationProps) {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => {
      // Handle root and corgi paths
      if (href === '/' && pathname === '/') return true;
      if (href === '/corgi' && pathname.includes('/corgi')) return true;
      if (href === '/settings' && pathname.includes('/settings')) return true;
      return false;
    },
    [pathname]
  );

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${className}`}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[3rem] min-w-[3rem] flex-1 items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:focus:ring-blue-400 ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
              data-testid={item.testId || `nav-${item.href}`}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6">{item.icon}</div>
                <span className="text-xs">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Helper function to create navigation items for the bottom navigation
 *
 * @returns Array of navigation items with corgi and settings screens
 */
export function createDefaultNavigationItems(): BottomNavigationItem[] {
  return [
    {
      href: '/corgi',
      label: '🐕',
      icon: <DogIcon isActive={false} />,
      testId: 'nav-corgi',
    },
    {
      href: '/settings',
      label: '⚙️',
      icon: <SettingsIcon isActive={false} />,
      testId: 'nav-settings',
    },
  ];
}
