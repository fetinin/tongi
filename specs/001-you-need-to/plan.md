
# Implementation Plan: Corgi Buddy TON Cryptocurrency Mini-App

**Branch**: `001-you-need-to` | **Date**: 2025-09-17 | **Spec**: [/Users/inv-denisf/dev/personal/tongi/specs/001-you-need-to/spec.md](../spec.md)
**Input**: Feature specification from `/specs/001-you-need-to/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
A Telegram Mini App for establishing buddy relationships between users to facilitate TON cryptocurrency transactions. Users can earn "Corgi coins" by reporting corgi sightings that their buddy confirms, and spend those coins to purchase wishes from their buddy through TON blockchain transactions. The app requires integration with Telegram Mini Apps SDK, TON Connect for wallet authentication, and a bank wallet system for Corgi coin distribution.

## Technical Context
**Language/Version**: TypeScript with Node.js (Next.js 15), React 18+
**Primary Dependencies**: Next.js, React, @telegram-apps/sdk-react, @tonconnect/ui-react, TailwindCSS
**Storage**: SQLite database for user data, buddy relationships, transactions
**Testing**: Jest, React Testing Library, Playwright for E2E
**Target Platform**: Mobile web browsers via Telegram Mini Apps (iOS/Android)
**Project Type**: web - frontend and backend in Next.js app (project root directory)
**Performance Goals**: <3s initial load, <500ms page transitions, real-time notifications
**Constraints**: Must work within Telegram Mini App environment, secure TON wallet integration, mobile-first responsive design
**Scale/Scope**: Initially 1k-10k users, ~20 screens/components, real-time buddy interactions

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Security Requirements**:
- ✅ TON wallet integration via established TON Connect SDK
- ✅ Telegram authentication through official SDK
- ✅ No direct private key handling (delegated to TON Connect)
- ✅ Bank wallet managed through secure environment variables

**Simplicity Requirements**:
- ✅ Uses existing Next.js template structure
- ✅ Minimal dependencies (Telegram SDK + TON Connect + SQLite)
- ✅ Standard REST API patterns for backend
- ✅ Component-based React architecture

**Testing Requirements**:
- ✅ Contract tests for all API endpoints
- ✅ Integration tests for user flows
- ✅ Mocked Telegram/TON environments for testing

**Performance Requirements**:
- ✅ SQLite appropriate for initial scale (1k-10k users)
- ✅ Client-side state management for real-time feel
- ✅ Mobile-optimized components and images

**POST-DESIGN EVALUATION**:
- ✅ Database schema follows normalized design principles
- ✅ API contracts use standard REST patterns with OpenAPI specification
- ✅ No additional complexity introduced beyond initial assessment
- ✅ Component architecture remains simple and focused
- ✅ Security patterns confirmed (HMAC validation, secure storage tiers)

**NO NEW VIOLATIONS DETECTED** - Constitution check passes for both initial and post-design phases

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
# Using Next.js App Router structure in project root
src/
├── app/
│   ├── api/           # Backend API routes
│   │   ├── auth/
│   │   ├── buddy/
│   │   ├── corgi/
│   │   ├── wishes/
│   │   ├── marketplace/
│   │   └── transactions/
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page
├── components/
│   ├── buddy/         # Buddy management components
│   ├── corgi/         # Corgi sighting components
│   ├── wish/          # Wish creation/marketplace
│   ├── wallet/        # TON Connect integration
│   └── Root/          # App initialization
├── core/
│   ├── telegram/      # Telegram SDK utilities
│   ├── ton/           # TON Connect utilities
│   ├── database/      # SQLite schema and queries
│   └── types/         # TypeScript definitions
└── lib/               # Utility functions

__tests__/
├── api/               # API endpoint tests
├── components/        # Component tests
└── integration/       # E2E tests

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - New Next.js application in project root with backend API routes and frontend components, using `telegram_webapp_example/` as reference implementation

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Project Setup & Database Foundation** (Priority 1):
   - Initialize Next.js 15 project with TypeScript in project root
   - Install required dependencies (@telegram-apps/sdk-react, @tonconnect/ui-react, etc.)
   - Database migration scripts from data-model.md schema
   - Seed scripts for bank wallet initialization
   - Database connection and ORM setup

2. **API Contract Implementation** (Priority 2):
   - Contract test tasks from api-spec.yaml [P]
   - One test file per endpoint to validate request/response schemas
   - Authentication middleware for Telegram validation
   - Error handling middleware

3. **Entity Implementation** (Priority 3):
   - Model classes for each entity (User, BuddyPair, CorgiSighting, Wish, Transaction, BankWallet) [P]
   - Validation logic implementation
   - Database access layer (repository pattern)

4. **Core Services** (Priority 4):
   - Telegram authentication service with HMAC validation
   - TON Connect integration service
   - Bank wallet management service
   - Notification service for buddy communications

5. **API Endpoints** (Priority 5):
   - Implementation of all endpoints from api-spec.yaml
   - Following TDD pattern: tests already exist, implement to make them pass
   - Integration with Telegram bot for notifications

6. **Frontend Components** (Priority 6):
   - Buddy management UI components [P]
   - Corgi sighting reporting interface [P]
   - Wish creation and marketplace UI [P]
   - TON Connect wallet integration [P]

7. **Integration Testing** (Priority 7):
   - End-to-end user journey tests from quickstart.md scenarios
   - Telegram environment mocking for standalone testing
   - TON blockchain interaction testing

**Ordering Strategy**:
- **Test-Driven Development**: All contract tests written before implementation
- **Bottom-Up Dependencies**: Database → Models → Services → API → UI → Integration
- **Parallel Execution**: Mark [P] for independent file/component creation
- **Sequential Gates**: Each priority level must complete before next begins

**Estimated Task Breakdown**:
- Project setup: 2-3 tasks
- Database setup: 3-4 tasks
- Contract tests: 8-10 tasks [P]
- Entity implementation: 6-8 tasks [P]
- Service layer: 5-6 tasks
- API endpoints: 8-10 tasks
- UI components: 10-12 tasks [P]
- Integration tests: 4-5 tasks
- **Total**: 46-58 numbered, ordered tasks

**Key Dependencies**:
- Next.js project setup must complete before any development
- Database schema must be established before any model implementation
- Authentication service required before any protected endpoints
- TON Connect service needed before marketplace functionality
- Buddy pairing must work before corgi sightings or wishes
- All API endpoints must pass contract tests before UI implementation

**Testing Strategy Integration**:
- Contract tests validate API schemas and error handling
- Unit tests for business logic in services and models
- Integration tests for complete user workflows
- Performance tests for database queries and API response times

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - ✅ 2025-09-17
- [x] Phase 1: Design complete (/plan command) - ✅ 2025-09-17
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✅ 2025-09-17
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - ✅ 2025-09-17
- [x] Post-Design Constitution Check: PASS - ✅ 2025-09-17
- [ ] All NEEDS CLARIFICATION resolved - Pending FR-019 failure handling definition
- [x] Complexity deviations documented - ✅ None required

**Artifacts Generated**:
- [x] `/specs/001-you-need-to/research.md` - Technical research and decisions
- [x] `/specs/001-you-need-to/data-model.md` - Complete database schema and entities
- [x] `/specs/001-you-need-to/contracts/api-spec.yaml` - OpenAPI specification
- [x] `/specs/001-you-need-to/quickstart.md` - Testing scenarios and validation
- [x] `/CLAUDE.md` - Updated agent context with feature details

---
*Based on Constitution v2.1.1 - See `.specify/memory/constitution.md`*
