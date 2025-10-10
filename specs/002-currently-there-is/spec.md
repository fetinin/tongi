# Feature Specification: Buddy Request Accept/Reject Actions

**Feature Branch**: `002-currently-there-is`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "Currently, there is no way to accept or reject buddy request. It needs to be added on the buddy status screen. After user recieve buddy request, it should be able to accept/reject it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accept Incoming Buddy Request (Priority: P1)

When a user receives a buddy request from another user, they need to review the request details and accept it to establish an active buddy partnership. Upon accepting, both users become active buddies who can report corgi sightings together and earn Corgi coins.

**Why this priority**: This is the most critical user flow because without the ability to accept requests, the buddy system cannot function. This represents the "happy path" that enables the core app functionality (corgi sighting confirmations and Corgi coin earning).

**Independent Test**: Can be fully tested by creating a pending buddy request in the database, loading the buddy status screen as the recipient user, tapping the "Accept" button, and verifying the buddy pair status changes to "active" and the user receives confirmation feedback.

**Acceptance Scenarios**:

1. **Given** a user has a pending buddy request where they are the recipient (not the initiator), **When** they view the buddy status screen, **Then** they see the request details with clearly labeled "Accept" and "Reject" action buttons
2. **Given** a user views a pending buddy request they received, **When** they tap the "Accept" button, **Then** the system confirms the buddy pair status changes to "active", sets the confirmed_at timestamp, and displays success feedback
3. **Given** a user successfully accepts a buddy request, **When** the acceptance is complete, **Then** the buddy status screen updates to show the active buddy relationship with appropriate status indicators
4. **Given** a user accepts a buddy request, **When** the acceptance is processed, **Then** the other user (the initiator) receives a notification that their request was accepted

---

### User Story 2 - Reject Incoming Buddy Request (Priority: P1)

When a user receives a buddy request they do not want to accept, they need the ability to reject it cleanly. This removes the pending request and allows both users to pursue other buddy partnerships.

**Why this priority**: Equally critical as accept functionality - users must have agency to decline unwanted partnerships. Without reject capability, users would be stuck with pending requests they don't want, creating poor user experience and blocking them from accepting other requests.

**Independent Test**: Can be fully tested by creating a pending buddy request in the database, loading the buddy status screen as the recipient user, tapping the "Reject" button, and verifying the buddy pair status changes to "dissolved" and the user returns to a "no buddy" state.

**Acceptance Scenarios**:

1. **Given** a user has a pending buddy request where they are the recipient, **When** they tap the "Reject" button, **Then** the system changes the buddy pair status to "dissolved" and displays appropriate feedback
2. **Given** a user rejects a buddy request, **When** the rejection is complete, **Then** the buddy status screen updates to show "No Buddy Yet" state with option to find a new buddy
3. **Given** a user rejects a buddy request, **When** the rejection is processed, **Then** the other user (the initiator) receives a notification that their request was rejected
4. **Given** a user rejects a buddy request, **When** they later want to find a buddy, **Then** they can send or receive new buddy requests without restriction

---

### User Story 3 - Request Initiator Views Pending Status (Priority: P2)

When a user sends a buddy request and is waiting for the recipient to respond, they need clear visibility that their request is pending and cannot take action themselves (only the recipient can accept/reject).

**Why this priority**: Important for user experience and clarity, but secondary to the actual accept/reject functionality. This prevents confusion about who can act on the request.

**Independent Test**: Can be fully tested by creating a pending buddy request in the database where the current user is the initiator, loading the buddy status screen, and verifying that no action buttons are shown, only a "waiting for response" message.

**Acceptance Scenarios**:

1. **Given** a user sent a buddy request that is still pending, **When** they view the buddy status screen, **Then** they see the pending buddy details with a "Request Sent" or "Waiting for Response" indicator
2. **Given** a user is viewing their sent pending request, **When** they look for action buttons, **Then** they do not see "Accept" or "Reject" buttons (only the recipient can act)
3. **Given** a user sent a pending request, **When** the recipient accepts or rejects it, **Then** the buddy status screen updates automatically on next refresh to show the new status

---

### User Story 4 - Confirmation Dialog for Reject Action (Priority: P3)

When a user is about to reject a buddy request, they should see a confirmation prompt to prevent accidental rejections and explain the consequences.

**Why this priority**: Nice-to-have quality-of-life feature that reduces mistakes, but the core functionality works without it. Can be added after MVP acceptance/rejection is working.

**Independent Test**: Can be fully tested by tapping the "Reject" button and verifying that a confirmation dialog appears with appropriate messaging before the rejection is processed.

**Acceptance Scenarios**:

