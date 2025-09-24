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
        <Cell subtitle="Find and pair with another user">
          <Link href="/buddy">Buddy Management</Link>
        </Cell>
        <Cell subtitle="Report corgi sightings for Corgi coins">
          <Link href="/corgi">Corgi Spotting</Link>
        </Cell>
      </Section>

      <Section header="Wishes & Marketplace">
        <Cell subtitle="Create and manage your wish list">
          <Link href="/wishes">My Wishes</Link>
        </Cell>
        <Cell subtitle="Browse community wishes to fulfill">
          <Link href="/marketplace">Marketplace</Link>
        </Cell>
      </Section>

      <Section header="Account">
        <Cell
          subtitle={user.tonWalletAddress ? `Connected: ${user.tonWalletAddress.slice(0, 8)}...` : 'Connect your TON wallet'}
        >
          Wallet & Transactions
        </Cell>
        <Cell subtitle="View your earning history">
          <Link href="/transactions">Transaction History</Link>
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
