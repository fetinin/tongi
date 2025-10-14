'use client';

import React from 'react';
import { List, Section } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { BuddyStatus } from '@/components/buddy/BuddyStatus';
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest, useBuddyRequest } from '@/components/buddy/BuddyRequest';

function BuddyManagementContent() {
  const { isAuthenticated, user } = useAuth();
  const { targetUser, isOpen, openRequest, closeRequest } = useBuddyRequest();
  const [hasBuddy, setHasBuddy] = React.useState(true); // Default to true to hide search initially

  if (!isAuthenticated || !user) {
    return null; // AuthProvider will handle redirecting to login
  }

  return (
    <>
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
    </>
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
