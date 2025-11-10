'use client';

import React from 'react';
import { List, Section, Button, Placeholder } from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import {
  MarketplaceGrid,
  useMarketplaceGrid,
} from '@/components/marketplace/MarketplaceGrid';
import {
  PurchaseModal,
  usePurchaseModal,
} from '@/components/marketplace/PurchaseModal';

function MarketplaceContent() {
  const { isAuthenticated } = useAuth();

  const {
    selectedWish,
    isOpen,
    openModal,
    closeModal,
    handlePurchaseStart,
    handlePurchaseSuccess,
    handlePurchaseError,
  } = usePurchaseModal();

  const { handleRefresh } = useMarketplaceGrid();

  if (!isAuthenticated) {
    return (
      <Placeholder
        header="Authentication Required"
        description="Please log in to browse and purchase wishes in the marketplace."
        action={
          <Button size="l" onClick={() => (window.location.href = '/')}>
            Go to Login
          </Button>
        }
      >
        <div className="text-6xl mb-4">🏪</div>
      </Placeholder>
    );
  }

  return (
    <List>
      <Section header="Marketplace">
        <MarketplaceGrid
          onWishSelect={(wish) => openModal(wish)}
          onRefresh={handleRefresh}
        />
      </Section>

      <PurchaseModal
        wish={selectedWish}
        isOpen={isOpen}
        onClose={closeModal}
        onPurchaseStart={handlePurchaseStart}
        onPurchaseSuccess={handlePurchaseSuccess}
        onPurchaseError={handlePurchaseError}
      />
    </List>
  );
}

export default function MarketplacePage() {
  return <MarketplaceContent />;
}
