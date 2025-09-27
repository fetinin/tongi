import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { transactionService } from '@/services/TransactionService';
import { handleApiError } from '@/lib/apiErrors';

interface TransactionConfirmRequest {
  transactionHash: string;
  success?: boolean;
}

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

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/transactions/[id]/confirm
 * Confirm transaction completion with blockchain hash
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<TransactionResponse | ErrorResponse>> {
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

    // Await params in Next.js 15+
    const resolvedParams = await params;

    // Parse and validate transaction ID
    const transactionId = parseInt(resolvedParams.id, 10);
    if (isNaN(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid transaction ID',
        },
        { status: 400 }
      );
    }

    // Parse request body
    let requestBody: TransactionConfirmRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: `Invalid JSON in request body: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (
      !requestBody.transactionHash ||
      typeof requestBody.transactionHash !== 'string'
    ) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'transactionHash is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Validate transaction hash format (basic validation)
    const transactionHash = requestBody.transactionHash.trim();
    if (transactionHash.length === 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'transactionHash cannot be empty',
        },
        { status: 400 }
      );
    }

    // Get the transaction first to verify it exists and user has access
    const existingTransaction =
      await transactionService.getTransactionById(transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        {
          error: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
        { status: 404 }
      );
    }

    // Verify user has access to this transaction (user must be involved in the transaction)
    const userId = authResult.user!.id;

    // Get user's wallet address to check if they're involved in this transaction
    const userTransactions = await transactionService.getUserTransactions(
      userId,
      1,
      1000
    );
    const userHasAccess = userTransactions.transactions.some(
      (t) => t.id === transactionId
    );

    if (!userHasAccess) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message:
            'Access denied: You are not authorized to confirm this transaction',
        },
        { status: 403 }
      );
    }

    // Check if transaction is in a confirmable state
    if (existingTransaction.status !== 'pending') {
      return NextResponse.json(
        {
          error: 'INVALID_STATE',
          message: `Transaction cannot be confirmed: current status is '${existingTransaction.status}'`,
        },
        { status: 400 }
      );
    }

    // Confirm or fail the transaction based on success parameter
    let updatedTransaction;
    if (requestBody.success === false) {
      // Mark transaction as failed
      updatedTransaction =
        await transactionService.failTransaction(transactionId);
    } else {
      // Confirm transaction with blockchain hash (default behavior)
      updatedTransaction = await transactionService.confirmTransaction(
        transactionId,
        transactionHash
      );
    }

    // Map the response to match API contract
    const response: TransactionResponse = {
      id: updatedTransaction.id,
      transactionHash: updatedTransaction.transaction_hash,
      fromWallet: updatedTransaction.from_wallet,
      toWallet: updatedTransaction.to_wallet,
      amount: updatedTransaction.amount,
      transactionType: updatedTransaction.transaction_type,
      relatedEntityId: updatedTransaction.related_entity_id,
      relatedEntityType: updatedTransaction.related_entity_type,
      status: updatedTransaction.status,
      createdAt: updatedTransaction.created_at.toISOString(),
      completedAt: updatedTransaction.completed_at?.toISOString() || null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError('transactions/confirm:POST', error);
  }
}
