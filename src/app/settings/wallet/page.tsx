'use client';

import { useAuth } from '@/components/Auth/AuthProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { WalletSettings } from '@/components/wallet/WalletSettings';

function WalletSettingsContent() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[color:var(--tg-theme-secondary-bg-color,#f5f5f7)] p-4">
        <h2 className="text-base font-semibold text-[color:var(--tg-theme-text-color,#1c1c1d)]">
          Wallet connection
        </h2>
        <p className="mt-2 text-sm text-[color:var(--tg-theme-subtitle-text-color,#6b6b6d)]">
          {user?.tonWalletAddress
            ? `Currently connected to ${user.tonWalletAddress.slice(0, 12)}…`
            : 'Connect your TON wallet to unlock Corgi Buddy rewards.'}
        </p>
      </div>

      <WalletSettings />
    </div>
  );
}

export default function WalletSettingsPage() {
  return (
    <MainLayout
      title="Wallet"
      subtitle="Connect, disconnect, or update your TON wallet"
      contentClassName="pt-0"
    >
      <WalletSettingsContent />
    </MainLayout>
  );
}
