'use client';

import React from 'react';
import { List, Section } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { BuddyStatus } from '@/components/buddy/BuddyStatus';
import { BuddySearch } from '@/components/buddy/BuddySearch';

function BuddyManagementContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return null; // AuthProvider will handle redirecting to login
  }

  return (
    <List>
      <Section header="Buddy Status">
        <BuddyStatus />
      </Section>

      <Section header="Find & Connect">
        <BuddySearch />
      </Section>
    </List>
  );
}

export default function BuddyPage() {
  return (
    <Root>
      <AuthProvider>
        <BuddyManagementContent />
      </AuthProvider>
    </Root>
  );
}