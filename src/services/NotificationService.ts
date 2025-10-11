/**
 * NotificationService - Telegram bot-based notifications
 *
 * Sends non-blocking notifications to Telegram users via the Bot API.
 * Uses `TELEGRAM_BOT_TOKEN` from environment and user Telegram IDs as chat IDs.
 * Fails gracefully in development/test environments where the bot cannot DM users.
 */

export interface BotSendOptions {
  disableLinkPreviews?: boolean;
  disableNotification?: boolean;
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
      const body = {
        chat_id: chatId,
        text,
        disable_web_page_preview: options?.disableLinkPreviews ?? true,
        disable_notification: options?.disableNotification ?? true,
      } as const;

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
    await this.sendMessage(targetUserId, message).catch(() => {});
  }

  public async notifyBuddyConfirmed(
    initiatorUserId: number,
    confirmerName: string
  ): Promise<void> {
    const message = `✅ Buddy confirmed: ${confirmerName} accepted your buddy request.`;
    await this.sendMessage(initiatorUserId, message).catch(() => {});
  }

  public async notifyBuddyRejected(
    initiatorUserId: number,
    rejecterName: string
  ): Promise<void> {
    const message = `❌ Buddy request: ${rejecterName} declined your buddy request.`;
    await this.sendMessage(initiatorUserId, message).catch(() => {});
  }

  public async notifyNewSighting(
    buddyUserId: number,
    reporterName: string,
    corgiCount: number
  ): Promise<void> {
    const message = `🐶 New corgi sighting from ${reporterName}: ${corgiCount} corgi(s) to confirm.`;
    await this.sendMessage(buddyUserId, message).catch(() => {});
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
    await this.sendMessage(reporterUserId, message).catch(() => {});
  }

  public async notifyWishCreated(
    buddyUserId: number,
    creatorName: string,
    description: string,
    amount: number
  ): Promise<void> {
    const message = `📝 New wish from ${creatorName}: "${description}" (proposed ${amount} Corgi coins).`;
    await this.sendMessage(buddyUserId, message).catch(() => {});
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
    await this.sendMessage(creatorUserId, message).catch(() => {});
  }

  public async notifyWishPurchased(
    creatorUserId: number,
    purchaserName: string,
    description: string,
    amount: number
  ): Promise<void> {
    const message = `💸 Your wish "${description}" was purchased by ${purchaserName} for ${amount} Corgi coins.`;
    await this.sendMessage(creatorUserId, message).catch(() => {});
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;
