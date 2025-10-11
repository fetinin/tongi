<!--
SYNC IMPACT REPORT:
Version: 1.0.0 (initial constitution)
Ratification: 2025-10-11 (initial adoption)

New Principles Added:
- I. Security-First Development
- II. Telegram Platform Integration
- III. Type Safety & Code Quality
- IV. Testing Before Implementation
- V. Database Integrity

New Sections Added:
- Technology Stack & Constraints
- Development Workflow
- Governance

Templates Status:
- plan-template.md: ✅ Constitution Check section aligns with new principles
- spec-template.md: ✅ User Scenarios structure supports security and quality gates
- tasks-template.md: ✅ Phase structure supports foundational security and type-safety checks

Follow-up: None - initial constitution complete
-->

# Tongi (Corgi Buddy) Constitution

## Core Principles

### I. Security-First Development

**All Telegram authentication MUST be validated server-side using HMAC signatures.** Client-provided initData is untrusted until cryptographic verification passes. TON wallet integration MUST use only the established TON Connect SDK—no direct private key handling. Bank wallet private keys MUST be stored in environment variables, never committed to source control. All API endpoints accepting Telegram user data MUST validate initData before processing.

**Rationale**: Telegram Mini Apps run in a semi-trusted environment where client-side code can be manipulated. Server-side validation ensures that user identity claims are genuine and prevents impersonation attacks. TON Connect delegation protects users' cryptocurrency from application-level vulnerabilities.

### II. Telegram Platform Integration

**The application MUST function correctly within the Telegram environment while supporting mock mode for development.** The `Root` component handles Telegram SDK initialization and environment detection. The `mockTelegramEnv` function provides development-time simulation but MUST NOT be deployed to production. Theme integration MUST respect Telegram's CSS variables and theme changes. Internationalization MUST derive locale from `telegram.initDataUnsafe.user.language_code`.

**Rationale**: Telegram Mini Apps have unique constraints—no traditional SSR, limited navigation, theme coupling. Mock mode enables rapid iteration without requiring deployment to @BotFather for every change, but production security depends on disabling mocks.

### III. Type Safety & Code Quality

**All code MUST pass TypeScript strict type checking (`pnpm run type-check`) and ESLint validation (`pnpm run lint`) before commit.** The project uses TypeScript 5 with ES2017 target and strict mode enabled. All changes MUST be formatted with Prettier (`pnpm run format:check`) before committing. The `pnpm run validate` command combines lint and type-check and MUST pass on all branches.

**Rationale**: TypeScript catches entire classes of runtime errors at compile time. Strict checking prevents `any` escape hatches that undermine safety. Consistent formatting reduces cognitive load during code review and prevents style-based merge conflicts. Early detection of issues is cheaper than debugging production failures.

**Pre-Commit Gate**: MUST run `pnpm run format:check` before committing changes to ensure code formatting standards are maintained.

### IV. Testing Before Implementation

**Tests MUST be written and verified to FAIL before implementing the feature they validate.** Contract tests verify API endpoint schemas. Integration tests validate complete user journeys. Unit tests (when included) verify isolated logic. Tests are OPTIONAL unless explicitly requested in feature specifications, but when present, they MUST follow the red-green-refactor cycle: write test → verify failure → implement → verify pass.

**Rationale**: Writing tests first clarifies requirements and prevents false positives (tests that pass without valid implementation). The red-green-refactor cycle ensures tests genuinely validate behavior rather than rubber-stamping existing code.

### V. Database Integrity

**Database schema changes MUST use migrations (`pnpm run db:migrate`).** The SQLite database at `./data/app.db` contains all persistent state: users, buddy relationships, corgi sightings, wishes, and transactions. Schema changes MUST be reversible where practical. Seed data (`pnpm run db:seed`) MUST be idempotent and safe for development environments.

