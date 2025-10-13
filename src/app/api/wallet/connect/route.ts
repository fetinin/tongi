import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramAuth } from '@/middleware/auth';
import { validateTonAddress, normalizeTonAddress } from '@/lib/ton';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { walletAddress, initData } = body;

    // Validate Telegram authentication
    const user = await validateTelegramAuth(initData);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        },
        { status: 401 }
      );
    }

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

    // Update database
    const db = getDatabase();
    const stmt = db.prepare(
      'UPDATE users SET ton_wallet_address = ? WHERE id = ?'
    );
    stmt.run(normalizedAddress, user.id);

    // Fetch updated user
    const updatedUser = db
      .prepare(
        'SELECT id, ton_wallet_address, updated_at FROM users WHERE id = ?'
      )
      .get(user.id);

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
