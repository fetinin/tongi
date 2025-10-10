# Tasks: Buddy Request Accept/Reject Actions

**Input**: Design documents from `/specs/002-currently-there-is/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are NOT explicitly requested in the spec - test tasks are included for completeness but can be deferred or skipped for MVP.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and dependencies (no new setup required)

- [X] T001 Verify development environment: `pnpm install` and `pnpm run type-check` pass
- [X] T002 Confirm existing BuddyService and NotificationService are functional

**Status**: ✅ No setup needed - project infrastructure already exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core service layer methods that MUST be complete before ANY user story UI/API can be implemented

**⚠️ CRITICAL**: No API route or UI work can begin until this phase is complete

### Service Layer Foundation

- [X] T003 [P] [Foundation] Add `rejectBuddyRequest()` method to `src/services/BuddyService.ts` (mirrors confirmBuddyRequest pattern, sets status to 'dissolved', validates recipient)
- [X] T004 [P] [Foundation] Add `notifyBuddyRejected()` method to `src/services/NotificationService.ts` (sends "❌ Buddy request: {rejecterName} declined your buddy request.")

**Checkpoint**: Foundation ready - service layer can accept and reject buddy requests. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Accept Incoming Buddy Request (Priority: P1) 🎯 MVP

**Goal**: Enable users who receive buddy requests to accept them, establishing an active buddy partnership.

**Independent Test**: Create a pending buddy request in the database (user A → user B), log in as user B, navigate to buddy status screen, tap "Accept", verify status changes to "active" and user A receives notification.

### Implementation for User Story 1

- [X] T005 [P] [US1] Create API route `src/app/api/buddy/accept/route.ts` (POST endpoint, validates Telegram initData, calls buddyService.confirmBuddyRequest, returns BuddyPairWithProfile)
- [X] T006 [P] [US1] Add state management to `src/components/buddy/BuddyStatus.tsx` (useState for isProcessing and actionError)
- [X] T007 [US1] Add `handleAccept()` function to `src/components/buddy/BuddyStatus.tsx` (calls /api/buddy/accept, sets processing state, refreshes buddy status on success)
- [X] T008 [US1] Add Accept button UI to `src/components/buddy/BuddyStatus.tsx` (conditional render when status='pending' AND user is recipient, Button mode="filled", disabled={isProcessing})
- [X] T009 [US1] Add error display UI to `src/components/buddy/BuddyStatus.tsx` (show actionError message if present)
- [X] T010 [US1] Verify accept flow end-to-end: Manual test with two users, confirm status transitions to 'active', notification sent, UI updates

**Checkpoint**: At this point, User Story 1 should be fully functional - users can accept buddy requests and see immediate UI feedback.

---

## Phase 4: User Story 2 - Reject Incoming Buddy Request (Priority: P1)

**Goal**: Enable users who receive buddy requests to reject them cleanly, allowing both users to pursue other partnerships.

**Independent Test**: Create a pending buddy request in the database (user A → user B), log in as user B, navigate to buddy status screen, tap "Reject", verify status changes to "dissolved", UI shows "No Buddy Yet", and user A receives notification.

### Implementation for User Story 2

- [X] T011 [P] [US2] Create API route `src/app/api/buddy/reject/route.ts` (POST endpoint, validates Telegram initData, calls buddyService.rejectBuddyRequest, returns BuddyPairWithProfile with status='dissolved')
- [X] T012 [US2] Add `handleReject()` function to `src/components/buddy/BuddyStatus.tsx` (calls /api/buddy/reject, sets processing state, refreshes buddy status on success)
- [X] T013 [US2] Add Reject button UI to `src/components/buddy/BuddyStatus.tsx` (conditional render when status='pending' AND user is recipient, Button mode="outline", disabled={isProcessing}, placed next to Accept button)
- [X] T014 [US2] Verify reject flow end-to-end: Manual test with two users, confirm status transitions to 'dissolved', notification sent, UI shows "No Buddy Yet"

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can accept OR reject buddy requests.

---

## Phase 5: User Story 3 - Request Initiator Views Pending Status (Priority: P2)

**Goal**: Show request initiators that their request is pending and they cannot take action (only recipient can respond).

**Independent Test**: Create a pending buddy request in the database where current user is the initiator, load buddy status screen, verify no action buttons shown, only "Request Sent" or "Waiting for Response" indicator visible.

### Implementation for User Story 3

- [X] T015 [US3] Verify existing "Request Sent" badge in `src/components/buddy/BuddyStatus.tsx` shows correctly for initiators (conditional render when status='pending' AND user.id === buddyStatus.initiatedBy)
- [X] T016 [US3] Confirm Accept/Reject buttons are hidden for initiators in `src/components/buddy/BuddyStatus.tsx` (verify condition user.id !== buddyStatus.initiatedBy)
- [X] T017 [US3] Test initiator view: Manual test as initiator user, confirm no action buttons visible, status indicator shows "Request Sent"

**Checkpoint**: All user stories 1-3 should now be independently functional - recipients can act, initiators cannot.

---

## Phase 6: User Story 4 - Confirmation Dialog for Reject Action (Priority: P3)

**Goal**: Add confirmation prompt before rejection to prevent accidental rejections and explain consequences.

**Independent Test**: Tap "Reject" button, verify confirmation dialog appears with appropriate messaging, "Cancel" dismisses without changes, "Confirm" proceeds with rejection.

### Implementation for User Story 4

- [ ] T018 [US4] Add state management for rejection confirmation dialog to `src/components/buddy/BuddyStatus.tsx` (useState for showRejectConfirm)
- [ ] T019 [US4] Update `handleReject()` to show confirmation dialog first in `src/components/buddy/BuddyStatus.tsx` (setShowRejectConfirm(true) instead of immediate API call)
- [ ] T020 [US4] Add `handleConfirmReject()` function to `src/components/buddy/BuddyStatus.tsx` (performs actual rejection, calls API, closes dialog)
- [ ] T021 [US4] Add confirmation dialog UI to `src/components/buddy/BuddyStatus.tsx` (use Telegram UI Modal component, message: "Are you sure you want to reject this buddy request?", buttons: "Cancel" and "Reject")
- [ ] T022 [US4] Test confirmation dialog: Verify dialog shows, Cancel works, Confirm proceeds with rejection

**Checkpoint**: All user stories should now be complete with quality-of-life improvements.

---

## Phase 7: Testing & Validation (Optional - Not Required for MVP)

**Purpose**: Comprehensive test coverage for production readiness (can be deferred)

### Service Layer Tests

- [ ] T023 [P] [Tests] Create `tests/services/BuddyService.test.ts` with test: rejectBuddyRequest success case (validates status changes to 'dissolved')
- [ ] T024 [P] [Tests] Add test to `tests/services/BuddyService.test.ts`: rejectBuddyRequest throws error when initiator tries to reject own request
- [ ] T025 [P] [Tests] Add test to `tests/services/BuddyService.test.ts`: rejectBuddyRequest throws error when buddy pair status is not 'pending'
- [ ] T026 [P] [Tests] Add test to `tests/services/BuddyService.test.ts`: rejectBuddyRequest throws BuddyNotFoundError when pair doesn't exist

### API Route Tests

- [ ] T027 [P] [Tests] Create `tests/api/buddy/accept.test.ts` with test: validates Telegram initData authentication requirement
- [ ] T028 [P] [Tests] Add test to `tests/api/buddy/accept.test.ts`: validates request body schema (initData + buddyPairId required)
- [ ] T029 [P] [Tests] Add test to `tests/api/buddy/accept.test.ts`: returns 200 with BuddyPairWithProfile on success
- [ ] T030 [P] [Tests] Add test to `tests/api/buddy/accept.test.ts`: returns 400 when initiator tries to accept own request
- [ ] T031 [P] [Tests] Create `tests/api/buddy/reject.test.ts` with test: validates Telegram initData authentication requirement
- [ ] T032 [P] [Tests] Add test to `tests/api/buddy/reject.test.ts`: validates request body schema (initData + buddyPairId required)
- [ ] T033 [P] [Tests] Add test to `tests/api/buddy/reject.test.ts`: returns 200 with BuddyPairWithProfile (status='dissolved') on success
- [ ] T034 [P] [Tests] Add test to `tests/api/buddy/reject.test.ts`: returns 400 when initiator tries to reject own request

### Component Tests

- [ ] T035 [P] [Tests] Create `tests/components/BuddyStatus.test.tsx` with test: Accept and Reject buttons shown only when user is recipient
- [ ] T036 [P] [Tests] Add test to `tests/components/BuddyStatus.test.tsx`: Accept and Reject buttons hidden when user is initiator
- [ ] T037 [P] [Tests] Add test to `tests/components/BuddyStatus.test.tsx`: buttons disabled during processing (isProcessing=true)
- [ ] T038 [P] [Tests] Add test to `tests/components/BuddyStatus.test.tsx`: error message displays when actionError is set

### Integration Tests

- [ ] T039 [Tests] Run `pnpm test` to verify all tests pass
- [ ] T040 [Tests] Run `pnpm run type-check` to verify TypeScript compilation succeeds
- [ ] T041 [Tests] Run `pnpm run lint` to verify code style passes

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T042 [P] [Polish] Add haptic feedback to `src/components/buddy/BuddyStatus.tsx` (import useHapticFeedback from @telegram-apps/sdk-react, call haptic.impactOccurred('medium') in handleAccept and handleReject)
- [ ] T043 [P] [Polish] Review error messages across accept/reject flows for clarity and user-friendliness
- [ ] T044 [Polish] Validate quickstart.md scenarios manually (follow steps in quickstart.md to ensure instructions are accurate)
- [ ] T045 [Polish] Code cleanup: Remove console.logs, add JSDoc comments to new functions
- [ ] T046 [Polish] Performance check: Verify <2s completion time for accept/reject actions in Telegram client

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately ✅ Already complete
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase (T003-T004) completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Testing (Phase 7)**: Depends on all desired user stories being complete - OPTIONAL for MVP
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T003 (confirmBuddyRequest already exists, just need notifyBuddyConfirmed which exists)
- **User Story 2 (P1)**: Depends on T003, T004 (requires rejectBuddyRequest and notifyBuddyRejected)
- **User Story 3 (P2)**: Can start after Foundational - Validates existing UI behavior, no new service code
- **User Story 4 (P3)**: Depends on US1 and US2 being complete (enhances reject flow)

### Within Each User Story

- API routes before component handlers (T005 before T007, T011 before T012)
- State management before handlers (T006 before T007)
- Handlers before UI (T007 before T008, T012 before T013)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 2 (Foundational)**: T003 and T004 can run in parallel (different files)
- **Phase 3 (US1)**: T005 and T006 can run in parallel (different files)
- **Phase 4 (US2)**: T011 API route can run while T012 component handler is being written (different files)
- **Phase 7 (Tests)**: All test file creation tasks can run in parallel (T023-T026, T027-T030, T031-T034, T035-T038)
- **Phase 8 (Polish)**: T042 and T043 can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch foundation service methods together:
Task: "Add rejectBuddyRequest() method to src/services/BuddyService.ts"
Task: "Add notifyBuddyRejected() method to src/services/NotificationService.ts"
```

