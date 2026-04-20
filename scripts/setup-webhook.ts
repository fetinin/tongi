const botToken = process.env.TELEGRAM_BOT_TOKEN;
const botSecret = process.env.TELEGRAM_BOT_SECRET;

const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.error('Usage: pnpm run setup-webhook <webhook-url>');
  console.error(
    'Example: pnpm run setup-webhook https://your-domain.com/api/telegram/webhook'
  );
  process.exit(1);
}

if (!webhookUrl.endsWith('/api/telegram/webhook')) {
  console.error('Error: Webhook URL must end with /api/telegram/webhook');
  process.exit(1);
}

if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN not set. Check your .env file.');
  process.exit(1);
}

if (!botSecret) {
  console.error('Error: TELEGRAM_BOT_SECRET not set. Check your .env file.');
  process.exit(1);
}

const TELEGRAM_API = 'https://api.telegram.org';

async function setWebhook() {
  console.log('Registering webhook...');
  console.log(`  URL: ${webhookUrl}`);

  const response = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: botSecret,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    description?: string;
  };

  if (!data.ok) {
    console.error('Failed to set webhook:', data.description);
    process.exit(1);
  }

  console.log('Webhook registered successfully');

  const infoResponse = await fetch(
    `${TELEGRAM_API}/bot${botToken}/getWebhookInfo`
  );
  const info = (await infoResponse.json()) as {
    ok: boolean;
    result: {
      url: string;
      has_custom_certificate: boolean;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
    };
  };

  if (info.ok) {
    console.log('\nWebhook info:');
    console.log(`  URL: ${info.result.url}`);
    console.log(`  Pending updates: ${info.result.pending_update_count}`);
    if (info.result.last_error_message) {
      console.log(`  Last error: ${info.result.last_error_message}`);
    }
  }

  console.log('\nDone. Inline keyboard buttons should now work.');
}

setWebhook().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
