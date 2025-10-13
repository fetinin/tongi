import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
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

    // Clear wallet address (idempotent operation)
    const db = getDatabase();
    const stmt = db.prepare(
      'UPDATE users SET ton_wallet_address = NULL WHERE id = ?'
    );
    stmt.run(userId);

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
    console.error('Wallet disconnect error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect wallet',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
