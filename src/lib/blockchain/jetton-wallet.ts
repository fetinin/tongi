/**
 * Jetton Wallet Query Module
 *
 * Functions to query Jetton wallet addresses from the Jetton master contract.
 * Each user has a unique Jetton wallet for each Jetton type (master contract).
 */

import { Address } from '@ton/core';
import { tonClientManager } from './ton-client';
import type { JettonWalletAddress } from '@/types/jetton';

/**
 * Get the Jetton wallet address for a user's TON wallet
 *
 * This queries the Jetton master contract using the get_wallet_address method
 * to find the derived Jetton wallet address for a specific user.
 *
 * @param masterAddress - Jetton master contract address
 * @param userTONAddress - User's TON wallet address
 * @returns Jetton wallet address information
 * @throws Error if master contract doesn't respond or address is invalid
 */
export async function getJettonWalletAddress(
  masterAddress: string,
  userTONAddress: string
): Promise<JettonWalletAddress> {
  const client = await tonClientManager.getClient();

  // Parse addresses
  const masterAddr = Address.parse(masterAddress);
  const userAddr = Address.parse(userTONAddress);

  // Query master contract for user's Jetton wallet address
  // Create a cell that contains the user address as a slice
  const { beginCell } = await import('@ton/core');
  const userAddrCell = beginCell().storeAddress(userAddr).endCell();

  const response = await client.runMethod(masterAddr, 'get_wallet_address', [
    { type: 'slice', cell: userAddrCell },
  ]);

  // Extract the Jetton wallet address from the response stack
  const jettonWalletAddr = response.stack.readAddress();

  return {
    masterAddress,
    userAddress: userTONAddress,
    jettonWalletAddress: jettonWalletAddr.toString(),
  };
}

/**
 * Get Jetton balance for a user
 *
 * Queries the user's Jetton wallet contract for their balance.
 *
 * @param jettonWalletAddress - User's Jetton wallet address (from getJettonWalletAddress)
 * @returns Balance in smallest units (e.g., nanoTokens)
 * @throws Error if wallet doesn't exist or query fails
 */
export async function getJettonBalance(
  jettonWalletAddress: string
): Promise<bigint> {
  try {
    const client = await tonClientManager.getClient();
    const walletAddr = Address.parse(jettonWalletAddress);

    // Query Jetton wallet contract for balance using get_wallet_data method
    const response = await client.runMethod(walletAddr, 'get_wallet_data', []);

    // TEP-74: get_wallet_data returns (balance, owner, jetton_master, jetton_wallet_code)
    const balance = response.stack.readBigNumber();

    return balance;
  } catch (error) {
    console.error(
      `[Jetton] Failed to get Jetton balance for wallet ${jettonWalletAddress}:`,
      error
    );
    throw new Error(
      `Failed to query Jetton balance: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the bank's Jetton wallet address for the configured Jetton master
 *
 * Convenience function to get the bank wallet's Jetton wallet address.
 *
 * @param masterAddress - Jetton master contract address (from JETTON_MASTER_ADDRESS env var)
 * @returns Bank's Jetton wallet address
 */
export async function getBankJettonWalletAddress(
  masterAddress: string
): Promise<string> {
  const bankTONAddress = await tonClientManager.getBankWalletAddress();

  const result = await getJettonWalletAddress(masterAddress, bankTONAddress);

  return result.jettonWalletAddress;
}
