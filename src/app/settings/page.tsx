'use client';

import Link from 'next/link';
import { List, Section, Cell } from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { MainLayout } from '@/components/layout/MainLayout';

function SettingsContent() {
  const { user } = useAuth();

  return (
    <List>
      <Section header="Account management">
        <Cell
          Component={Link}
          href="/settings/wallet"
          subtitle={
            user?.tonWalletAddress
              ? `Connected: ${user.tonWalletAddress.slice(0, 8)}…`
              : 'Connect or disconnect your TON wallet'
          }
        >
          Wallet
        </Cell>
        <Cell
          Component={Link}
          href="/settings/buddy"
          subtitle="Change buddies, review status, or manage requests"
        >
          Buddy
        </Cell>
      </Section>
    </List>
  );
}

export default function SettingsPage() {
  return (
    <MainLayout
      title="Settings"
      subtitle="Manage your wallet connection and buddy relationship"
      contentClassName="pt-0"
    >
      <SettingsContent />
    </MainLayout>
  );
}
