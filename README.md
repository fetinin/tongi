This is a [Next.js](https://nextjs.org) Telegram Mini App project for **Corgi Buddy** - a TON cryptocurrency mini-app where users pair up to spot corgis and earn Corgi coins.

## Getting Started

This project uses **pnpm** exclusively. Install dependencies:

```bash
pnpm install
```

### Development

Run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing in Telegram

To test the app inside Telegram, you need HTTPS:

```bash
pnpm run dev:https
```

Then submit `https://127.0.0.1:3000` to [@BotFather](https://t.me/botfather) and test in Telegram Web or desktop client.

### Development with Mock Data

To develop outside of Telegram with mock authentication data:

1. Create a `.env.local` file:
```bash
NEXT_PUBLIC_USE_MOCK_AUTH=true
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_bot_token_here
```

2. Run the development server:
```bash
pnpm run dev
```

The app will now use a mock Telegram user (Arthur, ID: 99281932) with properly signed initData. You can customize the mock user in `src/lib/mockAuth.ts`.

### Available Commands

- `pnpm run dev` - Run development server
- `pnpm run dev:https` - Run with HTTPS (for Telegram testing)
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run type-check` - Run TypeScript type checking
- `pnpm run validate` - Run both lint and type-check
- `pnpm run format` - Format code with Prettier
- `pnpm run test` - Run Jest tests
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:seed` - Seed initial data

## Project Structure

- `src/app/` - Next.js 15 App Router pages
- `src/components/` - React components (Auth, Buddy, Corgi, Wallet, etc.)
- `src/core/` - Core initialization and i18n
- `src/lib/` - Utility libraries (Telegram auth, mock auth, API errors, logger)
- `src/services/` - Business logic services (User, Buddy, Transaction, etc.)
- `specs/` - Feature specifications and design documents

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
