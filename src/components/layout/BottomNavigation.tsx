'use client';

import { useMemo } from 'react';
import { TabsList } from '@telegram-apps/telegram-ui';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationItem {
  id: 'corgi' | 'settings';
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavigationItem[] = [
  {
    id: 'corgi',
    label: 'Corgi',
    href: '/corgi',
    icon: '🐕',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: '⚙️',
  },
];

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const activeId = useMemo(() => {
    if (!pathname) {
      return 'corgi';
    }

    const matchingItem = NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );

    return matchingItem ? matchingItem.id : 'corgi';
  }, [pathname]);

  return (
    <nav
      aria-label="Primary navigation"
      className="sticky bottom-0 left-0 right-0 z-40 border-t border-black/5 bg-[color:var(--tg-theme-bg-color,#ffffff)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--tg-theme-bg-color,#ffffff)]/75"
    >
      <TabsList className="mx-auto flex max-w-xl justify-around px-2 py-1 text-sm">
        {NAV_ITEMS.map((item) => (
          <TabsList.Item
            key={item.id}
            selected={activeId === item.id}
            aria-current={activeId === item.id ? 'page' : undefined}
            className="flex items-center gap-1 text-sm font-medium text-[color:var(--tg-theme-text-color,#1c1c1d)]"
            onClick={() => {
              if (pathname !== item.href) {
                router.push(item.href);
              }
            }}
          >
            <span aria-hidden className="text-xl leading-none">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </TabsList.Item>
        ))}
      </TabsList>
    </nav>
  );
}

export default BottomNavigation;
