'use client';

import Link from 'next/link';
import { List, Section, Cell, Placeholder } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';

function MainAppContent() {
  const { isAuthenticated, user, login } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <Placeholder
        header="Welcome to Corgi Buddy"
        description="Connect with your Telegram account to start earning Corgi coins by spotting corgis with your buddy!"
        action={
          <button
            onClick={login}
            className="bg-blue-500 text-white px-6 py-2 rounded-full"
          >
            Get Started
          </button>
        }
      >
        <div className="text-6xl mb-4">🐕</div>
      </Placeholder>
    );
  }

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

      <Section header="Wishes & Marketplace">
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
      </Section>

      <Section header="Account">
        <Cell
          Component={Link}
          href="/wallet"
          subtitle={user.tonWalletAddress ? `Connected: ${user.tonWalletAddress.slice(0, 8)}...` : 'Connect your TON wallet'}
        >
          Wallet & Transactions
        </Cell>
        <Cell
          Component={Link}
          href="/transactions"
          subtitle="View your earning history"
        >
          Transaction History
        </Cell>
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
