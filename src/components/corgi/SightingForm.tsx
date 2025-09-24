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
} from '@telegram-apps/telegram-ui';
import { useAuth } from '@/components/Auth/AuthProvider';

// Types for corgi sighting
interface CorgiSightingResult {
  id: number;
  reporterId: number;
  buddyId: number;
  corgiCount: number;
  status: 'pending' | 'confirmed' | 'denied';
  createdAt: string;
  respondedAt: string | null;
}

interface SightingFormProps {
  /** Whether the sighting form modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when sighting is successfully reported */
  onSightingReported?: (result: CorgiSightingResult) => void;
  /** Callback when reporting fails */
  onError?: (error: string) => void;
}

export function SightingForm({
  isOpen,
  onClose,
  onSightingReported,
  onError,
}: SightingFormProps) {
  const { token, isAuthenticated } = useAuth();
  const [corgiCount, setCorgiCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [sightingResult, setSightingResult] =
    useState<CorgiSightingResult | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  /**
   * Validate corgi count input
   */
  const validateCorgiCount = useCallback((count: number): string => {
    if (!Number.isInteger(count) || count < 1) {
      return 'Must spot at least 1 corgi';
    }
    if (count > 100) {
      return 'Maximum 100 corgis per sighting';
    }
    return '';
  }, []);

  /**
   * Handle corgi count change with validation
   */
  const handleCorgiCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 1;
      setCorgiCount(value);
      setValidationError(validateCorgiCount(value));
    },
    [validateCorgiCount]
  );

  /**
   * Submit corgi sighting report
   */
  const submitSighting = useCallback(async () => {
    if (!isAuthenticated || !token) {
      const error = 'Authentication required to report sighting';
      onError?.(error);
      return;
    }

    // Validate input
    const error = validateCorgiCount(corgiCount);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsLoading(true);
    setValidationError('');

    try {
      const response = await fetch('/api/corgi/sightings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          corgiCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to report sighting');
      }

      const result: CorgiSightingResult = await response.json();
      setSightingResult(result);

      // Notify parent component
      onSightingReported?.(result);
    } catch (err) {
      console.error('Sighting report error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to report sighting';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    corgiCount,
    isAuthenticated,
    token,
    validateCorgiCount,
    onSightingReported,
    onError,
  ]);

  /**
   * Handle modal close and reset state
   */
  const handleClose = useCallback(() => {
    setSightingResult(null);
    setCorgiCount(1);
    setValidationError('');
    onClose();
  }, [onClose]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submitSighting();
    },
    [submitSighting]
  );

  return (
    <Modal
      header="Report Corgi Sighting"
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      {/* Success State */}
      {sightingResult && (
        <div className="p-4">
          <Placeholder
            header="Sighting Reported!"
            description={`You've reported spotting ${sightingResult.corgiCount} corgi${sightingResult.corgiCount > 1 ? 's' : ''}! Your buddy will receive a notification to confirm this sighting. Once confirmed, you'll earn Corgi coins.`}
          >
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <span className="text-2xl">🐕</span>
            </div>
          </Placeholder>

          <div className="mt-6 flex justify-center">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}

      {/* Form State */}
      {!sightingResult && (
        <form onSubmit={handleSubmit} className="p-4">
          {/* Sighting Details */}
          <List>
            <Section
              header="Sighting Details"
              footer="Your buddy will need to confirm this sighting before you earn Corgi coins"
            >
              <div className="p-4">
                <div>
                  <Input
                    header="Number of Corgis Spotted"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="1"
                    value={corgiCount.toString()}
                    onChange={handleCorgiCountChange}
                    status={validationError ? 'error' : undefined}
                  />
                  {validationError && (
                    <Caption level="1" className="text-red-500 mt-1">
                      {validationError}
                    </Caption>
                  )}
                </div>
              </div>
            </Section>
          </List>

          {/* Information Section */}
          <Section header="How It Works" className="mt-4">
            <Caption level="1" className="px-4 py-2 text-gray-600">
              When you report a corgi sighting:
            </Caption>
            <ul className="px-4 text-sm text-gray-600 space-y-1">
              <li>• Your buddy receives a confirmation request</li>
              <li>• They can approve or deny the sighting</li>
              <li>• Approved sightings earn you Corgi coins</li>
              <li>• You can only have one pending sighting at a time</li>
            </ul>
          </Section>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="submit"
              size="l"
              disabled={isLoading || !isAuthenticated || !!validationError}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="s" />
                  Reporting Sighting...
                </div>
              ) : (
                `Report ${corgiCount} Corgi${corgiCount > 1 ? 's' : ''}`
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
              Please log in to report corgi sightings
            </Caption>
          )}
        </form>
      )}
    </Modal>
  );
}

/**
 * Hook to manage sighting form modal state
 */
export function useCorgiSighting() {
  const [isOpen, setIsOpen] = useState(false);

  const openSightingForm = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSightingForm = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openSightingForm,
    closeSightingForm,
  };
}

export default SightingForm;
