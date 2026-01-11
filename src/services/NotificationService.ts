/**
 * NotificationService - Telegram bot-based notifications
 *
 * Sends non-blocking notifications to Telegram users via the Bot API.
 * Uses `TELEGRAM_BOT_TOKEN` from environment and user Telegram IDs as chat IDs.
 * Fails gracefully in development/test environments where the bot cannot DM users.
 */

import { logger } from '@/lib/logger';

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface BotSendOptions {
  disableLinkPreviews?: boolean;
  disableNotification?: boolean;
  reply_markup?: InlineKeyboardMarkup;
}

export class NotificationService {
  private static instance: NotificationService;
  private readonly botToken: string | undefined;
  private readonly apiBaseUrl: string | null;

  private constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.apiBaseUrl = this.botToken
      ? `https://api.telegram.org/bot${this.botToken}`
      : null;
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Low-level sendMessage wrapper. Returns true on success, false on failure.
   */
  public async sendMessage(
    chatId: number,
    text: string,
    options?: BotSendOptions
  ): Promise<boolean> {
    if (!this.apiBaseUrl) {
      // No bot token configured; treat as no-op success in dev
      return false;
    }

    try {
      const url = `${this.apiBaseUrl}/sendMessage`;
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        disable_web_page_preview: options?.disableLinkPreviews ?? true,
        disable_notification: options?.disableNotification ?? true,
      };

      if (options?.reply_markup) {
        body.reply_markup = options.reply_markup;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { ok?: boolean };
      return Boolean(data?.ok);
    } catch {
      return false;
    }
  }

  // Convenience domain-specific notifications (best-effort, non-blocking)

  public async notifyBuddyRequest(
    targetUserId: number,
    requesterName: string
  ): Promise<void> {
    const message = `🤝 Buddy request: ${requesterName} wants to be your buddy.`;
    await this.sendMessage(targetUserId, message).catch((error) => {
      logger.warn('notification', 'Failed to send buddy request notification', {
        targetUserId,
        requesterName,
        error,
      });
    });
  }

  public async notifyBuddyConfirmed(
    initiatorUserId: number,
    confirmerName: string
  ): Promise<void> {
    const message = `✅ Buddy confirmed: ${confirmerName} accepted your buddy request.`;
    await this.sendMessage(initiatorUserId, message).catch((error) => {
      logger.warn(
        'notification',
        'Failed to send buddy confirmed notification',
        {
          initiatorUserId,
          confirmerName,
          error,
        }
      );
    });
  }

  /**
   * Send a notification when a buddy request is rejected
   * @param initiatorUserId - The user who initiated the request
   * @param rejecterName - Name of the user who rejected the request
   */
  public async notifyBuddyRejected(
    initiatorUserId: number,
    rejecterName: string
  ): Promise<void> {
    const message = `❌ Buddy request: ${rejecterName} declined your buddy request.`;
    await this.sendMessage(initiatorUserId, message).catch((error) => {
      logger.warn(
        'notification',
        'Failed to send buddy rejected notification',
        {
          initiatorUserId,
          rejecterName,
          error,
        }
      );
    });
  }

  public async notifyNewSighting(
    buddyUserId: number,
    reporterName: string,
    corgiCount: number,
    sightingId: number
  ): Promise<void> {
    const message = `🐶 New corgi sighting from ${reporterName}: ${corgiCount} corgi(s) to confirm.`;
    const reply_markup: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve:${sightingId}` },
          { text: '❌ Reject', callback_data: `reject:${sightingId}` },
        ],
      ],
    };
    await this.sendMessage(buddyUserId, message, { reply_markup }).catch(
      (error) => {
        logger.warn(
          'notification',
          'Failed to send new sighting notification',
          {
            buddyUserId,
            sightingId,
            error,
          }
        );
      }
    );
  }

  public async notifySightingResponse(
    reporterUserId: number,
    confirmerName: string,
    confirmed: boolean,
    reward?: number
  ): Promise<void> {
    const base = confirmed
      ? `🎉 ${confirmerName} confirmed your corgi sighting.`
      : `❌ ${confirmerName} denied your corgi sighting.`;
    const message =
      confirmed && typeof reward === 'number'
        ? `${base} Reward: ${reward} Corgi coin(s).`
        : base;
    await this.sendMessage(reporterUserId, message).catch((error) => {
      logger.warn(
        'notification',
        'Failed to send sighting response notification',
        {
          reporterUserId,
          confirmerName,
          confirmed,
          reward,
          error,
        }
      );
    });
  }

  public async notifyWishCreated(
    buddyUserId: number,
    creatorName: string,
    description: string,
    amount: number
  ): Promise<void> {
    const message = `📝 New wish from ${creatorName}: "${description}" (proposed ${amount} Corgi coins).`;
    await this.sendMessage(buddyUserId, message).catch((error) => {
      logger.warn('notification', 'Failed to send wish created notification', {
        buddyUserId,
        creatorName,
        description,
        amount,
        error,
      });
    });
  }

  public async notifyWishResponded(
    creatorUserId: number,
    buddyName: string,
    accepted: boolean,
    description: string
  ): Promise<void> {
    const message = accepted
      ? `✅ ${buddyName} accepted your wish: "${description}"`
      : `❌ ${buddyName} rejected your wish: "${description}"`;
    await this.sendMessage(creatorUserId, message).catch((error) => {
      logger.warn(
        'notification',
        'Failed to send wish responded notification',
        {
          creatorUserId,
          buddyName,
          accepted,
          description,
          error,
        }
      );
    });
  }

  public async notifyWishPurchased(
    creatorUserId: number,
    purchaserName: string,
    description: string,
    amount: number
  ): Promise<void> {
    const message = `💸 Your wish "${description}" was purchased by ${purchaserName} for ${amount} Corgi coins.`;
    await this.sendMessage(creatorUserId, message).catch((error) => {
      logger.warn(
        'notification',
        'Failed to send wish purchased notification',
        {
          creatorUserId,
          purchaserName,
          description,
          amount,
          error,
        }
      );
    });
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;
