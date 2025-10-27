# Feature Specification: Mobile-First Onboarding Flow

**Feature Branch**: `005-mobile-first-onboarding`
**Created**: 2025-10-26
**Status**: Draft
**Input**: User description: "Current UI needs to be reworked to be more intuitive and mobile-first.

1. Welcome screen.
After user is registered he must add his TON wallet first, before having accsses to other functionality. User must see text that ask to add wallet. No other options available.
After wallet is added, user must proceed to second screen -> add buddy.

Add buddy screen.
After wallet is added. All user can do is to add buddy.
User must see search and find and request buddy. While request is pending, user will only see pending request, search is hidden. If request is reject, search screen is avaiable again.
If request is accepted, user must see another layout of Main app navigation, described below.

2. Main app navigation.
App should have two menu buttons at the buttom. First with dog icon, second with settings gear icon.

Corgi sighttning. This is the screen that should open by default and by clicking on \"dog icon\".
Settings screen. This screen should contain other menus and functionality like remove/add wallet. Change buddy. Etc.

Ask questions if you need to clarify requerments."

## Clarifications

### Session 2025-10-26

- Q: What happens when a user who previously completed onboarding (wallet + buddy) returns to the app? → A: Full re-validation - verify both wallet and buddy status are still valid on every app open
- Q: When a buddy request is pending, should the user be able to cancel their pending request to search for a different buddy? → A: Allow cancellation - user can cancel pending request to search again
- Q: What specific settings options should be available beyond wallet and buddy management? → A: Only buddy management and wallet management (existing screens moved to settings)
- Q: How should the system handle network errors during re-validation check on app open? → A: Show error screen - display error message, require manual retry before allowing access
- Q: What should happen if a user attempts to connect a wallet that's already connected to another account in the system? → A: Allow connection - automatically unlink wallet from previous account and link to new account
- Q: When a user's wallet is automatically unlinked from their old account (because they connected it to a new account), should the old account user be notified? → A: No notification - silent unlinking, user discovers on next app open during re-validation
- Q: When displaying the pending buddy request status (after a user sends a request), what information should be shown to the user? → A: Minimal - just "Request Pending" text and cancel button

## User Scenarios & Testing

### User Story 1 - First-Time Wallet Connection (Priority: P1)

A new user opens the Telegram Mini App for the first time. They see a welcome screen that explains they must connect their TON wallet to continue. The screen displays clear instructions and a prominent call-to-action to connect their wallet. No other navigation options are available until the wallet is connected.

**Why this priority**: This is the foundational onboarding step. Without a connected wallet, users cannot participate in any Corgi Buddy features (rewards, transactions). This is the absolute minimum required to onboard a user.

**Independent Test**: Can be fully tested by registering a new user and verifying that only the wallet connection prompt is shown, with no access to other features. Delivers the value of securing user identity and payment capability.

**Acceptance Scenarios**:

1. **Given** a new user opens the app for the first time, **When** they view the welcome screen, **Then** they see a clear message asking them to connect their TON wallet and a button to initiate wallet connection
2. **Given** a new user is on the welcome screen, **When** they try to access other features, **Then** no navigation options or other features are accessible
3. **Given** a user successfully connects their wallet, **When** the connection is confirmed, **Then** they are automatically redirected to the Add Buddy screen

---

### User Story 2 - Buddy Request and Confirmation (Priority: P2)

After connecting their wallet, the user is directed to find and add a buddy. They can search for other users by username or Telegram handle. Once they send a buddy request, the search interface is hidden and replaced with a "pending request" status display. If the request is rejected, the search interface reappears. If accepted, the user gains access to the main app navigation.

**Why this priority**: The buddy system is core to the Corgi Buddy concept (mutual corgi sighting confirmations). This must be completed before users can participate in the main feature. However, it depends on wallet connection (P1).

**Independent Test**: Can be tested by creating a user with a connected wallet and verifying the search, request, pending, and acceptance/rejection flows work correctly. Delivers the value of establishing buddy relationships required for corgi sighting confirmations.

**Acceptance Scenarios**:

