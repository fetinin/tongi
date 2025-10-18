/**
 * Reward Calculator
 *
 * Calculates Corgi coin rewards based on the number of corgis reported in a sighting.
 *
 * Reward Formula:
 * - Simple 1-to-1 mapping: N corgis spotted = N Corgi coins awarded
 * - No bonus multipliers
 */

// Validate JETTON_DECIMALS environment variable
const rawJettonDecimals = process.env.JETTON_DECIMALS ?? '9';
if (!/^\d+$/.test(rawJettonDecimals)) {
  throw new Error(
    `Invalid JETTON_DECIMALS value: "${rawJettonDecimals}". Must be a non-negative integer string.`
  );
}
const JETTON_DECIMALS = BigInt(rawJettonDecimals);

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

  // Simple 1-to-1 mapping: 1 corgi = 1 coin
  const baseReward = corgiCount;

  // Convert to Jetton smallest units (multiply by 10^decimals)
  const amountInSmallestUnits =
    BigInt(baseReward) * BigInt(10) ** JETTON_DECIMALS;

  return amountInSmallestUnits;
}

/**
 * Get reward amount for a given corgi count
 *
 * @param corgiCount Number of corgis
 * @returns Reward amount in coins (same as corgiCount)
 */
export function getRewardAmount(corgiCount: number): number {
  if (!Number.isInteger(corgiCount) || corgiCount < 1 || corgiCount > 100) {
    throw new Error(
      `Invalid corgi count: ${corgiCount}. Must be an integer between 1 and 100.`
    );
  }
  // 1 corgi = 1 coin (no multipliers)
  return corgiCount;
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
