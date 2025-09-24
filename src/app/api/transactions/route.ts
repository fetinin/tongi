import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { transactionService } from '@/services/TransactionService';
import { TransactionType } from '@/models/Transaction';

interface TransactionResponse {
  id: number;
  transactionHash: string | null;
  fromWallet: string;
  toWallet: string;
  amount: number;
  transactionType: string;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface TransactionListResponse {
  transactions: TransactionResponse[];
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/transactions
 * Get user's transaction history
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<TransactionListResponse | ErrorResponse>> {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required',
        },
        { status: 401 }
      );
    }

    const userId = authResult.user!.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const limitParam = searchParams.get('limit');

    // Parse and validate type filter
    let transactionType: TransactionType | undefined;
    if (typeParam) {
      if (typeParam !== 'reward' && typeParam !== 'purchase') {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'type must be either "reward" or "purchase"',
          },
          { status: 400 }
        );
      }
      transactionType = typeParam as TransactionType;
    }

    // Parse and validate limit
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'limit must be a number between 1 and 100',
        },
        { status: 400 }
      );
    }

    // Get user's transactions using TransactionService
    let result;
    if (transactionType) {
      // Get user's wallet address first
      const userTransactionsResult =
        await transactionService.getUserTransactions(userId, 1, limit);

      // Filter by transaction type
      const filteredTransactions = userTransactionsResult.transactions.filter(
        (transaction) => transaction.transaction_type === transactionType
      );

      result = {
        transactions: filteredTransactions,
        total: filteredTransactions.length,
        page: 1,
        limit,
        hasMore: false,
      };
    } else {
      // Get all user transactions
      result = await transactionService.getUserTransactions(userId, 1, limit);
    }

    // Map the response to match API contract
    const mappedTransactions: TransactionResponse[] = result.transactions.map(
      (transaction) => ({
        id: transaction.id,
        transactionHash: transaction.transaction_hash,
        fromWallet: transaction.from_wallet,
        toWallet: transaction.to_wallet,
        amount: transaction.amount,
        transactionType: transaction.transaction_type,
        relatedEntityId: transaction.related_entity_id,
        relatedEntityType: transaction.related_entity_type,
        status: transaction.status,
        createdAt: transaction.created_at.toISOString(),
        completedAt: transaction.completed_at?.toISOString() || null,
      })
    );

    const response: TransactionListResponse = {
      transactions: mappedTransactions,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Transaction retrieval error:', error);

    // Handle specific TransactionService errors
    if (error && typeof error === 'object' && 'code' in error) {
      const serviceError = error as {
        code: string;
        message: string;
        statusCode?: number;
      };

      return NextResponse.json(
        {
          error: serviceError.code,
          message: serviceError.message,
        },
        { status: serviceError.statusCode || 500 }
      );
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while retrieving transactions',
      },
      { status: 500 }
    );
  }
}
