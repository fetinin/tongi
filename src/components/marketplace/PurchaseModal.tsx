'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Spinner,
  Text,
  Caption,
  Badge,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';
import { useTonWalletContext } from '@/components/Wallet';

// Types for marketplace wish data
interface MarketplaceWishData {
  id: number;
  creatorId: number;
  buddyId: number;
  description: string;
  proposedAmount: number;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  purchasedAt: string | null;
  purchasedBy: number | null;
  creator: {
    id: number;
    firstName: string;
    createdAt: string;
  };
  timeRemaining: string;
}

interface PurchaseResponse {
  transactionId: number;
  tonTransaction: {
    to: string;
    amount: string;
    payload: string;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

interface PurchaseModalProps {
  /** The wish to be purchased */
  wish: MarketplaceWishData | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should be closed */
  onClose: () => void;
  /** Callback when purchase is initiated */
  onPurchaseStart?: (wish: MarketplaceWishData) => void;
  /** Callback when purchase is completed successfully */
  onPurchaseSuccess?: (
    wish: MarketplaceWishData,
    transactionId: number
  ) => void;
  /** Callback when purchase fails */
  onPurchaseError?: (wish: MarketplaceWishData, error: string) => void;
}

type PurchaseState = 'idle' | 'confirming' | 'processing' | 'success' | 'error';

export function PurchaseModal({
  wish,
  isOpen,
  onClose,
  onPurchaseStart,
  onPurchaseSuccess,
  onPurchaseError,
}: PurchaseModalProps) {
  const { token, isAuthenticated } = useAuth();
  const { isConnected, connectWallet, sendTransaction } = useTonWalletContext();
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<number | null>(null);

  // Reset state when modal opens/closes or wish changes
  useEffect(() => {
    if (isOpen && wish) {
      setPurchaseState('idle');
      setError(null);
      setTransactionId(null);
    }
  }, [isOpen, wish]);

  /**
   * Handle purchase initiation
   */
  const handlePurchase = useCallback(async () => {
    if (!wish || !isAuthenticated || !token) {
      setError('Authentication required');
      return;
    }

    if (!isConnected) {
      try {
        await connectWallet();
      } catch (e) {
        setError('Wallet connection required');
        return;
      }
    }

    setPurchaseState('confirming');
    setError(null);

    try {
      // Notify parent that purchase is starting
      onPurchaseStart?.(wish);

      setPurchaseState('processing');

      // Call the purchase API
      const response = await fetch(`/api/marketplace/${wish.id}/purchase`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to initiate purchase');
      }

      const purchaseData: PurchaseResponse = await response.json();
      setTransactionId(purchaseData.transactionId);

      // Send transaction via TON Connect
      const boc = await sendTransaction({
        to: purchaseData.tonTransaction.to,
        amount: purchaseData.tonTransaction.amount,
        payload: purchaseData.tonTransaction.payload,
      });

      // Confirm transaction on the server with returned BOC/hash
      const confirmRes = await fetch(
        `/api/transactions/${purchaseData.transactionId}/confirm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactionHash: boc }),
        }
      );

      if (!confirmRes.ok) {
        const errData: ErrorResponse = await confirmRes.json();
        throw new Error(errData.message || 'Failed to confirm transaction');
      }

      setPurchaseState('success');
      onPurchaseSuccess?.(wish, purchaseData.transactionId);
    } catch (err) {
      console.error('Purchase error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to complete purchase';
      setError(errorMessage);
      setPurchaseState('error');
      onPurchaseError?.(wish, errorMessage);
    }
  }, [
    wish,
    isAuthenticated,
    token,
    onPurchaseStart,
    onPurchaseSuccess,
    onPurchaseError,
  ]);

  /**
   * Simulate TON transaction (in real implementation, this would use TON Connect)
   */
  const simulateTonTransaction = async (
    tonTransaction: PurchaseResponse['tonTransaction']
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // TODO: Use tonTransaction parameter for actual TON Connect transaction
      void tonTransaction; // Explicitly mark as unused until real implementation

      // Simulate transaction processing time
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(
            new Error(
              'Transaction failed - insufficient funds or network error'
            )
          );
        }
      }, 2000);
    });
  };

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (purchaseState === 'processing') {
      // Don't allow closing while processing
      return;
    }
    onClose();
  }, [purchaseState, onClose]);

  /**
   * Format amount for display
   */
  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  /**
   * Truncate description if too long
   */
  const truncateDescription = (
    description: string,
    maxLength: number = 150
  ): string => {
    if (description.length <= maxLength) {
      return description;
    }
    return description.slice(0, maxLength) + '...';
  };

  /**
   * Get wish category icon based on content
   */
  const getWishIcon = (description: string): string => {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('dog') || lowerDesc.includes('walk')) return '🐕';
    if (lowerDesc.includes('food') || lowerDesc.includes('cook')) return '🍽️';
    if (lowerDesc.includes('help') || lowerDesc.includes('assist')) return '🤝';
    if (lowerDesc.includes('clean') || lowerDesc.includes('tidy')) return '🧹';
    if (lowerDesc.includes('shop') || lowerDesc.includes('buy')) return '🛒';
    if (lowerDesc.includes('drive') || lowerDesc.includes('ride')) return '🚗';
    return '💝';
  };

  if (!isOpen || !wish) {
    return null;
  }

  const wishIcon = getWishIcon(wish.description);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Purchase Wish</h2>
            <Button
              size="s"
              mode="outline"
              onClick={handleClose}
              disabled={purchaseState === 'processing'}
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Wish Details */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full flex-shrink-0">
              <span className="text-xl">{wishIcon}</span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Text weight="3" className="text-lg">
                  {truncateDescription(wish.description)}
                </Text>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Caption level="1" className="text-gray-600">
                  By {wish.creator.firstName}
                </Caption>
                <Badge type="dot" className="text-green-600">
                  Available
                </Badge>
              </div>

              <div>
                <Caption level="1" className="text-gray-500">
                  {wish.timeRemaining}
                </Caption>
              </div>
            </div>
          </div>

          {/* Purchase Amount */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Text weight="3" className="text-sm text-gray-700">
                  Purchase Amount
                </Text>
                <Text weight="1" className="text-xs text-gray-500">
                  This will be sent to {wish.creator.firstName}
                </Text>
              </div>
              <div className="text-right">
                <Text weight="3" className="text-2xl text-blue-600">
                  {formatAmount(wish.proposedAmount)} ⭐
                </Text>
                <Caption level="1" className="text-gray-600">
                  Corgi coins
                </Caption>
              </div>
            </div>
          </div>

          {/* Purchase State Content */}
          {purchaseState === 'idle' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-sm">⚠️</span>
                  <div>
                    <Text weight="3" className="text-sm text-yellow-800">
                      Transaction Notice
                    </Text>
                    <Caption level="1" className="text-yellow-700">
                      This will initiate a TON blockchain transaction. Make sure
                      you have sufficient balance in your connected wallet.
                    </Caption>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  size="m"
                  mode="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button size="m" onClick={handlePurchase} className="flex-1">
                  Confirm Purchase
                </Button>
              </div>
            </div>
          )}

          {purchaseState === 'confirming' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Spinner size="m" />
                <Text weight="3">Preparing transaction...</Text>
              </div>
              <Caption level="1" className="text-gray-600">
                Setting up your TON transaction
              </Caption>
            </div>
          )}

          {purchaseState === 'processing' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Spinner size="m" />
                <Text weight="3">Processing transaction...</Text>
              </div>
              <Caption level="1" className="text-gray-600">
                Please confirm the transaction in your TON wallet
              </Caption>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">ℹ️</span>
                  <Caption level="1" className="text-blue-800">
                    Do not close this window while the transaction is being
                    processed
                  </Caption>
                </div>
              </div>
            </div>
          )}

          {purchaseState === 'success' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                <span className="text-2xl">✅</span>
              </div>

              <Text weight="3" className="text-lg text-green-800 mb-2">
                Purchase Successful!
              </Text>

              <Caption level="1" className="text-gray-600 mb-4">
                Transaction ID: {transactionId}
              </Caption>

              <Caption level="1" className="text-gray-600 mb-6">
                You have successfully purchased &quot;
                {truncateDescription(wish.description, 50)}&quot; from{' '}
                {wish.creator.firstName}. The Corgi coins have been transferred!
              </Caption>

              <Button size="m" onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}

          {purchaseState === 'error' && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <span className="text-2xl">❌</span>
              </div>

              <Text weight="3" className="text-lg text-red-800 mb-2">
                Purchase Failed
              </Text>

              <Caption level="1" className="text-red-600 mb-6">
                {error || 'An unexpected error occurred during the purchase'}
              </Caption>

              <div className="flex gap-3">
                <Button
                  size="m"
                  mode="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button size="m" onClick={handlePurchase} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage purchase modal state
 */
export function usePurchaseModal() {
  const [selectedWish, setSelectedWish] = useState<MarketplaceWishData | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback((wish: MarketplaceWishData) => {
    setSelectedWish(wish);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Keep wish data for a moment to allow for animations
    setTimeout(() => setSelectedWish(null), 300);
  }, []);

  const handlePurchaseStart = useCallback((wish: MarketplaceWishData) => {
    console.log('Purchase started for wish:', wish.id);
  }, []);

  const handlePurchaseSuccess = useCallback(
    (wish: MarketplaceWishData, transactionId: number) => {
      console.log(
        'Purchase successful for wish:',
        wish.id,
        'Transaction:',
        transactionId
      );
    },
    []
  );

  const handlePurchaseError = useCallback(
    (wish: MarketplaceWishData, error: string) => {
      console.error('Purchase failed for wish:', wish.id, 'Error:', error);
    },
    []
  );

  return {
    selectedWish,
    isOpen,
    openModal,
    closeModal,
    handlePurchaseStart,
    handlePurchaseSuccess,
    handlePurchaseError,
  };
}

export default PurchaseModal;
