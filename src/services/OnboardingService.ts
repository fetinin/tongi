import { userService, UserNotFoundError } from '@/services/UserService';
import {
  buddyService,
  BuddyStatusResult,
  BuddyServiceError,
} from '@/services/BuddyService';
import {
  OnboardingState,
  OnboardingStatusResponse,
  OnboardingBuddyInfo,
  OnboardingBuddyProfile,
  OnboardingWalletInfo,
} from '@/types/onboarding';

interface DeriveStateInput {
  userId: number;
  buddyStatus?: BuddyStatusResult;
}

export class OnboardingService {
  private static instance: OnboardingService;

  public static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService();
    }
    return OnboardingService.instance;
  }

  public async deriveOnboardingState(
    input: DeriveStateInput
  ): Promise<OnboardingStatusResponse> {
    const { userId } = input;

    const user = await userService.getUserById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const buddyStatus = await this.resolveBuddyStatus(
      userId,
      input.buddyStatus
    );

    const walletInfo: OnboardingWalletInfo | undefined = user.ton_wallet_address
      ? { address: user.ton_wallet_address }
      : undefined;

    const state = this.buildState(user.ton_wallet_address, buddyStatus);
    const buddyInfo = this.buildBuddyInfo(buddyStatus);

    return {
      success: true,
      onboarding: state,
      wallet: walletInfo,
      buddy: buddyInfo,
    };
  }

  private async resolveBuddyStatus(
    userId: number,
    provided?: BuddyStatusResult
  ): Promise<BuddyStatusResult> {
    if (provided) {
      return provided;
    }

    try {
      return await buddyService.getBuddyStatus(userId);
    } catch (error) {
      if (error instanceof BuddyServiceError) {
        throw error;
      }
      throw new BuddyServiceError(
        `Failed to resolve buddy status: ${error}`,
        'INTERNAL_ERROR'
      );
    }
  }

  private buildState(
    walletAddress: string | null,
    buddyStatus: BuddyStatusResult
  ): OnboardingState {
    const walletConnected = Boolean(walletAddress);
    const buddyConfirmed = buddyStatus.status === 'active';

    let current_step: OnboardingState['current_step'];
    if (!walletConnected) {
      current_step = 'welcome';
    } else if (!buddyConfirmed) {
      current_step = 'buddy';
    } else {
      current_step = 'complete';
    }

    return {
      wallet_connected: walletConnected,
      buddy_confirmed: buddyConfirmed,
      current_step,
    };
  }

  private buildBuddyInfo(
    buddyStatus: BuddyStatusResult
  ): OnboardingBuddyInfo | undefined {
    if (buddyStatus.status === 'no_buddy') {
      return undefined;
    }

    if (!buddyStatus.buddy || !buddyStatus.id) {
      return undefined;
    }

    if (buddyStatus.status === 'dissolved') {
      return undefined;
    }

    const profile: OnboardingBuddyProfile = {
      id: buddyStatus.buddy.id,
      displayName: buddyStatus.buddy.displayName,
      username: buddyStatus.buddy.username,
      hasWallet: buddyStatus.buddy.hasWallet,
      memberSince: buddyStatus.buddy.memberSince.toISOString(),
    };

    const status: OnboardingBuddyInfo['status'] =
      buddyStatus.status === 'active' ? 'confirmed' : 'pending';

    return {
      id: buddyStatus.id,
      status,
      profile,
      createdAt: buddyStatus.createdAt || new Date().toISOString(),
      confirmedAt: buddyStatus.confirmedAt || null,
      initiatedBy: buddyStatus.initiatedBy,
    };
  }
}

export const onboardingService = OnboardingService.getInstance();

export default onboardingService;
