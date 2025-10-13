# Feature Specification: TON Wallet Integration

**Feature Branch**: `003-ton-wallet-integration`
**Created**: 2025-10-13
**Status**: Draft
**Input**: User description: "Ton wallet integration. Add integration with Ton wallet through Ton connect library. @docs/ton-connect.md
There should be a way for a user to connect his TON wallet. We need to know and store his wallet address so we can transfer Corgi coins to it.
User should be able to connect and disconnect its wallet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect TON Wallet (Priority: P1)

A user wants to connect their TON wallet to the Tongi app so they can receive Corgi coin rewards. They open the wallet settings and initiate wallet connection through TON Connect, select their wallet app, and authorize the connection. Their wallet address is now linked to their account.

**Why this priority**: This is the foundational capability - without connecting a wallet, users cannot receive Corgi coins. This delivers immediate value by establishing the payment infrastructure.

**Independent Test**: Can be fully tested by having a user navigate to wallet settings, click connect, complete the TON Connect flow, and verify their address appears in the UI. Delivers value by enabling the entire reward economy.

**Acceptance Scenarios**:

1. **Given** user is logged into Tongi app, **When** user navigates to wallet settings and clicks "Connect Wallet", **Then** TON Connect modal opens with available wallet options
2. **Given** TON Connect modal is open, **When** user selects a wallet (e.g., Tonkeeper, MyTonWallet), **Then** wallet app opens with connection request
3. **Given** wallet app shows connection request, **When** user approves connection, **Then** user is returned to Tongi app with wallet connected
4. **Given** wallet is connected, **When** user views wallet settings, **Then** their user-friendly wallet address is displayed
5. **Given** wallet connection succeeds, **When** system stores wallet address, **Then** address is persisted to user profile for future transactions

---

### User Story 2 - Disconnect TON Wallet (Priority: P2)

A user wants to disconnect their currently connected wallet, either to switch to a different wallet or for security reasons. They access wallet settings and disconnect, removing the link between their account and wallet address.

**Why this priority**: This is essential for security and user control but less critical than initial connection. Users must be able to revoke wallet access.

**Independent Test**: Can be fully tested by connecting a wallet, clicking disconnect, and verifying the wallet address is removed from the UI and session. Delivers value by giving users control over their connected accounts.

**Acceptance Scenarios**:

1. **Given** user has a connected wallet, **When** user navigates to wallet settings, **Then** wallet address and "Disconnect" button are visible
2. **Given** user sees disconnect option, **When** user clicks "Disconnect Wallet", **Then** confirmation dialog appears asking "Are you sure?"
3. **Given** confirmation dialog is shown, **When** user confirms disconnection, **Then** wallet is disconnected and TON Connect session ends
4. **Given** wallet is disconnected, **When** user views wallet settings, **Then** wallet address is no longer displayed and "Connect Wallet" button appears
5. **Given** wallet is disconnected, **When** system updates user profile, **Then** wallet address is removed from user record

---

### User Story 3 - View Connected Wallet Status (Priority: P3)

A user wants to verify which wallet is currently connected to their account and view their wallet address. They can access wallet settings at any time to see connection status and copy their address if needed.

**Why this priority**: This is a supporting feature that enhances usability but isn't required for core functionality. Users can proceed with transactions without constantly checking their wallet status.

**Independent Test**: Can be fully tested by connecting a wallet and navigating to various parts of the app to verify wallet status is consistently displayed. Delivers value by providing transparency and confidence in the connection.

**Acceptance Scenarios**:

1. **Given** user has connected wallet, **When** user opens wallet settings, **Then** wallet address is displayed (provider name from TON Connect client-side, if available)
2. **Given** wallet address is displayed, **When** user clicks copy icon, **Then** address is copied to clipboard with success notification
3. **Given** user navigates away from wallet settings, **When** user returns to wallet settings, **Then** wallet connection persists indefinitely across sessions
4. **Given** wallet connection exists, **When** user returns after extended absence, **Then** wallet remains connected without re-authentication required

---

### Edge Cases

- When user's wallet app is not installed, TON Connect displays QR code for connection via desktop wallet apps
- How does system handle TON Connect modal being closed without completing connection?
- When network connectivity is lost during wallet connection, system displays error message and requires user to restart connection flow
- How does system handle wallet address changes (user switches wallets in their app)?
- When user initiates connection to second wallet while first is connected, system automatically disconnects first wallet and connects second wallet
- How does system handle invalid or malformed wallet addresses?
- What happens when TON Connect library fails to load or initialize?
- How does system behave in Telegram Mini App context vs standalone web?
- What happens when user revokes permissions from wallet app side?