**Rationale**: Migrations provide change history and enable safe schema evolution across environments. Direct schema manipulation risks data loss and environment inconsistencies. SQLite's serverless nature makes backups critical since there's no separate database server to manage.

## Technology Stack & Constraints

**Framework**: Next.js 15 with App Router (client-side rendering due to Telegram constraints)
**Language**: TypeScript 5 with strict mode, ES2017 target
**Package Manager**: pnpm exclusively (other managers will fail)
**UI**: TailwindCSS + `@telegram-apps/telegram-ui` for platform consistency
**Blockchain**: TON via `@tonconnect/ui-react` SDK (v2.3.0+)
**Storage**: SQLite 3 (`./data/app.db`) via better-sqlite3
**Testing**: Jest with ts-jest for TypeScript support

**Development URLs**:
- Local: `http://localhost:3000` (standard dev mode)
- HTTPS: `https://127.0.0.1:3000` (required for Telegram testing—submit to @BotFather)

**Storage Strategy**:
- **SecureStorage**: TON wallet connections, sensitive user tokens
- **DeviceStorage**: User preferences, UI state
- **CloudStorage**: Sync-able state across devices (when Telegram supports it)

**Scale**: Designed for 1k-10k initial users; SQLite appropriate for this scale

## Development Workflow

### Before Starting Work
1. Ensure dependencies installed: `pnpm install`
2. Verify database initialized: `pnpm run db:migrate`
3. For development without Telegram: set `NEXT_PUBLIC_USE_MOCK_AUTH=true` in `.env.local`

### During Development
1. Run dev server: `pnpm run dev` (or `pnpm run dev:https` for Telegram testing)
2. Make changes to code
3. Validate as you go:
   - Type check: `pnpm run type-check`
   - Lint: `pnpm run lint`
   - Format: `pnpm run format`

### Before Committing
1. **REQUIRED**: Run `pnpm run format:check` to verify code formatting
2. **REQUIRED**: Run `pnpm run validate` (combines lint + type-check)
3. If validation fails, fix errors before committing
4. Run tests if they exist: `pnpm run test`

### Testing in Telegram
1. Run HTTPS dev server: `pnpm run dev:https`
2. Accept browser certificate warning for `https://127.0.0.1:3000`
3. Submit URL to @BotFather (use `127.0.0.1`, NOT `localhost`)
4. Test in Telegram Web or desktop client
5. Note: macOS Telegram client has known bugs requiring special handling

### Production Deployment
1. Build: `pnpm run build`
2. Ensure `NEXT_PUBLIC_USE_MOCK_AUTH` is NOT set or is `false`
3. Secure environment variables for production (bank wallet key, bot token)
4. Run: `pnpm run start`

## Governance

**Constitutional Authority**: This constitution supersedes all other development practices. When conflicts arise between this document and other guidance, the constitution takes precedence.

**Amendments**: Constitution changes require:
1. Documented justification for the change
2. Analysis of impact on existing principles and templates
3. Update of version number following semantic versioning:
   - **MAJOR**: Backward-incompatible changes (principle removal/redefinition)
   - **MINOR**: New principles or material expansions
   - **PATCH**: Clarifications, wording improvements, non-semantic changes
4. Propagation of changes to dependent templates (plan, spec, tasks)
5. Update of Sync Impact Report in HTML comment at top of this file

**Compliance Verification**:
- All pull requests MUST demonstrate adherence to core principles
- Constitution Check section in `plan-template.md` gates Phase 0 research
- Complexity that violates principles MUST be justified in the Complexity Tracking table

**Versioning Policy**:
- Version number appears at bottom of this document
- Ratification date is the original adoption date (2025-10-11)
- Last Amended date updates whenever content changes

**Agent-Specific Notes**: This constitution uses "CLAUDE" or generic "agent" terminology where tool-specific guidance is needed. Projects may use any compatible agent or tooling that respects these principles.

**Version**: 1.0.0 | **Ratified**: 2025-10-11 | **Last Amended**: 2025-10-11
