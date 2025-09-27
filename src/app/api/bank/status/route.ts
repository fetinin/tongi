import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/middleware/auth';
import { bankService } from '@/services/BankService';
import { handleApiError } from '@/lib/apiErrors';

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
    return handleApiError('bank/status:GET', error);
  }
}
