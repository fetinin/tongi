'use client';

import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { WalletSettings } from '@/components/wallet/WalletSettings';

function WalletPageContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return null; // AuthProvider will handle redirecting to login
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet Settings</h1>
      <WalletSettings />
    </main>
  );
}

export default function WalletPage() {
  return (
    <Root>
      <AuthProvider>
        <WalletPageContent />
      </AuthProvider>
    </Root>
  );
}
