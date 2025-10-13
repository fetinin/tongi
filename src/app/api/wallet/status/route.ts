import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { getDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
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

    // Fetch user from database
    const db = getDatabase();
    const dbUser = db
      .prepare(
        'SELECT id, first_name, ton_wallet_address, updated_at FROM users WHERE id = ?'
      )
      .get(userId) as
      | {
          id: number;
          first_name: string;
          ton_wallet_address: string | null;
          updated_at: string;
        }
      | undefined;

    if (!dbUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      connected: !!dbUser.ton_wallet_address,
      address: dbUser.ton_wallet_address,
      user: {
        id: dbUser.id,
        first_name: dbUser.first_name,
        updated_at: dbUser.updated_at,
      },
    });
  } catch (error) {
    console.error('Wallet status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve status',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
