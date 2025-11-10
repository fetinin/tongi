'use client';

import React from 'react';
import { List, Section } from '@telegram-apps/telegram-ui';
import { MainLayout } from '@/components/layout/MainLayout';
import { BuddyStatus } from '@/components/buddy/BuddyStatus';
import { BuddySearch } from '@/components/buddy/BuddySearch';
import { BuddyRequest, useBuddyRequest } from '@/components/buddy/BuddyRequest';

function BuddySettingsContent() {
  const { targetUser, isOpen, openRequest, closeRequest } = useBuddyRequest();
  const [hasBuddy, setHasBuddy] = React.useState(true);

  return (
    <>
      <List>
        <Section header="Your buddy status">
          <BuddyStatus onStatusChange={setHasBuddy} />
        </Section>

        {!hasBuddy && (
          <Section header="Find a buddy">
            <BuddySearch onUserSelect={openRequest} />
          </Section>
        )}
      </List>

      <BuddyRequest
        targetUser={targetUser}
        isOpen={isOpen}
        onClose={closeRequest}
        onRequestSent={closeRequest}
        onError={(error) => {
          console.error('Buddy request failed:', error);
        }}
      />
    </>
  );
}

export default function BuddySettingsPage() {
  return (
    <MainLayout
      title="Buddy"
      subtitle="Review or change your buddy relationship"
      contentClassName="pt-0"
    >
      <BuddySettingsContent />
    </MainLayout>
  );
}
