'use client';

import React from 'react';
import { List, Section, Placeholder, Button } from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { TransactionHistory } from '@/components/transactions/TransactionHistory';

function TransactionsContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to view your transaction history."
        action={
          <Button size="l" onClick={() => (window.location.href = '/')}>
            Go to Login
          </Button>
        }
      >
        <div className="text-6xl mb-4">💳</div>
      </Placeholder>
    );
  }

  return (
    <List>
      <Section header="Transactions">
        <TransactionHistory />
      </Section>
    </List>
  );
}

export default function TransactionsPage() {
  return <TransactionsContent />;
}
