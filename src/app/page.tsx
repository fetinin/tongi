'use client';

import Link from 'next/link';
import { Cell, List, Section } from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { MainLayout } from '@/components/layout/MainLayout';

function HomeContent() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[color:var(--tg-theme-secondary-bg-color,#f5f5f7)] p-5">
        <p className="text-sm font-medium text-[color:var(--tg-theme-hint-color,#6b6b6d)]">
          Welcome back{user ? `, ${user.firstName}` : ''}!
        </p>
        <p className="mt-2 text-base text-[color:var(--tg-theme-text-color,#1c1c1d)]">
          Jump into corgi sightings or review your buddy and wallet settings.
        </p>
      </div>

      <List>
        <Section header="Quick actions">
          <Cell
            Component={Link}
            href="/corgi"
            subtitle="Report sightings, confirm your buddy, and track your activity"
          >
            Open Corgi Sighting
          </Cell>
          <Cell
            Component={Link}
            href="/settings"
            subtitle="Manage your wallet connection and buddy relationship"
          >
            Open Settings
          </Cell>
        </Section>

        <Section header="Need a refresher?">
          <Cell
            Component={Link}
            href="/onboarding/welcome"
            subtitle="Reconnect your wallet or restart onboarding if needed"
          >
            Review Wallet Step
          </Cell>
          <Cell
            Component={Link}
            href="/onboarding/buddy"
            subtitle="Find a new buddy or check pending requests"
          >
            Review Buddy Step
          </Cell>
        </Section>
      </List>
    </div>
  );
}

export default function HomePage() {
  return (
    <MainLayout title="Home" subtitle="Your Corgi Buddy hub">
      <HomeContent />
    </MainLayout>
  );
}