1. **Given** a user taps the "Reject" button on a pending buddy request, **When** the action is triggered, **Then** a confirmation dialog appears asking "Are you sure you want to reject this buddy request?"
2. **Given** a user sees the rejection confirmation dialog, **When** they tap "Cancel", **Then** the dialog closes and no changes are made to the buddy pair status
3. **Given** a user sees the rejection confirmation dialog, **When** they tap "Confirm" or "Reject", **Then** the rejection proceeds as normal

---

### Edge Cases

- What happens when a user tries to accept a buddy request that was already accepted or rejected by someone else (race condition)?
- What happens when a user tries to accept/reject a request but the other user has deleted their account?
- What happens when a user receives multiple rapid taps on the Accept or Reject button (duplicate submissions)?
- What happens when the network request to accept/reject fails (timeout, 500 error)?
- What happens when a user is viewing a pending request and the other user cancels or the request expires?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display "Accept" and "Reject" action buttons on the buddy status screen only when the current user is the recipient of a pending buddy request
- **FR-002**: System MUST hide "Accept" and "Reject" buttons when the current user is the initiator of a pending buddy request (only recipient can respond)
- **FR-003**: System MUST change buddy pair status from "pending" to "active" when the recipient accepts the request
- **FR-004**: System MUST set the confirmed_at timestamp to the current time when a buddy request is accepted
- **FR-005**: System MUST change buddy pair status from "pending" to "dissolved" when the recipient rejects the request
- **FR-006**: System MUST display immediate visual feedback (success message, loading state, or error message) after accept/reject actions
- **FR-007**: System MUST update the buddy status screen UI automatically after successful accept or reject actions without requiring manual page refresh
- **FR-008**: System MUST prevent duplicate accept/reject actions through button disabling during API request processing
- **FR-009**: System MUST validate on the server that the user taking the action is the legitimate recipient of the request before allowing accept/reject
- **FR-010**: System MUST handle error scenarios gracefully (network failures, invalid requests, concurrent modifications) with user-friendly error messages
- **FR-011**: System MUST send notification to the request initiator when their buddy request is accepted
- **FR-012**: System MUST send notification to the request initiator when their buddy request is rejected

### Key Entities

- **BuddyPair**: Represents the relationship between two users with fields:
  - id: Unique identifier for the relationship
  - user1_id, user2_id: The two users in the relationship (order normalized)
  - initiated_by: Identifies which user sent the request
  - status: Current state (pending → active when accepted, pending → dissolved when rejected)
  - created_at: When the request was created
  - confirmed_at: Timestamp set when request is accepted

- **User**: Person using the app who can send/receive buddy requests
  - id: Unique Telegram user identifier
  - Relationship: Must be authenticated to accept/reject requests

- **Notification**: Messages sent to users about buddy request status changes
  - Sent to initiator when recipient accepts or rejects

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who receive buddy requests can complete the accept action in under 5 seconds from viewing the buddy status screen to seeing confirmation
- **SC-002**: Users who receive buddy requests can complete the reject action in under 5 seconds from viewing the buddy status screen to seeing confirmation
- **SC-003**: Accept and reject actions succeed 99% of the time under normal network conditions (no server errors or data corruption)
- **SC-004**: Users understand who can take action on pending requests (100% of pending requests display appropriate controls based on user role)
- **SC-005**: Zero duplicate buddy pair records created due to race conditions during concurrent accept/reject operations
- **SC-006**: Request initiators receive notifications about acceptance/rejection within 10 seconds of the recipient's action
- **SC-007**: Accept/reject error scenarios display clear, actionable error messages that help users understand what went wrong and what to do next

## Assumptions

1. **Authentication**: Users are already authenticated when viewing the buddy status screen (authentication is handled by existing AuthProvider)
2. **Notification System**: The existing NotificationService infrastructure is functional and can deliver bot messages to users
3. **Single Pending Request**: Users can only have one pending buddy request at a time (enforced by existing BuddyService validation)
4. **Database Constraints**: The buddy_pairs table has appropriate indexes and constraints to prevent duplicate relationships
5. **UI Framework**: The Telegram UI component library (@telegram-apps/telegram-ui) provides Button and modal components needed for the interface
6. **API Pattern**: Accept/reject endpoints will follow the existing REST API pattern used by other buddy endpoints (/api/buddy/*)
7. **Status Transitions**: Only pending → active and pending → dissolved transitions are valid for accept/reject actions
8. **Bidirectional Notification**: Both users see updated status on their next app visit or screen refresh (no real-time WebSocket push)

## Out of Scope

- Canceling a sent buddy request (user who initiated cannot retract it after sending)
- Accepting multiple buddy requests simultaneously (app supports one buddy at a time)
- Expiration of buddy requests after a time period
- Blocking users from sending future requests
- In-app messaging or chat between potential buddies
- History or log of past rejected buddy requests
- Ability to accept a previously rejected request without sending a new request
