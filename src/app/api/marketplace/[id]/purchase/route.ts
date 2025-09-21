import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { wishService } from '@/services/WishService';
import { transactionService } from '@/services/TransactionService';
import { userService } from '@/services/UserService';
import { createTonTransaction } from '@/lib/ton';

interface PurchaseResponse {
  transactionId: number;
  tonTransaction: {
    to: string;
    amount: string;
    payload: string;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/marketplace/[id]/purchase
 * Initiate wish purchase with TON transaction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<PurchaseResponse | ErrorResponse>> {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required'
        },
        { status: 401 }
      );
    }

    const purchaserId = authResult.user!.id;

    // Validate and parse wish ID from path parameters
    const wishId = parseInt(params.id, 10);
    if (isNaN(wishId) || wishId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid wish ID'
        },
        { status: 400 }
      );
    }

    // Get the purchaser's user record to validate TON wallet
    const purchaser = await userService.getUserById(purchaserId);
    if (!purchaser) {
      return NextResponse.json(
        {
          error: 'USER_NOT_FOUND',
          message: 'User account not found'
        },
        { status: 404 }
      );
    }

    if (!purchaser.ton_wallet_address) {
      return NextResponse.json(
        {
          error: 'WALLET_NOT_CONNECTED',
          message: 'TON wallet must be connected to make purchases'
        },
        { status: 400 }
      );
    }

    // Get the wish to verify it exists and is available for purchase
    const wish = await wishService.getWishById(wishId);
    if (!wish) {
      return NextResponse.json(
        {
          error: 'WISH_NOT_FOUND',
          message: 'Wish not found'
        },
        { status: 404 }
      );
    }

    // Verify the wish is in 'accepted' status and available for purchase
    if (wish.status !== 'accepted') {
      return NextResponse.json(
        {
          error: 'WISH_NOT_AVAILABLE',
          message: 'Wish is not available for purchase'
        },
        { status: 400 }
      );
    }

    // Get the wish creator's wallet address for the transaction
    const creator = await userService.getUserById(wish.creator_id);
    if (!creator) {
      return NextResponse.json(
        {
          error: 'CREATOR_NOT_FOUND',
          message: 'Wish creator not found'
        },
        { status: 404 }
      );
    }

    if (!creator.ton_wallet_address) {
      return NextResponse.json(
        {
          error: 'CREATOR_WALLET_NOT_CONNECTED',
          message: 'Wish creator has not connected their TON wallet'
        },
        { status: 400 }
      );
    }

    // Create the purchase transaction in the database
    const transaction = await transactionService.createPurchaseTransaction(
      purchaser.ton_wallet_address,
      creator.ton_wallet_address,
      wish.proposed_amount,
      wishId
    );

    // Create TON transaction parameters for the user's wallet
    const tonTransaction = createTonTransaction({
      recipientAddress: creator.ton_wallet_address,
      corgiCoinAmount: wish.proposed_amount,
      memo: `Corgi Buddy wish purchase: ${wish.description.substring(0, 50)}...`,
    });

    // Update the wish status to 'purchased' and record the purchaser
    await wishService.purchaseWish(wishId, purchaserId);

    const response: PurchaseResponse = {
      transactionId: transaction.transaction.id,
      tonTransaction: {
        to: tonTransaction.messages[0].address,
        amount: tonTransaction.messages[0].amount,
        payload: tonTransaction.messages[0].payload || '',
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Wish purchase error:', error);

    // Handle specific service errors
    if (error && typeof error === 'object' && 'code' in error) {
      const serviceError = error as { code: string; message: string; statusCode?: number };

      return NextResponse.json(
        {
          error: serviceError.code,
          message: serviceError.message
        },
        { status: serviceError.statusCode || 500 }
      );
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the purchase'
      },
      { status: 500 }
    );
  }
}