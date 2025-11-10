'use client';

import React, { useCallback, useState } from 'react';
import {
  List,
  Section,
  Cell,
  Button,
  Placeholder,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { WishForm, useWishCreation } from '@/components/wish/WishForm';
import { WishApproval, useWishApproval } from '@/components/wish/WishApproval';
import { WishList } from '@/components/wish/WishList';

type WishesView = 'overview' | 'approvals' | 'my';

function WishesContent() {
  const { isAuthenticated } = useAuth();

  const { isOpen, openWishForm, closeWishForm } = useWishCreation();
  const { handleWishProcessed } = useWishApproval();

  const [activeView, setActiveView] = useState<WishesView>('overview');

  const handleWishCreated = useCallback(() => {
    // After creating a wish, go to "My Wishes" to see it listed
    setActiveView('my');
  }, []);

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to manage your wishes."
        action={
          <Button size="l" onClick={() => (window.location.href = '/')}>
            Go to Login
          </Button>
        }
      >
        <div className="text-6xl mb-4">💝</div>
      </Placeholder>
    );
  }

  if (activeView === 'overview') {
    return (
      <List>
        <Section header="Wishes">
          <Cell
            subtitle="Create a new wish and send it to your buddy for approval"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                <span className="text-lg">➕</span>
              </div>
            }
            after={
              <Button size="s" onClick={openWishForm}>
                Create Wish
              </Button>
            }
          >
            New Wish
          </Cell>
        </Section>

        <Section header="Buddy Approvals">
          <Cell
            subtitle="Approve or reject wishes sent by your buddy"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <span className="text-lg">✅</span>
              </div>
            }
            after={
              <Button
                size="s"
                mode="outline"
                onClick={() => setActiveView('approvals')}
              >
                View Pending
              </Button>
            }
          >
            Pending Approvals
          </Cell>
        </Section>

        <Section header="Your Wishes">
          <Cell
            subtitle="Track your wishes and their status"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <span className="text-lg">📋</span>
              </div>
            }
            after={
              <Button
                size="s"
                mode="outline"
                onClick={() => setActiveView('my')}
              >
                View List
              </Button>
            }
          >
            My Wishes
          </Cell>
        </Section>

        {/* Creation Modal */}
        <WishForm
          isOpen={isOpen}
          onClose={closeWishForm}
          onWishCreated={handleWishCreated}
          onError={(e) => console.error(e)}
        />
      </List>
    );
  }

  if (activeView === 'approvals') {
    return (
      <List>
        <Section header="Navigation">
          <div className="p-4 flex gap-2">
            <Button
              size="s"
              mode="outline"
              onClick={() => setActiveView('overview')}
            >
              ← Overview
            </Button>
            <Button size="s" mode="outline" onClick={() => setActiveView('my')}>
              My Wishes
            </Button>
          </div>
        </Section>

        <WishApproval
          onWishProcessed={handleWishProcessed}
          refreshInterval={15000}
        />
      </List>
    );
  }

  if (activeView === 'my') {
    return (
      <List>
        <Section header="Navigation">
          <div className="p-4 flex gap-2">
            <Button
              size="s"
              mode="outline"
              onClick={() => setActiveView('overview')}
            >
              ← Overview
            </Button>
            <Button size="s" onClick={openWishForm}>
              Create Wish
            </Button>
          </div>
        </Section>

        <WishList onRefresh={() => {}} />

        {/* Creation Modal available from this view as well */}
        <WishForm
          isOpen={isOpen}
          onClose={closeWishForm}
          onWishCreated={handleWishCreated}
          onError={(e) => console.error(e)}
        />
      </List>
    );
  }

  return null;
}

export default function WishesPage() {
  return <WishesContent />;
}
