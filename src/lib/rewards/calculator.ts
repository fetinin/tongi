/**
 * Reward Calculator
 *
 * Calculates Corgi coin rewards based on the number of corgis reported in a sighting.
 *
 * Reward Formula:
 * - 1 corgi: 1 coin
 * - 2-5 corgis: 2x multiplier (2 = 4 coins, 5 = 10 coins, etc.)
 * - 6+ corgis: 3x multiplier (6 = 18 coins, etc.)
 */

const JETTON_DECIMALS = BigInt(process.env.JETTON_DECIMALS || '9');

export const REWARD_TIERS = {
  ONE: { min: 1, max: 1, multiplier: 1 },
  TWO_TO_FIVE: { min: 2, max: 5, multiplier: 2 },
  SIX_PLUS: { min: 6, max: 100, multiplier: 3 },
} as const;

/**
 * Calculate reward amount in Jetton smallest units (nanoJettons)
 *
 * @param corgiCount Number of corgis in the sighting
 * @returns Reward amount in smallest Jetton units (amount × 10^decimals)
 * @throws Error if corgiCount is invalid
 */
export function calculateRewardAmount(corgiCount: number): bigint {
  // Validate input
  if (!Number.isInteger(corgiCount) || corgiCount < 1 || corgiCount > 100) {
    throw new Error(
      `Invalid corgi count: ${corgiCount}. Must be an integer between 1 and 100.`
    );
  }

  // Determine base reward (in coins)
  let baseReward = 0;

  if (corgiCount >= REWARD_TIERS.SIX_PLUS.min) {
    // 6+ corgis: 3x multiplier
    baseReward = corgiCount * REWARD_TIERS.SIX_PLUS.multiplier;
  } else if (corgiCount >= REWARD_TIERS.TWO_TO_FIVE.min) {
    // 2-5 corgis: 2x multiplier
    baseReward = corgiCount * REWARD_TIERS.TWO_TO_FIVE.multiplier;
  } else {
    // 1 corgi: 1x multiplier (1 coin)
    baseReward = corgiCount * REWARD_TIERS.ONE.multiplier;
  }

  // Convert to Jetton smallest units (multiply by 10^decimals)
  const amountInSmallestUnits =
    BigInt(baseReward) * BigInt(10) ** JETTON_DECIMALS;

  return amountInSmallestUnits;
}

/**
 * Get reward tier for a given corgi count
 *
 * @param corgiCount Number of corgis
 * @returns Reward tier with multiplier and amount
 */
export function getRewardTier(corgiCount: number): {
  tier: 'ONE' | 'TWO_TO_FIVE' | 'SIX_PLUS';
  multiplier: number;
  baseReward: number;
} {
  if (corgiCount >= REWARD_TIERS.SIX_PLUS.min) {
    return {
      tier: 'SIX_PLUS',
      multiplier: REWARD_TIERS.SIX_PLUS.multiplier,
      baseReward: corgiCount * REWARD_TIERS.SIX_PLUS.multiplier,
    };
  } else if (corgiCount >= REWARD_TIERS.TWO_TO_FIVE.min) {
    return {
      tier: 'TWO_TO_FIVE',
      multiplier: REWARD_TIERS.TWO_TO_FIVE.multiplier,
      baseReward: corgiCount * REWARD_TIERS.TWO_TO_FIVE.multiplier,
    };
  } else {
    return {
      tier: 'ONE',
      multiplier: REWARD_TIERS.ONE.multiplier,
      baseReward: corgiCount * REWARD_TIERS.ONE.multiplier,
    };
  }
}

/**
 * Format Jetton amount from smallest units to human-readable coins
 *
 * @param amountInSmallestUnits Amount in smallest units
 * @returns Amount in coins as a number
 */
export function formatJettonAmount(amountInSmallestUnits: bigint): number {
  const divisor = BigInt(10) ** JETTON_DECIMALS;
  return Number(amountInSmallestUnits / divisor);
}

/**
 * Convert Corgi coins to Jetton smallest units
 *
 * @param coins Number of Corgi coins
 * @returns Amount in smallest Jetton units
 */
export function coinsToSmallestUnits(coins: number): bigint {
  return BigInt(coins) * BigInt(10) ** JETTON_DECIMALS;
}
