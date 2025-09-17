# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a Telegram Mini Apps Next.js template located in `telegram_webapp_example/`. The main project is a Telegram Mini App built with Next.js 15, TypeScript, and Telegram SDK integration.

**NEW FEATURE (001-you-need-to)**: Corgi Buddy TON Cryptocurrency Mini-App
- Buddy pairing system between Telegram users
- Corgi spotting confirmations for earning "Corgi coins"
- Wish marketplace with TON blockchain transactions
- Uses TON Connect for wallet integration and SQLite for data storage

## Commands

All commands should be run from the `telegram_webapp_example/` directory:

- `pnpm install` - Install dependencies (required - this project uses pnpm exclusively)
- `pnpm run dev` - Run development server on http://localhost:3000
- `pnpm run dev:https` - Run development server with HTTPS on https://localhost:3000 (required for testing in Telegram)
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run lint` - Run ESLint
- `pnpm run db:migrate` - Run database migrations (NEW)
- `pnpm run db:seed` - Seed initial data (NEW)

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
- **NEW**: `src/components/buddy/` - Buddy relationship management
- **NEW**: `src/components/corgi/` - Corgi sighting reporting and confirmation
- **NEW**: `src/components/wish/` - Wish creation and marketplace
- **NEW**: `src/components/wallet/` - TON Connect integration

### Telegram Integration
- Uses `@telegram-apps/sdk-react` for Telegram Mini Apps functionality
- `@tonconnect/ui-react` for TON blockchain integration
- Environment mocking for development outside Telegram (`mockTelegramEnv`)
- Theme detection and CSS variable binding for Telegram themes
- **NEW**: Bot-mediated notifications for buddy confirmations

### Development Patterns
- Client-side rendering due to Telegram Mini Apps limitations
- Error boundaries for robust error handling
- TypeScript paths configured (`@/*` for `src/*`, `@public/*` for `public/*`)
- Strict TypeScript configuration with ES2017 target
- **NEW**: Three-tier storage strategy (SecureStorage, DeviceStorage, CloudStorage)

### Testing in Telegram
- Use `pnpm run dev:https` to get HTTPS URL
- Submit `https://127.0.0.1:3000` to @BotFather (not localhost)
- Test in Telegram Web or desktop client

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

## Recent Changes (Feature 001-you-need-to)

### Phase 1 Completed (2025-09-17)
-  Data model design with SQLite schema
-  API contract specification (OpenAPI 3.0)
-  Research on Telegram Mini Apps integration patterns
-  Quickstart guide with testing scenarios
-  TON Connect integration architecture

### Next Steps
- Phase 2: Task generation for implementation
- Database migration scripts
- API endpoint implementation
- React component development
- TON Connect wallet integration
- Telegram bot backend for notifications

## Important Notes
- This template requires pnpm - other package managers will cause errors
- Some Telegram SDK features only work within Telegram environment
- The `mockTelegramEnv` function should not be used in production
- macOS Telegram client has known bugs that require special handling
- **NEW**: Bank wallet private key must be secured in environment variables
- **NEW**: All Telegram initData must be validated server-side for security

## Security Requirements
- TON wallet integration via established TON Connect SDK only
- No direct private key handling (delegated to TON Connect)
- Server-side HMAC validation for all Telegram authentication
- Three-tier storage strategy based on data sensitivity
- Bank wallet operations logged for audit trails

## Performance Goals
- <3s initial load in Telegram environment
- <500ms page transitions
- Real-time buddy notifications via bot
- SQLite appropriate for 1k-10k initial user scale
- Migration path to PostgreSQL documented for growth

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.