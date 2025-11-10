/**
 * Wallet Settings Page
 *
 * Wallet management page accessible from settings.
 * Provides TON wallet connection and management features.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md (User Story 3)
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { WalletSettings } from '@/components/wallet/WalletSettings';
import { Button } from '@telegram-apps/telegram-ui';

function WalletSettingsContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return null; // AuthProvider will handle redirecting to login
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Back button */}
        <Link href="/settings">
          <Button size="s" mode="outline">
            ← Back to Settings
          </Button>
        </Link>

        {/* Wallet settings */}
        <div>
          <h1 className="text-2xl font-bold mb-4">Wallet Settings</h1>
          <WalletSettings />
        </div>
      </div>
    </MainLayout>
  );
}

export default function WalletSettingsPage() {
  return (
    <Root>
      <AuthProvider>
        <WalletSettingsContent />
      </AuthProvider>
    </Root>
  );
}
