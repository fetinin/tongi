/**
 * OnboardingService - Derive onboarding state from existing database entities
 *
 * Computes onboarding progress from users.ton_wallet_address and buddy_pairs table.
 * NO new database tables - state is entirely derived.
 *
 * Based on specs/005-mobile-first-onboarding/data-model.md
 */

import { User } from '@/models/User';
import { buddyService, BuddyStatusResult } from '@/services/BuddyService';
import { userService, UserNotFoundError } from '@/services/UserService';
import {
  OnboardingState,
  OnboardingStatusResponse,
  OnboardingStep,
  BuddyInfo,
  WalletInfo,
  BuddyPairStatus,
  isBuddyConfirmed,
  isWalletConnected,
} from '@/types/onboarding';

/**
 * Custom error types for OnboardingService operations
 */
export class OnboardingServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OnboardingServiceError';
  }
}

/**
 * OnboardingService class providing onboarding state derivation
 */
export class OnboardingService {
  private static instance: OnboardingService;

  private constructor() {
    // Singleton - no initialization needed (uses existing services)
  }

  /**
   * Singleton instance getter
   */
  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  /**
   * Derive onboarding state from user and buddy data
   *
   * @param user - User entity from database
   * @param buddyStatus - Buddy status from BuddyService
   * @returns Computed onboarding state
   */
  public deriveOnboardingState(
    user: User,
    buddyStatus: BuddyStatusResult
  ): OnboardingState {
    const walletConnected = isWalletConnected(user.ton_wallet_address);
    const buddyConfirmed = isBuddyConfirmed(
      buddyStatus.status as BuddyPairStatus
    );

    let currentStep: OnboardingStep;

    if (!walletConnected) {
      currentStep = 'welcome';
    } else if (!buddyConfirmed) {
      currentStep = 'buddy';
    } else {
      currentStep = 'complete';
    }

    return {
      wallet_connected: walletConnected,
      buddy_confirmed: buddyConfirmed,
      current_step: currentStep,
    };
  }

  /**
   * Get complete onboarding status for a user
   *
   * @param userId - Telegram user ID
   * @returns Complete onboarding status with wallet and buddy info
   */
  public async getOnboardingStatus(
    userId: number
  ): Promise<OnboardingStatusResponse> {
    try {
      // Fetch user data
      const user = await userService.getUserById(userId);
      if (!user) {
        throw new UserNotFoundError(userId);
      }

      // Fetch buddy status
      const buddyStatus = await buddyService.getBuddyStatus(userId);

      // Derive onboarding state
      const onboardingState = this.deriveOnboardingState(user, buddyStatus);

      // Build response
      const response: OnboardingStatusResponse = {
        success: true,
        onboarding: onboardingState,
      };

      // Add wallet info if connected
      if (onboardingState.wallet_connected) {
        response.wallet = {
          address: user.ton_wallet_address,
        };
      }

      // Add buddy info if confirmed
      if (buddyStatus.status !== 'no_buddy' && buddyStatus.buddy) {
        const buddyInfo: BuddyInfo = {
          id: buddyStatus.id!,
          status: buddyStatus.status as BuddyPairStatus,
          profile: buddyStatus.buddy,
          createdAt: buddyStatus.createdAt!,
          confirmedAt: buddyStatus.confirmedAt || null,
        };
        response.buddy = buddyInfo;
      }

      return response;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      throw new OnboardingServiceError(
        `Failed to get onboarding status: ${error}`,
        'SERVICE_ERROR'
      );
    }
  }

  /**
   * Check if user has completed onboarding
   *
   * @param userId - Telegram user ID
   * @returns true if both wallet and buddy are confirmed
   */
  public async isOnboardingComplete(userId: number): Promise<boolean> {
    try {
      const status = await this.getOnboardingStatus(userId);
      return status.onboarding.current_step === 'complete';
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      throw new OnboardingServiceError(
        `Failed to check onboarding completion: ${error}`,
        'SERVICE_ERROR'
      );
    }
  }
}

/**
 * Export singleton instance for convenience
 */
export const onboardingService = OnboardingService.getInstance();

/**
 * Export default singleton instance
 */
export default onboardingService;
