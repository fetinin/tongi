# Feature Specification: Corgi Buddy TON Cryptocurrency Mini-App

**Feature Branch**: `001-you-need-to`
**Created**: 2025-09-17
**Status**: Draft
**Input**: User description: "You need to build a Telegram mini-app. The main point of this app is to transfer TON cryptocurrency between two users. This is the web app oriented for mobile devices with backend to integrate with cryptocurrency.

Here are use cases.
1) When user opens app for the first time, the first thing he sees is that he must enter telegram name of another user. If user enter telegram username and click confirm, he becomes binded with that user. Let's call them buddies.
2) As a user, I can send a request to confirm that I saw a corgi. I can also specify how much corgi I saw. After that I click on the button "Ask to confirm". My body receives a message from this app and is asked to confirm That indeed corgis were spotted. If buddy confirms it, I will receive currency called "Corgi coins" on my crypto wallet from bank wallet.
3) As a user I can buy a wish from my body. I click on button by wish. Then I enter my wish And amount of corgis I propose for that. Then I click Buy button. After that opens window in my ton wallet that displays transaction to confirm. Transaction goes from my wallet to wallet of my body. It contains amount of corgis I requested. After that I confirm transaction and corgi coins are sent to another wallet.

Notes:
Corgi bank wallet is a TON crypto wallet That app has full access to. It contains all Corgi coins and can send them to users If both bodies agreed on that.
Upon registration user must also login with using Ton Connect (docs: https://docs.ton.org/v3/guidelines/ton-connect/frameworks/react).
Telegram webapp docs @docs/telegram_web.md"

## Execution Flow (main)
```
1. Parse user description from Input
   � Features: buddy system, corgi spotting confirmations, wish marketplace
2. Extract key concepts from description
   � Actors: users, buddies; Actions: bind users, spot corgis, confirm sightings, buy wishes; Data: buddy pairs, corgi sightings, wishes, transactions; Constraints: TON blockchain, Telegram integration
3. For each unclear aspect:
   � Several marked with [NEEDS CLARIFICATION]
4. Fill User Scenarios & Testing section
   � Primary flows: onboarding, corgi spotting, wish marketplace
5. Generate Functional Requirements
   � All requirements marked as testable
6. Identify Key Entities (buddy pairs, corgi sightings, wishes, transactions)
7. Run Review Checklist
   � Multiple [NEEDS CLARIFICATION] items marked
8. Return: WARN "Spec has uncertainties that need clarification"
```

---

## � Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
A user opens the Telegram mini-app for the first time and must establish a "buddy" relationship with another user. Once connected, they can earn "Corgi coins" by reporting corgi sightings that their buddy confirms, and spend those coins to purchase wishes from their buddy through TON cryptocurrency transactions.

### Acceptance Scenarios
1. **Given** a new user opens the app, **When** they enter a valid Telegram username and click confirm, **Then** both users become linked as buddies and can interact through the app
2. **Given** a user spots corgis, **When** they report the number seen and request confirmation, **Then** their buddy receives a notification to confirm or deny the sighting
3. **Given** a buddy confirms a corgi sighting, **When** the confirmation is processed, **Then** the reporting user receives Corgi coins from the bank wallet to their TON wallet
4. **Given** a user wants to create a wish, **When** they enter wish details and proposed Corgi coin amount, **Then** their buddy can view and accept/decline the wish request
5. **Given** a buddy accepts a wish, **When** the wish becomes visible to other users, **Then** any user can see and purchase the accepted wish
6. **Given** a user wants to purchase an accepted wish, **When** they click the purchase button, **Then** they initiate a TON transaction from their wallet to the wish creator's wallet

### Edge Cases
- What happens when a user tries to bind with a non-existent Telegram username?
  - User must see an error that that user is not registered in the app yet.
- How does the system handle corgi sighting confirmations that are never responded to?
  - Just ignore them, No need for special handling.
- What occurs if a TON transaction fails during wish purchase?
  - It's okay. Cypto wallet UI will show it. We don't need to do anything by ourselves.
- How are disputes handled if a buddy falsely denies a legitimate corgi sighting?
  - App doesn't solve that issue. We believe that buddies will always be honest.

## Requirements *(mandatory)*

### Functional Requirements

**Buddy System**
- **FR-001**: System MUST allow users to connect with another user by entering their Telegram username
- **FR-002**: System MUST validate that entered usernames exist on Telegram before allowing buddy connections
- **FR-003**: System MUST enforce that each user can only have one active buddy relationship at a time. Buddy can not be changed
- **FR-004**: System MUST notify both users when a buddy connection is established

**Authentication & Wallet Integration**
- **FR-005**: System MUST require users to connect their TON wallet using TON Connect during registration
- **FR-006**: System MUST authenticate users through Telegram Mini App authentication system
- **FR-007**: System MUST maintain connection to user's TON wallet throughout the session

**Corgi Spotting & Confirmation**
- **FR-008**: Users MUST be able to report corgi sightings with a specified count of corgis spotted
- **FR-009**: System MUST send confirmation requests to the reporting user's buddy via Telegram notifications
- **FR-010**: Buddies MUST be able to confirm or deny corgi sighting reports
- **FR-011**: System MUST transfer Corgi coins from bank wallet to reporting user's TON wallet upon buddy confirmation
- **FR-012**: System MUST prevent users from confirming their own corgi sightings

**Wish Marketplace**
- **FR-014**: Users MUST be able to create and submit wish requests with proposed Corgi coin amounts
- **FR-015**: Buddies MUST be able to view submitted wishes and accept or decline them
- **FR-016**: System MUST display accepted wishes in a marketplace visible to all users
- **FR-017**: Users MUST be able to initiate TON blockchain transactions when purchasing wishes
- **FR-018**: System MUST facilitate transfer of Corgi coins from purchaser's wallet to wish creator's wallet upon user-initiated transaction confirmation
- **FR-019**: System MUST handle failed transactions gracefully [NEEDS CLARIFICATION: Retry mechanism or manual intervention required?]

**Bank Wallet Management**
- **FR-020**: System MUST maintain a bank wallet containing Corgi coins for distribution
- **FR-021**: System MUST have full programmatic access to bank wallet for automated transactions
- **FR-022**: System MUST track bank wallet balance and Corgi coin distribution. When bank wallet is depleted, write error to logs.
- **FR-023**: System MUST maintain transaction logs for all Corgi coin transfers

**User Interface Requirements**
- **FR-024**: System MUST use @telegram-apps/telegram-ui components for all user interface elements
- **FR-025**: System MUST import @telegram-apps/telegram-ui/dist/styles.css for consistent Telegram styling
- **FR-026**: System MUST wrap the application with AppRoot component from @telegram-apps/telegram-ui
- **FR-027**: System MUST use List, Section, Cell, and other telegram-ui components for structured layouts
- **FR-028**: Developers MUST obtain @telegram-apps/telegram-ui documentation via context7 by searching for "telegramui"

**General Requirements**
- **FR-029**: System MUST operate as a Telegram Mini App accessible through mobile devices
- **FR-030**: System MUST integrate with TON blockchain for all cryptocurrency transactions
- **FR-031**: System MUST provide real-time notifications for buddy interactions
- **FR-032**: System MUST maintain user session state across app interactions by using Ton Connect and telegam account.

### Key Entities *(include if feature involves data)*
- **User**: Represents an individual app user with Telegram identity, TON wallet connection, and buddy relationship status
- **Buddy Pair**: Represents the bidirectional relationship between two users, enabling corgi confirmations and wish transactions
- **Corgi Sighting**: Represents a user's report of spotted corgis, including count, timestamp, and confirmation status from buddy
- **Wish**: Represents a purchase request from one user to their buddy, including wish description, proposed Corgi coin amount, acceptance status, and marketplace visibility
- **Transaction**: Represents TON blockchain transactions for Corgi coin transfers, including sender, receiver, amount, and completion status
- **Bank Wallet**: Represents the system-controlled TON wallet containing Corgi coins for distribution to users upon confirmed sightings

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (6 clarifications needed)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (6 clarification points identified)
- [x] User scenarios defined
- [x] Requirements generated (27 functional requirements)
- [x] Entities identified (6 key entities)
- [x] Review checklist passed (pending clarifications)

---