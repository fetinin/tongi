'use client';

import Link from 'next/link';
import { List, Section, Cell, Placeholder } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import {
  useOnboardingRedirect,
  isOnboardingComplete,
} from '@/hooks/useOnboardingGuard';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OnboardingError } from '@/components/onboarding/OnboardingError';

function MainAppContent() {
  const { isAuthenticated, user, login } = useAuth();
  const { onboardingState, isLoading, error, retry } =
    useOnboardingRedirect('complete');

  // Show login prompt if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Placeholder
        header="Welcome to Corgi Buddy"
        description="Connect with your Telegram account to start earning Corgi coins by spotting corgis with your buddy!"
        action={
          <button
            onClick={login}
            className="bg-corgi-black text-corgi-white px-6 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        }
      >
        <div className="text-6xl mb-4">🐕</div>
      </Placeholder>
    );
  }

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <OnboardingLayout title="Loading">
        <Placeholder description="Checking your status..." />
      </OnboardingLayout>
    );
  }

  // Show error if onboarding status check failed
  if (error) {
    return (
      <OnboardingLayout title="Connection Error">
        <OnboardingError error={error} onRetry={retry} />
      </OnboardingLayout>
    );
  }

  // If onboarding is not complete, show redirect message (actual redirect happens in useOnboardingRedirect)
  if (!isOnboardingComplete(onboardingState)) {
    return (
      <OnboardingLayout title="Redirecting">
        <Placeholder description="Setting up your account..." />
      </OnboardingLayout>
    );
  }

  // Onboarding complete - show main app
  return (
    <List>
      <Section header={`Welcome back, ${user.firstName}!`}>
        <Cell
          Component={Link}
          href="/buddy"
          subtitle="Find and pair with another user"
        >
          Buddy Management
        </Cell>
        <Cell
          Component={Link}
          href="/corgi"
          subtitle="Report corgi sightings for Corgi coins"
        >
          Corgi Spotting
        </Cell>
      </Section>

      {/* TODO: Uncomment when Wishes & Marketplace features are ready */}
      {/* <Section header="Wishes & Marketplace">
        <Cell
          Component={Link}
          href="/wishes"
          subtitle="Create and manage your wish list"
        >
          My Wishes
        </Cell>
        <Cell
          Component={Link}
          href="/marketplace"
          subtitle="Browse community wishes to fulfill"
        >
          Marketplace
        </Cell>
      </Section> */}

      <Section header="Account">
        <Cell
          Component={Link}
          href="/wallet"
          subtitle={
            user.tonWalletAddress
              ? `Connected: ${user.tonWalletAddress.slice(0, 8)}...`
              : 'Connect your TON wallet'
          }
        >
          Wallet & Transactions
        </Cell>
        {/* TODO: Uncomment when Transaction History feature is ready */}
        {/* <Cell
          Component={Link}
          href="/transactions"
          subtitle="View your earning history"
        >
          Transaction History
        </Cell> */}
      </Section>
    </List>
  );
}

export default function HomePage() {
  return (
    <Root>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </Root>
  );
}
