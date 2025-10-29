/**
 * Settings Page
 *
 * Main settings page for fully onboarded users.
 * Provides access to wallet and buddy management options.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md (User Story 3)
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Title, Text, Section } from '@telegram-apps/telegram-ui';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 space-y-2">
        <Title level="1" weight="1" className="text-2xl sm:text-3xl">
          {t('title', 'Settings')}
        </Title>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {t('subtitle', 'Manage your account and preferences')}
        </Text>
      </div>

      {/* Settings Sections */}
      <Section className="space-y-4">
        {/* Wallet Settings Link */}
        <Link
          href="/settings/wallet"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {t('wallet.title', 'Wallet')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('wallet.description', 'Manage your TON wallet')}
              </p>
            </div>
          </div>
          <span className="text-gray-400 dark:text-gray-600">›</span>
        </Link>

        {/* Buddy Settings Link */}
        <Link
          href="/settings/buddy"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {t('buddy.title', 'Buddy')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('buddy.description', 'Manage your buddy relationship')}
              </p>
            </div>
          </div>
          <span className="text-gray-400 dark:text-gray-600">›</span>
        </Link>
      </Section>

      {/* About Section */}
      <Section className="mt-8 space-y-2 border-t border-gray-200 pt-6 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('app.version', 'Version')} 1.0.0
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('app.description', 'Corgi Buddy - A Telegram Mini App')}
        </p>
      </Section>
    </MainLayout>
  );
}
