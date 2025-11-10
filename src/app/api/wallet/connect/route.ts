import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { validateTonAddress, normalizeTonAddress } from '@/lib/ton';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

    const userId = authResult.user!.id;

    // Parse request body
    const body = await request.json();
    const { walletAddress } = body;

    // Validate wallet address
    if (!walletAddress || !validateTonAddress(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid wallet address',
          code: 'INVALID_ADDRESS',
        },
        { status: 400 }
      );
    }

    // Normalize address to user-friendly format
    const normalizedAddress = normalizeTonAddress(walletAddress);
    if (!normalizedAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to normalize wallet address',
          code: 'INVALID_ADDRESS',
        },
        { status: 400 }
      );
    }

    // Update database with automatic wallet unlinking
    // If the wallet is already connected to another user, disconnect it from them first
    const db = getDatabase();

    // Start transaction for atomic wallet reassignment
    const transaction = db.transaction(() => {
      // First, unlink the wallet from any other user that might have it
      db.prepare(
        'UPDATE users SET ton_wallet_address = NULL WHERE ton_wallet_address = ?'
      ).run(normalizedAddress);

      // Then, connect the wallet to the current user
      db.prepare('UPDATE users SET ton_wallet_address = ? WHERE id = ?').run(
        normalizedAddress,
        userId
      );
    });

    try {
      transaction();
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }

    // Fetch updated user
    const updatedUser = db
      .prepare(
        'SELECT id, ton_wallet_address, updated_at FROM users WHERE id = ?'
      )
      .get(userId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Wallet connect error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect wallet',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
