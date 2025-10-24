## Project Overview

This repository will contain a Telegram Mini App built with Next.js 15, TypeScript, and Telegram SDK integration.

## Commands

All commands should be run from the project root directory (after Next.js setup):

- `pnpm install` - Install dependencies (required - this project uses pnpm exclusively)
- `pnpm run dev` - Run development server on http://localhost:3000
- `pnpm run dev:https` - Run development server with HTTPS on https://localhost:3000 (required for testing in Telegram)
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint (code style/patterns)
- `pnpm run type-check` - Run TypeScript compiler type checking (NEW)
- `pnpm run validate` - Run both lint and type-check (NEW)
- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check code formatting
- `pnpm run test` - Run Jest tests
- `pnpm run test:watch` - Run Jest in watch mode
- `pnpm run test:coverage` - Run Jest with coverage report
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:seed` - Seed initial data

## Architecture

### Core Structure
- **App Router**: Uses Next.js 15 App Router (`src/app/`)
- **Component Architecture**: Root component handles Telegram environment initialization
- **Internationalization**: Built-in i18n support with next-intl
- **Styling**: TailwindCSS + Telegram UI components
- **Database**: SQLite with schema for buddy relationships, corgi sightings, wishes, and transactions

### Key Components
- `src/components/Root/Root.tsx` - Main app wrapper that initializes Telegram SDK and handles SSR
- `src/core/init.ts` - Telegram Mini App initialization logic with environment mocking
- `src/core/i18n/` - Internationalization setup with locale detection from Telegram user
- `src/components/buddy/` - Buddy relationship management
- `src/components/corgi/` - Corgi sighting reporting and confirmation
- `src/components/wish/` - Wish creation and marketplace
- `src/components/wallet/` - TON Connect integration

### Telegram Integration
- Uses `@telegram-apps/sdk-react` for Telegram Mini Apps functionality
- `@tonconnect/ui-react` for TON blockchain integration
- Environment mocking for development outside Telegram (`mockTelegramEnv`)
- Theme detection and CSS variable binding for Telegram themes
- Bot-mediated notifications for buddy confirmations

### Development Patterns
- Client-side rendering due to Telegram Mini Apps limitations
- Error boundaries for robust error handling
- TypeScript paths configured (`@/*` for `src/*`, `@public/*` for `public/*`)
- Strict TypeScript configuration with ES2017 target
- Three-tier storage strategy (SecureStorage, DeviceStorage, CloudStorage)

## Data Model

### Core Entities
- **User**: Telegram users with TON wallet connections
- **BuddyPair**: Bidirectional relationships between users
- **CorgiSighting**: Reports requiring buddy confirmation
- **Wish**: Purchase requests with Corgi coin amounts
- **Transaction**: TON blockchain transfers for rewards/purchases
- **BankWallet**: System wallet for Corgi coin distribution

### API Endpoints
- `/api/auth/validate` - Telegram authentication with server-side validation
- `/api/buddy/*` - Buddy relationship management
- `/api/corgi/*` - Corgi sighting reporting and confirmation
- `/api/wishes/*` - Wish creation and approval
- `/api/marketplace/*` - Public wish marketplace
- `/api/transactions/*` - Transaction history and confirmation

## Important Notes
- This template requires pnpm - other package managers will cause errors
- Some Telegram SDK features only work within Telegram environment
- The `mockTelegramEnv` function should not be used in production
- macOS Telegram client has known bugs that require special handling
- Bank wallet private key must be secured in environment variables
- All Telegram initData must be validated server-side for security

## Security Requirements
- TON wallet integration via established TON Connect SDK only
- No direct private key handling (delegated to TON Connect)
- Server-side HMAC validation for all Telegram authentication
- Three-tier storage strategy based on data sensitivity
- Bank wallet operations logged for audit trails

## Performance Goals
- Real-time buddy notifications via bot
- SQLite appropriate for 1k-10k initial user scale

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- This service use sqlite database located at ./data/app.db
- Always run formatter before commiting changes
- FOLLOW RULES FROM @.specify/memory/constitution.md
