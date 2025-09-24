'use client';

import React, { useState, useCallback } from 'react';
import { List, Section, Cell, Button, Placeholder } from '@telegram-apps/telegram-ui';
import { Root } from '@/components/Root/Root';
import { AuthProvider, useAuth } from '@/components/Auth/AuthProvider';
import { SightingForm, useCorgiSighting } from '@/components/corgi/SightingForm';
import { ConfirmationList, useCorgiConfirmations } from '@/components/corgi/ConfirmationList';
import { SightingHistory, useCorgiSightingHistory } from '@/components/corgi/SightingHistory';

function CorgiSightingContent() {
  const { isAuthenticated, user } = useAuth();
  const { isOpen, openSightingForm, closeSightingForm } = useCorgiSighting();
  const { handleConfirmationProcessed } = useCorgiConfirmations();
  const { triggerRefresh } = useCorgiSightingHistory();

  // State for managing view sections
  const [activeSection, setActiveSection] = useState<'overview' | 'confirmations' | 'history'>('overview');

  // Handle successful sighting report
  const handleSightingReported = useCallback(() => {
    // Refresh history to show new sighting
    triggerRefresh();
    // Auto-switch to history view to show the reported sighting
    setActiveSection('history');
  }, [triggerRefresh]);

  // Handle confirmation processed
  const handleConfirmationComplete = useCallback((sightingId: number, confirmed: boolean) => {
    // Call the original handler
    handleConfirmationProcessed(sightingId, confirmed);
    // Refresh history if the user confirmed a sighting (buddy earned coins)
    if (confirmed) {
      triggerRefresh();
    }
  }, [handleConfirmationProcessed, triggerRefresh]);

  // Handle sighting form error
  const handleSightingError = useCallback((error: string) => {
    // In a real app, you might want to show a toast notification
    console.error('Sighting error:', error);
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to access corgi sighting features. You need an active buddy relationship to report and confirm sightings."
        action={
          <Button size="l" onClick={() => window.location.href = '/'}>
            Go to Login
          </Button>
        }
      >
        <div className="text-6xl mb-4">🐕</div>
      </Placeholder>
    );
  }

  // Overview section with main actions
  if (activeSection === 'overview') {
    return (
      <List>
        <Section header="Corgi Spotting">
          <Cell
            subtitle="Report a corgi sighting to earn Corgi coins"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                <span className="text-lg">🐕</span>
              </div>
            }
            after={
              <Button size="s" onClick={openSightingForm}>
                Spot Corgi
              </Button>
            }
          >
            Report Sighting
          </Cell>
        </Section>

        <Section header="Buddy Confirmations">
          <Cell
            subtitle="Confirm or deny your buddy's corgi sightings"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <span className="text-lg">✅</span>
              </div>
            }
            after={
              <Button size="s" mode="outline" onClick={() => setActiveSection('confirmations')}>
                View Pending
              </Button>
            }
          >
            Pending Confirmations
          </Cell>
        </Section>

        <Section header="Your Activity">
          <Cell
            subtitle="View your corgi sighting history and statistics"
            before={
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <span className="text-lg">📊</span>
              </div>
            }
            after={
              <Button size="s" mode="outline" onClick={() => setActiveSection('history')}>
                View History
              </Button>
            }
          >
            Sighting History
          </Cell>
        </Section>

        <Section header="How It Works">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 bg-orange-100 rounded-full text-sm">
                1
              </div>
              <div className="text-sm">
                <strong>Spot Corgis:</strong> Report when you see corgis in real life
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full text-sm">
                2
              </div>
              <div className="text-sm">
                <strong>Buddy Confirms:</strong> Your buddy verifies your sighting
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full text-sm">
                3
              </div>
              <div className="text-sm">
                <strong>Earn Coins:</strong> Get Corgi coins for confirmed sightings
              </div>
            </div>
          </div>
        </Section>

        {/* Sighting Form Modal */}
        <SightingForm
          isOpen={isOpen}
          onClose={closeSightingForm}
          onSightingReported={handleSightingReported}
          onError={handleSightingError}
        />
      </List>
    );
  }

  // Confirmations section
  if (activeSection === 'confirmations') {
    return (
      <List>
        <Section header="Navigation">
          <div className="p-4 flex gap-2">
            <Button size="s" mode="outline" onClick={() => setActiveSection('overview')}>
              ← Overview
            </Button>
            <Button size="s" mode="outline" onClick={() => setActiveSection('history')}>
              History
            </Button>
          </div>
        </Section>

        <ConfirmationList
          onConfirmationProcessed={handleConfirmationComplete}
          refreshInterval={10000} // Refresh every 10 seconds for real-time feel
        />
      </List>
    );
  }

  // History section
  if (activeSection === 'history') {
    return (
      <List>
        <Section header="Navigation">
          <div className="p-4 flex gap-2">
            <Button size="s" mode="outline" onClick={() => setActiveSection('overview')}>
              ← Overview
            </Button>
            <Button size="s" mode="outline" onClick={() => setActiveSection('confirmations')}>
              Confirmations
            </Button>
          </div>
        </Section>

        <SightingHistory
          onHistoryUpdated={() => {}}
          refreshInterval={30000} // Refresh every 30 seconds
          limit={50} // Show last 50 sightings
        />
      </List>
    );
  }

  return null;
}

export default function CorgiPage() {
  return (
    <Root>
      <AuthProvider>
        <CorgiSightingContent />
      </AuthProvider>
    </Root>
  );
}