/**
 * Buddy Settings Page
 *
 * Buddy management page accessible from settings.
 * Provides buddy status, search, and relationship management features.
 *
 * Based on specs/005-mobile-first-onboarding/plan.md (User Story 3)
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { List, Section, Button } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { BuddyStatus } from '@/components/buddy/BuddyStatus';
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest, useBuddyRequest } from '@/components/buddy/BuddyRequest';

function BuddySettingsContent() {
  const { isAuthenticated, user } = useAuth();
  const { targetUser, isOpen, openRequest, closeRequest } = useBuddyRequest();
  const [hasBuddy, setHasBuddy] = React.useState(true); // Default to true to hide search initially

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

        {/* Buddy management */}
        <List>
          <BuddyStatus onStatusChange={setHasBuddy} />

          {!hasBuddy && (
            <Section header="Find & Connect">
              <BuddySearch onUserSelect={openRequest} />
            </Section>
          )}
        </List>

        <BuddyRequest
          targetUser={targetUser}
          isOpen={isOpen}
          onClose={closeRequest}
          onRequestSent={() => {
            // Optionally refresh buddy status after successful request
            closeRequest();
          }}
          onError={(error) => {
            console.error('Buddy request failed:', error);
          }}
        />
      </div>
    </MainLayout>
  );
}

export default function BuddySettingsPage() {
  return (
    <Root>
      <AuthProvider>
        <BuddySettingsContent />
      </AuthProvider>
    </Root>
  );
}
