import { NextRequest, NextResponse } from 'next/server';
import { corgiService, BlockchainError } from '@/services/CorgiService';
import {
  CorgiServiceError,
  CorgiNotFoundError,
  CorgiAuthorizationError,
  CorgiConflictError,
} from '@/services/CorgiService';
import { handleApiError } from '@/lib/apiErrors';
import { logger } from '@/lib/logger';

interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text: string;
  };
  data: string;
}

interface TelegramWebhookBody {
  callback_query: TelegramCallbackQuery;
}

interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * POST /api/telegram/webhook
 * Handle callback queries from inline keyboard buttons
 *
 * Security:
 * - Verifies X-Telegram-Bot-Api-Secret-Token header for webhook authentication
 * - Validates callback data format
 * - Ensures only authorized users can confirm sightings
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ ok: boolean } | ErrorResponse>> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        {
          error: 'CONFIGURATION_ERROR',
          message: 'Telegram bot token not configured',
        },
        { status: 500 }
      );
    }

    const botSecret = process.env.TELEGRAM_BOT_SECRET;
    if (!botSecret) {
      return NextResponse.json(
        {
          error: 'CONFIGURATION_ERROR',
          message: 'Bot secret not configured',
        },
        { status: 500 }
      );
    }

    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretHeader !== botSecret) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid webhook secret',
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as TelegramWebhookBody;
    const callbackQuery = body.callback_query;

    if (!callbackQuery) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'No callback query in request body',
        },
        { status: 400 }
      );
    }

    const callbackId = callbackQuery.id;
    const callbackData = callbackQuery.data;
    const userId = callbackQuery.from.id;

    const parsedData = parseCallbackData(callbackData);

    if (!parsedData) {
      await answerCallbackQuery(callbackId, {
        text: 'Invalid callback data format',
        show_alert: true,
      });
      return NextResponse.json({ ok: true });
    }

    const { action, sightingId } = parsedData;
    const confirmed = action === 'approve';

    try {
      const result = await corgiService.confirmSighting(
        sightingId,
        userId,
        confirmed
      );

      const successMessage = confirmed
        ? 'Sighting confirmed! Reward has been sent.'
        : 'Sighting rejected.';

      await answerCallbackQuery(callbackId, {
        text: successMessage,
        show_alert: false,
      });

      await editMessageReplyMarkup(
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id
      );
    } catch (serviceError) {
      let errorMessage = 'Failed to process sighting';

      if (serviceError instanceof CorgiNotFoundError) {
        errorMessage = 'Sighting not found or already processed';
      } else if (serviceError instanceof CorgiAuthorizationError) {
        errorMessage = 'You are not authorized to confirm this sighting';
      } else if (serviceError instanceof CorgiConflictError) {
        errorMessage = 'Sighting is not in pending status';
      } else if (serviceError instanceof BlockchainError) {
        errorMessage = serviceError.isRetryable
          ? 'Blockchain operation failed. Please try again.'
          : 'Blockchain operation failed. Contact support.';
      }

      await answerCallbackQuery(callbackId, {
        text: errorMessage,
        show_alert: true,
      });

      return handleApiError('telegram-webhook:callback', serviceError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('telegram-webhook', 'Webhook processing error', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Failed to process webhook request',
      },
      { status: 500 }
    );
  }
}

function parseCallbackData(
  data: string
): { action: string; sightingId: number } | null {
  const parts = data.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [action, sightingIdStr] = parts;
  const sightingId = parseInt(sightingIdStr, 10);

  if (isNaN(sightingId) || sightingId <= 0) {
    return null;
  }

  if (action !== 'approve' && action !== 'reject') {
    return null;
  }

  return { action, sightingId };
}

async function answerCallbackQuery(
  callbackId: string,
  options: { text?: string; show_alert?: boolean }
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: options.text,
        show_alert: options.show_alert ?? false,
      }),
    });

    const data = (await response.json()) as { ok?: boolean };
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

async function editMessageReplyMarkup(
  chatId: number,
  messageId: number
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: null,
      }),
    });

    const data = (await response.json()) as { ok?: boolean };
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}