1. **Given** a user has connected their wallet, **When** they reach the Add Buddy screen, **Then** they see a search interface to find other users
2. **Given** a user is searching for a buddy, **When** they send a buddy request, **Then** the search interface is hidden and replaced with a minimal pending request status display showing only "Request Pending" text and a cancel button
3. **Given** a user has a pending buddy request, **When** they cancel the pending request, **Then** the search interface reappears allowing them to search for another buddy
4. **Given** a user has a pending buddy request, **When** the request is rejected, **Then** the search interface reappears allowing them to search for another buddy
5. **Given** a user has a pending buddy request, **When** the request is accepted, **Then** they are redirected to the main app with bottom navigation visible
6. **Given** a user is on the Add Buddy screen, **When** they try to access other features, **Then** no other navigation is available until a buddy is confirmed

---

### User Story 3 - Main App Navigation (Priority: P3)

Once a user has connected their wallet and has a confirmed buddy, they can access the main app features through a bottom navigation bar with two buttons: a dog icon (Corgi Sighting) and a settings gear icon (Settings). The Corgi Sighting screen is the default view and opens when clicking the dog icon. The Settings screen provides access to account management features like wallet management and buddy changes.

**Why this priority**: This enables the core app functionality after onboarding is complete. It depends on both P1 (wallet) and P2 (buddy) being completed first.

**Independent Test**: Can be tested by creating a fully onboarded user (wallet + buddy) and verifying navigation between Corgi Sighting and Settings screens works correctly. Delivers the value of accessing core features and account management.

**Acceptance Scenarios**:

1. **Given** a user has completed wallet connection and buddy confirmation, **When** they access the main app, **Then** they see a bottom navigation bar with two buttons: dog icon and settings gear icon
2. **Given** a user is on the main app, **When** they first land or click the dog icon, **Then** the Corgi Sighting screen is displayed as the active view
3. **Given** a user is on any main app screen, **When** they click the settings gear icon, **Then** the Settings screen is displayed
4. **Given** a user is on the Settings screen, **When** they view the options, **Then** they see exactly two options: wallet management and buddy management
5. **Given** a user is navigating between screens, **When** they switch views using the bottom navigation, **Then** the active screen indicator updates to reflect the current view
6. **Given** a returning user opens the app and network errors occur during re-validation, **When** the re-validation fails due to network issues, **Then** an error screen is displayed with a retry button and access is blocked until retry succeeds

---

### Edge Cases

- What happens when a user closes the app during wallet connection and returns later?
- What happens when a buddy request is cancelled by the requester? (Search interface reappears immediately for the requester; recipient notification handled by backend)
- What happens if a user's buddy relationship ends (unfriend) after they've accessed the main app? (Re-validation will detect this and redirect to Add Buddy screen)
- How does the system handle network errors during wallet connection or buddy request?
- How does the system handle network errors during re-validation on app open? (Display error screen with retry button, block access until successful retry)
- What happens when a user tries to send a buddy request to someone who already has a pending request with them?
- How does the app behave on very small mobile screens or different aspect ratios?
- What happens when a user's wallet gets disconnected while using the app? (Re-validation on next app open will detect this and redirect to Welcome screen)
- What happens when a user attempts to connect a wallet already associated with another account? (System automatically unlinks wallet from previous account and links to new account silently without notifying the old account; previous account user discovers wallet disconnection on next app open during re-validation)

## Requirements

### Functional Requirements