## Parallel Example: User Story 1

```bash
# Launch API and component state setup together:
Task: "Create API route src/app/api/buddy/accept/route.ts"
Task: "Add state management to src/components/buddy/BuddyStatus.tsx"
```

## Parallel Example: Testing Phase

```bash
# Launch all test file creation together:
Task: "Create tests/services/BuddyService.test.ts with rejectBuddyRequest tests"
Task: "Create tests/api/buddy/accept.test.ts with authentication validation tests"
Task: "Create tests/api/buddy/reject.test.ts with authentication validation tests"
Task: "Create tests/components/BuddyStatus.test.tsx with button rendering tests"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup ✅ Already done
2. Complete Phase 2: Foundational (T003-T004) - Service layer methods
3. Complete Phase 3: User Story 1 (T005-T010) - Accept functionality
4. Complete Phase 4: User Story 2 (T011-T014) - Reject functionality
5. **STOP and VALIDATE**: Test both accept and reject flows with real users
6. Deploy/demo if ready

**Result**: Core buddy request response functionality is complete and usable.

### Incremental Delivery

1. Complete Setup + Foundational (T001-T004) → Service layer ready
2. Add User Story 1 (T005-T010) → Test accept independently → Deploy/Demo (MVP!)
3. Add User Story 2 (T011-T014) → Test reject independently → Deploy/Demo
4. Add User Story 3 (T015-T017) → Validate initiator view → Deploy/Demo
5. Add User Story 4 (T018-T022) → Add confirmation UX → Deploy/Demo
6. Add Testing (T023-T041) → Production-ready validation
7. Add Polish (T042-T046) → Enhanced UX

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T004)
2. Once Foundational is done:
   - Developer A: User Story 1 (T005-T010)
   - Developer B: User Story 2 (T011-T014)
   - Developer C: User Story 3 (T015-T017)
3. After US1 & US2 complete:
   - Developer D: User Story 4 (T018-T022)
4. Stories complete and integrate independently

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Each user story should be independently completable and testable**
- **Tests are OPTIONAL**: Not explicitly requested in spec - Phase 7 can be deferred for MVP
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **IMPORTANT**: confirmBuddyRequest() already exists - User Story 1 reuses it (no new service method needed for accept)
- rejectBuddyRequest() is new and must be implemented in Phase 2

---

## Success Criteria

Before marking this feature complete, verify:

- ✅ Accept button works for recipients, changes status to 'active' (US1)
- ✅ Reject button works for recipients, changes status to 'dissolved' (US2)
- ✅ Initiators see "Request Sent" with no action buttons (US3)
- ✅ Notifications sent to initiator on accept and reject (US1, US2)
- ✅ UI updates immediately after successful action (US1, US2)
- ✅ Error messages display clearly on failures (US1, US2)
- ✅ Type checking passes: `pnpm run type-check`
- ✅ Code style passes: `pnpm run lint`

**Optional for MVP:**
- ⚪ Confirmation dialog shows before rejection (US4)
- ⚪ All tests pass: `pnpm test` (Phase 7)
- ⚪ Haptic feedback on button press (Phase 8)

---

## Task Summary

- **Total Tasks**: 46
- **Setup & Foundational**: 4 tasks (T001-T004)
- **User Story 1 (P1)**: 6 tasks (T005-T010)
- **User Story 2 (P1)**: 4 tasks (T011-T014)
- **User Story 3 (P2)**: 3 tasks (T015-T017)
- **User Story 4 (P3)**: 5 tasks (T018-T022)
- **Testing (Optional)**: 19 tasks (T023-T041)
- **Polish (Optional)**: 5 tasks (T042-T046)

**MVP Scope**: T001-T014 (18 tasks) = Setup + Foundational + US1 + US2
**Parallel Opportunities**: 14 tasks can run in parallel (marked with [P])
**Independent Stories**: 4 user stories, each independently testable
