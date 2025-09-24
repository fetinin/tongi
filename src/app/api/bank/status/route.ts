import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { bankService } from '@/services/BankService';

interface BankWalletResponse {
  walletAddress: string;
  currentBalance: number;
  totalDistributed: number;
  lastTransactionHash: string | null;
  updatedAt: string;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * GET /api/bank/status
 * Get bank wallet status - balance, total distributed, and last transaction
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BankWalletResponse | ErrorResponse>> {
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

    // Note: In a production system, you might want to restrict access to bank status
    // to admin users only. For this implementation, we'll allow any authenticated user
    // to view the bank status as per the API specification.

    // Get bank wallet status from the service
    const bankWallet = await bankService.getBankWalletStatus();

    if (!bankWallet) {
      return NextResponse.json(
        {
          error: 'BANK_WALLET_NOT_FOUND',
          message: 'Bank wallet has not been initialized',
        },
        { status: 404 }
      );
    }

    // Map the response to match API contract (camelCase for external API)
    const response: BankWalletResponse = {
      walletAddress: bankWallet.wallet_address,
      currentBalance: bankWallet.current_balance,
      totalDistributed: bankWallet.total_distributed,
      lastTransactionHash: bankWallet.last_transaction_hash,
      updatedAt: bankWallet.updated_at.toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Bank wallet status retrieval error:', error);

    // Handle specific BankService errors
    if (error && typeof error === 'object' && 'code' in error) {
      const serviceError = error as {
        code: string;
        message: string;
        statusCode?: number;
      };

      // Map service error codes to HTTP status codes
      let statusCode = serviceError.statusCode || 500;
      if (serviceError.code === 'BANK_WALLET_NOT_FOUND') {
        statusCode = 404;
      }

      return NextResponse.json(
        {
          error: serviceError.code,
          message: serviceError.message,
        },
        { status: statusCode }
      );
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message:
          'An unexpected error occurred while retrieving bank wallet status',
      },
      { status: 500 }
    );
  }
}