- **FR-001**: System MUST prevent access to all features except wallet connection for users who have not connected a TON wallet
- **FR-002**: System MUST automatically redirect users to the Add Buddy screen immediately after successful wallet connection
- **FR-003**: System MUST prevent access to all features except buddy search/request for users who have connected a wallet but do not have a confirmed buddy
- **FR-004**: System MUST display a search interface allowing users to find other users by username or Telegram handle
- **FR-005**: System MUST hide the search interface and display minimal pending request status ("Request Pending" text and cancel button only) when a buddy request is sent
- **FR-006**: System MUST provide a cancel button on the pending request status display allowing users to cancel their pending request
- **FR-007**: System MUST restore the search interface when a buddy request is cancelled or rejected
- **FR-008**: System MUST redirect users to the main app navigation when a buddy request is accepted
- **FR-009**: System MUST display a bottom navigation bar with exactly two buttons: dog icon (Corgi Sighting) and settings gear icon (Settings)
- **FR-010**: System MUST show the Corgi Sighting screen as the default view when users access the main app
- **FR-011**: System MUST allow users to switch between Corgi Sighting and Settings screens using the bottom navigation
- **FR-012**: Settings screen MUST provide exactly two options: wallet management (add/remove wallet) and buddy management (change buddy), reorganizing existing wallet and buddy screens into the settings area
- **FR-013**: System MUST persist onboarding progress (wallet connection status, buddy confirmation status) across app sessions
- **FR-014**: System MUST re-validate both wallet connection status and buddy confirmation status on every app open, directing users to the appropriate onboarding screen if either validation fails
- **FR-015**: System MUST display an error screen with retry button when network errors occur during re-validation, blocking access until manual retry succeeds
- **FR-016**: System MUST distinguish between validation failures (wallet disconnected, buddy removed) and network errors (connectivity issues) during re-validation
- **FR-017**: System MUST optimize all screens for mobile-first design with touch-friendly controls and appropriate sizing
- **FR-018**: System MUST provide clear visual feedback for all interactive elements (buttons, navigation)
- **FR-019**: System MUST display informative messages explaining why certain features are locked during onboarding steps
- **FR-020**: System MUST automatically unlink a wallet from its previous account and link it to the new account when a user attempts to connect a wallet that is already associated with another account, without sending any notification to the previous account holder

### Key Entities

- **User Onboarding State**: Tracks user progress through onboarding (wallet_connected: boolean, buddy_confirmed: boolean), re-validated on every app open to determine which screen to show (welcome/add buddy/main app)
- **Wallet Connection**: Links a TON wallet address to a user account; wallet addresses are unique across the system and automatically transfer from old account to new account upon reconnection
- **Buddy Request**: Represents a pending buddy relationship request (requester, recipient, status: pending/accepted/rejected/cancelled, timestamp)
- **Navigation State**: Current active screen in main app (corgi_sighting or settings), persisted for session continuity

## Success Criteria

### Measurable Outcomes

- **SC-001**: New users complete wallet connection within 2 minutes of opening the app for the first time
- **SC-002**: 90% of users who connect their wallet successfully proceed to send a buddy request within 3 minutes
- **SC-003**: Users can navigate between Corgi Sighting and Settings screens with single tap interactions
- **SC-004**: All onboarding screens are fully usable on mobile devices with screen widths as small as 320px
- **SC-005**: Users who close the app during onboarding can resume from their last completed step (not restart from beginning) when they return
- **SC-006**: Zero navigation confusion - users cannot accidentally access features they haven't unlocked through onboarding
- **SC-007**: Buddy request state changes (pending → accepted/rejected) reflect in the UI within 3 seconds of the state change occurring

## Assumptions

- Users understand what a TON wallet is and how to connect one (assumption: Telegram Mini App users are familiar with crypto wallets)
- The existing buddy search and request functionality works correctly and only needs UI/flow changes
- The existing Corgi Sighting features work correctly and only need navigation changes
- The existing wallet management and buddy management screens work correctly and only need to be reorganized into the Settings area
- Users will primarily access the app on mobile devices (Telegram's primary platform)
- Wallet connection uses the existing TON Connect integration without changes
- The app already has backend support for tracking onboarding state per user

## Out of Scope

- Changes to the actual Corgi Sighting feature functionality (only navigation changes)
- New settings features beyond wallet and buddy management (only reorganizing existing screens)
- Changes to existing wallet management or buddy management functionality
- Multi-buddy support (assumes one buddy per user as per current system)
- Wallet creation or wallet education content
- Desktop-specific optimizations (mobile-first focus)
- Onboarding tutorial or tooltips explaining features
- Animations or transitions between screens
- Buddy recommendation algorithms