## Clarifications

### Session 2025-10-13

- Q: How long should a wallet connection session remain valid before requiring re-authentication? → A: Never expire - connection persists until user explicitly disconnects
- Q: What should happen when a user's wallet app is not installed on their device? → A: Allow connection via QR code for desktop wallet apps
- Q: What should happen when a user tries to connect a second wallet while the first is still connected? → A: Automatically disconnect first wallet and connect second wallet
- Q: What should happen when network connectivity is lost during wallet connection? → A: Show error message and require user to restart connection flow

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST integrate TON Connect UI React SDK for wallet connections
- **FR-002**: System MUST provide visible UI control for users to initiate wallet connection
- **FR-003**: System MUST display available wallet options through TON Connect modal, including QR code for desktop wallet connections when mobile apps unavailable
- **FR-004**: System MUST handle wallet connection authorization flow and callbacks
- **FR-005**: System MUST store connected wallet address in user profile database
- **FR-006**: System MUST display user-friendly wallet address format (not raw format) in UI
- **FR-007**: System MUST provide UI control for users to disconnect wallet
- **FR-008**: System MUST show confirmation dialog before disconnecting wallet
- **FR-009**: System MUST remove wallet address from user profile when disconnected
- **FR-010**: System MUST terminate TON Connect session when wallet disconnects
- **FR-011**: System MUST indicate wallet connection status in wallet settings area
- **FR-012**: System MUST allow users to copy their wallet address to clipboard
- **FR-013**: System MUST persist wallet connection indefinitely across user sessions (no expiry timeout)
- **FR-014**: System MUST restore wallet connection automatically on app reload without re-authentication
- **FR-015**: System MUST validate wallet addresses before storing them
- **FR-016**: System MUST enforce one wallet per user by automatically disconnecting existing wallet when user connects a new wallet
- **FR-017**: System MUST handle wallet connection errors gracefully with user-friendly messages, including network failures that require user to restart connection flow
- **FR-018**: System MUST work within Telegram Mini App environment with proper redirect configuration
- **FR-019**: System MUST provide manifest file for TON Connect at publicly accessible URL
- **FR-020**: System MUST handle wallet disconnection initiated from wallet app side

### Key Entities

- **User Wallet Connection**: Links Telegram user to TON blockchain wallet address. Stored in existing `users` table via the `ton_wallet_address` column (TEXT, nullable). A NULL `ton_wallet_address` indicates no wallet connected. TON Connect SDK guarantees addresses are valid and properly formatted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can connect a TON wallet in under 30 seconds from initiating connection to seeing confirmation
- **SC-002**: 95% of wallet connection attempts complete successfully without errors
- **SC-003**: Wallet addresses persist correctly across 100% of app sessions and reloads
- **SC-004**: Users can disconnect and reconnect wallets without data loss or errors
- **SC-005**: Zero private keys or sensitive wallet data stored on Tongi servers (all handled by TON Connect)
- **SC-006**: Wallet connection works in both Telegram Mini App and standalone web contexts
- **SC-007**: 90% of users successfully complete wallet connection on first attempt without support

## Assumptions

- Users have access to at least one TON-compatible wallet app (Tonkeeper, MyTonWallet, etc.)
- TON Connect library handles all cryptographic operations and private key management
- Wallet address is sufficient identifier for receiving Corgi coin transfers (no additional metadata needed)
- One wallet per user is sufficient (users don't need multiple wallets connected simultaneously)
- Telegram Mini App context supports TON Connect redirects and callbacks
- Users understand basic wallet concepts and have created wallets independently
- TON Connect manifest can be hosted on same domain as Tongi app
- Standard web session management is sufficient for connection persistence (no blockchain state required)
- Wallet connection does not require ton_proof verification initially (can be added later for enhanced security)

## Scope

### In Scope

- TON Connect UI React SDK integration
- Wallet connection and disconnection UI flows
- Wallet address storage and retrieval
- Connection status display and management
- TON Connect session management
- Basic error handling for connection failures
- Manifest file creation and hosting
- Telegram Mini App redirect configuration

### Out of Scope

- Actual Corgi coin token creation or smart contract deployment
- Transaction sending or balance checking (covered in separate feature)
- ton_proof verification for enhanced authentication (can be added later)
- Multi-wallet support (connecting multiple wallets to one account)
- Wallet-based authentication (login via wallet instead of Telegram)
- Wallet address validation beyond format checking
- Integration with specific wallet apps' advanced features
- Blockchain state synchronization or monitoring
