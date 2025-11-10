import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { validateTonAddress, normalizeTonAddress } from '@/lib/ton';
import { getDatabase, withTransaction } from '@/lib/database';

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
          error: 'Invalid TON wallet address format',
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

    const userExists = db
      .prepare('SELECT id FROM users WHERE id = ?')
      .get(userId) as { id: number } | undefined;

    if (!userExists) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    let previousAccountUnlinked = false;

    try {
      withTransaction((txDb) => {
        const unlinkResult = txDb
          .prepare(
            `
            UPDATE users
            SET ton_wallet_address = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE ton_wallet_address = ?
              AND id != ?
          `
          )
          .run(normalizedAddress, userId);

        if (unlinkResult.changes > 0) {
          previousAccountUnlinked = true;
        }

        const updateResult = txDb
          .prepare(
            `
            UPDATE users
            SET ton_wallet_address = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          )
          .run(normalizedAddress, userId);

        if (updateResult.changes === 0) {
          throw new Error('USER_NOT_FOUND');
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: 'User record not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 }
        );
      }

      console.error('Wallet connect transaction error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect wallet',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
    }

    const updatedUser = db
      .prepare('SELECT ton_wallet_address FROM users WHERE id = ?')
      .get(userId) as { ton_wallet_address: string | null } | undefined;

    return NextResponse.json({
      success: true,
      address: updatedUser?.ton_wallet_address ?? normalizedAddress,
      previousAccountUnlinked,
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
