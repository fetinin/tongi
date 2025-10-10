# Implementation Plan: Buddy Request Accept/Reject Actions

**Branch**: `002-currently-there-is` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-currently-there-is/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add accept and reject action buttons to the buddy status screen to allow users who receive buddy requests to respond to them. When the recipient accepts, the buddy pair status transitions to "active". When rejected, it transitions to "dissolved". Only the request recipient can take these actions - the initiator sees a "Request Sent" status and must wait. Both actions trigger notifications to the initiator and update the UI immediately.

## Technical Context

**Language/Version**: TypeScript 5 with ES2017 target, strict mode enabled
**Primary Dependencies**: Next.js 15.5.3, React 18.3.1, @telegram-apps/sdk-react 3.3.7, @telegram-apps/telegram-ui 2.1.9
**Storage**: SQLite via better-sqlite3 12.2.0 (data/app.db)
**Testing**: Jest 30.1.3 with ts-jest, React Testing Library for component tests
**Target Platform**: Telegram Mini Apps (web-based, runs in Telegram client)
**Project Type**: Web (Next.js App Router with client-side components for Telegram SDK)
**Performance Goals**: <2 seconds for accept/reject action completion, <200ms API response time
**Constraints**: Client-side rendering required for Telegram SDK, SSR limitations, must work in Telegram client environment
**Scale/Scope**: 1k-10k initial users, single buddy pair per user, SQLite appropriate for scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: No project-specific constitution defined in `.specify/memory/constitution.md`

**Basic Quality Gates** (applied by default):
- ✅ **TypeScript Strict Mode**: Feature uses existing strict TypeScript configuration
- ✅ **Existing Patterns**: Feature follows established buddy service and component patterns
- ✅ **Security**: Server-side validation of Telegram initData required (existing pattern)
- ✅ **Testing**: Unit tests for services, component tests for UI, integration tests for API routes
- ✅ **No New Dependencies**: Uses existing @telegram-apps/telegram-ui components
- ✅ **Database Integrity**: Status transitions validated at service layer before DB updates

**Status**: ✅ PASS - No constitution violations, follows existing architectural patterns

### Post-Design Re-Evaluation (Phase 1 Complete)

After completing research and design artifacts (research.md, data-model.md, contracts/, quickstart.md):

**Architecture Review**:
- ✅ **No Schema Changes**: Reuses existing buddy_pairs table, confirms minimal impact principle
- ✅ **Service Layer**: New rejectBuddyRequest() follows confirmBuddyRequest() pattern exactly
- ✅ **API Design**: RESTful endpoints (/accept, /reject) with clear separation of concerns
- ✅ **Type Safety**: All interfaces and types already exist, no new type definitions needed
- ✅ **Error Handling**: Uses existing error classes (BuddyServiceError hierarchy)
- ✅ **Transaction Safety**: Leverages existing withTransaction() wrapper for atomicity

**Testing Coverage**:
- ✅ Service layer tests for rejectBuddyRequest validation logic
- ✅ API route tests for both accept and reject endpoints
- ✅ Component tests for conditional button rendering

**Security Verification**:
- ✅ Server-side initData validation (existing pattern reused)
- ✅ Authorization checks at both API and service layers (defense in depth)
- ✅ No new attack surfaces introduced

**Performance Analysis**:
- ✅ Uses prepared statements (existing optimization)
- ✅ Async notifications prevent blocking (existing pattern)
- ✅ Expected <200ms API response time (within target)

**Final Status**: ✅ **PASS** - Design phase confirms no architectural compromises required

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── app/
│   └── api/
│       └── buddy/
│           ├── accept/
│           │   └── route.ts          # NEW: POST endpoint for accepting requests
│           ├── reject/
│           │   └── route.ts          # NEW: POST endpoint for rejecting requests
│           ├── status/
│           │   └── route.ts          # MODIFY: May need response format updates
│           ├── request/
│           │   └── route.ts          # EXISTING: Buddy request creation
│           └── search/
│               └── route.ts          # EXISTING: Buddy search
│
├── components/
│   ├── buddy/
│   │   ├── BuddyStatus.tsx           # MODIFY: Add accept/reject buttons
│   │   ├── BuddyRequest.tsx          # EXISTING: Request creation UI
│   │   └── BuddySearch.tsx           # EXISTING: Search UI
│   └── Auth/
│       └── AuthProvider.tsx          # EXISTING: Authentication context
│
└── services/
    ├── BuddyService.ts               # MODIFY: Add acceptRequest, rejectRequest methods
    ├── NotificationService.ts        # EXISTING: Used for sending bot messages
    └── UserService.ts                # EXISTING: User data access

tests/
├── services/
│   └── BuddyService.test.ts         # NEW: Tests for accept/reject logic
├── components/
│   └── BuddyStatus.test.tsx         # NEW: Component tests for buttons
└── api/
    └── buddy/
        ├── accept.test.ts            # NEW: API route tests
        └── reject.test.ts            # NEW: API route tests
```

**Structure Decision**: Next.js 15 App Router structure with API routes colocated in `src/app/api/`. Client components in `src/components/`, business logic in `src/services/`. This follows the existing codebase architecture for buddy features.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: No complexity violations - feature follows existing patterns and requires no justification.
