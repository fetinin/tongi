'use client';

import React, { useState, useCallback } from 'react';
import {
  List,
  Section,
  Input,
  Button,
  Modal,
  Placeholder,
  Spinner,
  Caption,
  Text,
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for wish creation
interface WishResult {
  id: number;
  creatorId: number;
  buddyId: number;
  description: string;
  proposedAmount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'purchased';
  createdAt: string;
  acceptedAt: string | null;
  purchasedAt: string | null;
  purchasedBy: number | null;
}

interface WishFormProps {
  /** Whether the wish form modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when wish is successfully created */
  onWishCreated?: (result: WishResult) => void;
  /** Callback when creation fails */
  onError?: (error: string) => void;
}

export function WishForm({
  isOpen,
  onClose,
  onWishCreated,
  onError,
}: WishFormProps) {
  const { token, isAuthenticated } = useAuth();
  const [description, setDescription] = useState<string>('');
  const [proposedAmount, setProposedAmount] = useState<string>('1.00');
  const [isLoading, setIsLoading] = useState(false);
  const [wishResult, setWishResult] = useState<WishResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    description?: string;
    proposedAmount?: string;
  }>({});

  /**
   * Validate description input
   */
  const validateDescription = useCallback((desc: string): string => {
    if (!desc.trim()) {
      return 'Description is required';
    }
    if (desc.length > 500) {
      return 'Description must be 500 characters or less';
    }
    return '';
  }, []);

  /**
   * Validate proposed amount input
   */
  const validateProposedAmount = useCallback((amount: string): string => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Amount must be greater than 0';
    }
    if (numAmount < 0.01) {
      return 'Minimum amount is 0.01 Corgi coins';
    }
    if (numAmount > 1000) {
      return 'Maximum amount is 1000 Corgi coins';
    }
    // Check for valid decimal places (max 2)
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      return 'Amount can have at most 2 decimal places';
    }
    return '';
  }, []);

  /**
   * Handle description change with validation
   */
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDescription(value);

      const error = validateDescription(value);
      setValidationErrors((prev) => ({
        ...prev,
        description: error || undefined,
      }));
    },
    [validateDescription]
  );

  /**
   * Handle proposed amount change with validation
   */
  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setProposedAmount(value);

      const error = validateProposedAmount(value);
      setValidationErrors((prev) => ({
        ...prev,
        proposedAmount: error || undefined,
      }));
    },
    [validateProposedAmount]
  );

  /**
   * Validate all form fields
   */
  const validateForm = useCallback(() => {
    const descError = validateDescription(description);
    const amountError = validateProposedAmount(proposedAmount);

    const errors = {
      description: descError || undefined,
      proposedAmount: amountError || undefined,
    };

    setValidationErrors(errors);
    return !descError && !amountError;
  }, [
    description,
    proposedAmount,
    validateDescription,
    validateProposedAmount,
  ]);

  /**
   * Submit wish creation
   */
  const submitWish = useCallback(async () => {
    if (!isAuthenticated || !token) {
      const error = 'Authentication required to create wish';
      onError?.(error);
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/wishes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: description.trim(),
          proposedAmount: parseFloat(proposedAmount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create wish');
      }

      const result: WishResult = await response.json();
      setWishResult(result);

      // Notify parent component
      onWishCreated?.(result);
    } catch (err) {
      console.error('Wish creation error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create wish';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    description,
    proposedAmount,
    isAuthenticated,
    token,
    validateForm,
    onWishCreated,
    onError,
  ]);

  /**
   * Handle modal close and reset state
   */
  const handleClose = useCallback(() => {
    setWishResult(null);
    setDescription('');
    setProposedAmount('1.00');
    setValidationErrors({});
    onClose();
  }, [onClose]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submitWish();
    },
    [submitWish]
  );

  /**
   * Check if form has validation errors
   */
  const hasValidationErrors = Object.values(validationErrors).some(Boolean);

  return (
    <Modal
      header="Create Wish"
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      {/* Success State */}
      {wishResult && (
        <div className="p-4">
          <Placeholder
            header="Wish Created!"
            description={`Your wish has been sent to your buddy for approval. Once they accept it, it will appear in the marketplace where anyone can purchase it for ${wishResult.proposedAmount} Corgi coins.`}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <span className="text-2xl">💝</span>
            </div>
          </Placeholder>

          <div className="mt-6">
            <Section header="Wish Details">
              <div className="p-4 space-y-2">
                <div>
                  <Text weight="3">Description</Text>
                  <Caption level="1" className="text-gray-600 mt-1">
                    {wishResult.description}
                  </Caption>
                </div>
                <div>
                  <Text weight="3">Proposed Amount</Text>
                  <Caption level="1" className="text-gray-600 mt-1">
                    {wishResult.proposedAmount} Corgi coins
                  </Caption>
                </div>
                <div>
                  <Text weight="3">Status</Text>
                  <Caption level="1" className="text-yellow-600 mt-1">
                    Waiting for buddy approval
                  </Caption>
                </div>
              </div>
            </Section>
          </div>

          <div className="mt-6 flex justify-center">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}

      {/* Form State */}
      {!wishResult && (
        <form onSubmit={handleSubmit} className="p-4">
          {/* Wish Details */}
          <List>
            <Section
              header="Wish Details"
              footer="Your buddy must approve this wish before it appears in the marketplace"
            >
              <div className="p-4 space-y-4">
                <div>
                  <Input
                    header="Description"
                    placeholder="Describe what you'd like someone to do..."
                    value={description}
                    onChange={handleDescriptionChange}
                    status={validationErrors.description ? 'error' : undefined}
                  />
                  {validationErrors.description && (
                    <Caption level="1" className="text-red-500 mt-1">
                      {validationErrors.description}
                    </Caption>
                  )}
                  <Caption level="1" className="text-gray-500 mt-1">
                    {description.length}/500 characters
                  </Caption>
                </div>

                <div>
                  <Input
                    header="Proposed Amount (Corgi coins)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="1000"
                    placeholder="1.00"
                    value={proposedAmount}
                    onChange={handleAmountChange}
                    status={
                      validationErrors.proposedAmount ? 'error' : undefined
                    }
                  />
                  {validationErrors.proposedAmount && (
                    <Caption level="1" className="text-red-500 mt-1">
                      {validationErrors.proposedAmount}
                    </Caption>
                  )}
                  <Caption level="1" className="text-gray-500 mt-1">
                    Amount between 0.01 and 1000 Corgi coins
                  </Caption>
                </div>
              </div>
            </Section>
          </List>

          {/* Information Section */}
          <Section header="How It Works" className="mt-4">
            <Caption level="1" className="px-4 py-2 text-gray-600">
              When you create a wish:
            </Caption>
            <ul className="px-4 text-sm text-gray-600 space-y-1">
              <li>• Your buddy receives an approval request</li>
              <li>• They can accept or reject your wish</li>
              <li>• Accepted wishes appear in the marketplace</li>
              <li>• Anyone can purchase your wish for the proposed amount</li>
              <li>• You receive Corgi coins when someone purchases it</li>
            </ul>
          </Section>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="submit"
              size="l"
              disabled={
                isLoading ||
                !isAuthenticated ||
                hasValidationErrors ||
                !description.trim() ||
                !proposedAmount
              }
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="s" />
                  Creating Wish...
                </div>
              ) : (
                'Send to Buddy for Approval'
              )}
            </Button>

            <Button
              type="button"
              size="l"
              mode="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>

          {/* Authentication Warning */}
          {!isAuthenticated && (
            <Caption level="1" className="text-center mt-4 text-red-500">
              Please log in to create wishes
            </Caption>
          )}
        </form>
      )}
    </Modal>
  );
}

/**
 * Hook to manage wish form modal state
 */
export function useWishCreation() {
  const [isOpen, setIsOpen] = useState(false);

  const openWishForm = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeWishForm = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openWishForm,
    closeWishForm,
  };
}

export default WishForm;
