# Feature Specification: Complete Corgi Reward Distribution System

**Feature Branch**: `004-receive-reward-when`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "Receive reward. When buddy confirms that corgi was spotted. User that found corgi must receive corgi coins on their TON wallet from bank TON wallet. This functionality is not fully implemented and needs to be finished."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Successful Reward Distribution (Priority: P1)

A user reports a corgi sighting, their buddy confirms the sighting, and the system initiates a corgi coin transfer from the bank wallet to the user's connected TON wallet.

**Why this priority**: This is the core value proposition of the reward system. Without this working, users have no incentive to report sightings and the entire gamification mechanic fails.

**Independent Test**: Can be fully tested by creating a test user with a connected TON wallet, having them report a sighting, getting buddy confirmation, and verifying the transaction is created, signed, and broadcast to the blockchain. Delivers the complete happy-path reward experience.

**Acceptance Scenarios**:

1. **Given** a user has reported a corgi sighting and has a connected TON wallet, **When** their buddy confirms the sighting, **Then** the system creates a transaction record and broadcasts it to the TON blockchain
2. **Given** a user has multiple confirmed sightings, **When** checking their transaction history, **Then** all reward transactions are visible with blockchain hashes and sighting references
3. **Given** a user with 1 corgi in their sighting, **When** confirmed by buddy, **Then** a transaction for 1 Corgi coin Jetton is created
4. **Given** a user with 3 corgis in their sighting, **When** confirmed by buddy, **Then** a transaction for 3 Corgi coin Jettons is created
5. **Given** a user with 7 corgis in their sighting, **When** confirmed by buddy, **Then** a transaction for 7 Corgi coin Jettons is created

---

### User Story 2 - Transaction Transparency and Verification (Priority: P2)

Users can view the status and details of their reward transactions, including pending, completed, and failed states.

**Why this priority**: Transaction transparency builds trust in the system. Users need to understand when rewards are processing versus actually received. This is essential for user confidence but doesn't block the core reward flow.

**Independent Test**: Can be tested by creating transactions in various states (pending, completed, failed) and verifying that users can view transaction details, blockchain hashes, and timestamps through the transaction history interface.

**Acceptance Scenarios**:

1. **Given** a user has received rewards, **When** they view their transaction history, **Then** they see all reward transactions with amounts, dates, and blockchain confirmation links
2. **Given** a reward transaction is processing on the blockchain, **When** the user checks the transaction status, **Then** they see a "processing" status with the blockchain transaction hash for verification
3. **Given** a reward transaction has been confirmed on the blockchain, **When** the user views the transaction, **Then** they see the blockchain transaction hash and can verify it on a TON blockchain explorer
4. **Given** a reward transaction failed, **When** the user views the transaction, **Then** they see a clear error message explaining why and what action (if any) they should take

---

### User Story 3 - Graceful Handling of Missing Wallet (Priority: P2)

When a buddy confirms a sighting for a user who hasn't connected their TON wallet yet, the system notifies the user and holds the reward until they connect a wallet.

**Why this priority**: This prevents user frustration and lost rewards. Users shouldn't lose rewards just because they haven't set up their wallet yet. However, this is a secondary concern to getting the primary distribution working.

**Independent Test**: Can be tested by having a user without a connected wallet get a confirmed sighting, verifying they receive a notification about pending rewards, then connecting a wallet and confirming the pending reward transaction is created and broadcast.

**Acceptance Scenarios**:

1. **Given** a user without a connected TON wallet has a sighting confirmed, **When** the confirmation occurs, **Then** the system records a pending reward and notifies the user to connect their wallet
2. **Given** a user has pending rewards, **When** they connect their TON wallet, **Then** all pending rewards are automatically processed and transactions are broadcast to the blockchain
3. **Given** a user has multiple pending rewards from different sightings, **When** they connect their wallet, **Then** they receive all pending rewards as separate transactions with proper references
4. **Given** a user with pending rewards, **When** viewing their profile, **Then** they see a prominent notification showing total pending reward amount and a call-to-action to connect their wallet

---

### User Story 4 - Bank Wallet Monitoring and Safety (Priority: P3)

System administrators can monitor the bank wallet balance and receive alerts when it falls below safe operating thresholds to prevent reward distribution failures.

**Why this priority**: This is operational infrastructure for sustainability. While important for long-term operation, the system can launch with manual balance monitoring. This prevents service interruptions but doesn't block initial functionality.

**Independent Test**: Can be tested by simulating low bank wallet balance scenarios and verifying that administrators receive alerts and that the system prevents rewards when balance is insufficient, showing appropriate messages to users.

**Acceptance Scenarios**:

1. **Given** the bank wallet balance falls below a configured threshold, **When** the system checks balance, **Then** administrators receive an alert to refill the bank wallet
2. **Given** the bank wallet has insufficient balance for a reward, **When** a buddy tries to confirm a sighting, **Then** the confirmation is recorded but the reward is marked as "pending funding" and administrators are alerted
3. **Given** rewards are marked as "pending funding", **When** the bank wallet is refilled, **Then** all pending rewards are automatically processed and transactions are broadcast
4. **Given** administrators are viewing bank wallet status, **When** they access the dashboard, **Then** they see current balance, recent transaction history, and total pending rewards

---

### Edge Cases

- What happens when a blockchain transaction broadcast fails due to network issues? → System records the failure, keeps the reward in pending state, and automatically retries up to 3 times with exponential backoff
- What happens when a user disconnects their wallet after receiving a reward? → Past rewards remain recorded in transaction history; future rewards will require reconnecting a wallet
- What happens when a user changes their connected wallet address? → New rewards go to the new address; past transaction history shows which wallet address received each reward
- What happens when the same sighting is confirmed multiple times by different buddies? → System only processes the first confirmation; subsequent confirmations are ignored with no additional reward
- What happens when a transaction is successfully broadcast but the database update fails? → System logs the orphaned transaction; a reconciliation process identifies and resolves the mismatch
- What happens when the bank wallet private key is compromised? → Manual incident response procedure is followed: system operation is paused, new bank wallet is created with new key, remaining balance is migrated to new wallet, and system is reconfigured with new credentials; this is an operational procedure outside system scope

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST sign and broadcast blockchain transactions from the bank wallet using the bank wallet private key when rewards are distributed
- **FR-002**: System MUST calculate reward amount based on confirmed corgi count using 1-to-1 mapping (1 corgi = 1 Corgi coin Jetton, 2 corgis = 2 Corgi coin Jettons, etc.) and MUST reject sightings with 0 corgis
- **FR-003**: System MUST create a transaction record in the database when a buddy confirms a corgi sighting, linking the transaction to the sighting and including recipient wallet address and reward amount
- **FR-004**: System MUST validate that the reporter has a connected TON wallet address before attempting blockchain transaction
- **FR-005**: System MUST transfer Corgi coin Jettons from the bank wallet to the reporter's TON wallet on the blockchain when confirmation occurs
- **FR-006**: System MUST store the blockchain transaction hash in the transaction record once the blockchain transaction is broadcast
- **FR-007**: System MUST track transaction status states: pending, processing, completed, failed
- **FR-008**: System MUST handle users without connected wallets by recording pending rewards and notifying them to connect a wallet
- **FR-009**: System MUST automatically process all pending rewards when a user connects their TON wallet
- **FR-010**: System MUST prevent duplicate rewards for the same sighting confirmation
- **FR-011**: System MUST verify sufficient bank wallet balance before attempting to create a reward transaction
- **FR-012**: System MUST retry failed blockchain transaction broadcasts automatically (up to 3 attempts with exponential backoff)
- **FR-013**: System MUST provide transaction history showing all rewards with amounts, timestamps, blockchain hashes, and sighting references
- **FR-014**: System MUST log all bank wallet operations (transaction creation, signing, broadcasting) for audit purposes
- **FR-015**: System MUST never expose the bank wallet private key in logs, API responses, or client-side code
- **FR-016**: System MUST validate all Telegram authentication data server-side before processing any reward confirmation
- **FR-017**: System MUST update transaction status to "completed" only after receiving blockchain confirmation
- **FR-018**: System MUST alert administrators when bank wallet balance falls below operational threshold
- **FR-019**: System MUST handle blockchain network errors gracefully and provide clear status information to users
- **FR-020**: System MUST monitor broadcast transactions and update their status based on blockchain confirmation

### Key Entities

- **CorgiCoin**: A Jetton token (TON's TEP-74 token standard) representing reward currency for confirmed corgi sightings; implements standard Jetton transfer protocol with opcode 0xf8a7ea5
- **Transaction**: Represents a Corgi coin Jetton transfer between wallets, including amount, sender (bank), recipient (user), blockchain transaction hash, status (pending/processing/completed/failed), creation timestamp, completion timestamp, and link to originating corgi sighting
- **BankWallet**: System-controlled TON wallet that distributes Corgi coin Jetton rewards, including wallet address, current balance (both TON for gas and Jettons for rewards), and operational status
- **CorgiSighting**: Existing entity that now triggers reward distribution when confirmed by buddy, containing reporter reference, buddy reference, corgi count, confirmation status, and confirmation timestamp
- **User**: Existing entity that now includes connection to reward transactions via their TON wallet address
- **PendingReward**: Tracks rewards awaiting wallet connection, including user reference, amount, originating sighting, creation timestamp, and resolution status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System successfully creates and broadcasts reward transactions to the blockchain for all confirmed sightings where users have connected wallets
- **SC-002**: Transaction records accurately reflect blockchain transaction hashes and status for 100% of broadcast transactions
- **SC-003**: Users can view complete transaction history including blockchain verification links for all their rewards
- **SC-004**: Zero duplicate rewards are distributed for the same sighting confirmation
- **SC-005**: Users without connected wallets are successfully notified about pending rewards and can view pending reward amounts
- **SC-006**: Pending rewards are automatically processed when users connect their wallets
- **SC-007**: Failed transaction broadcasts are automatically retried according to retry policy
- **SC-008**: Bank wallet operations are logged with 100% completeness for audit trail
- **SC-009**: System prevents reward distribution attempts when bank wallet has insufficient balance
- **SC-010**: Transaction status updates accurately reflect blockchain confirmation state

## Assumptions *(optional)*

- Bank wallet will maintain sufficient balance for ongoing operations (administrative responsibility)
- TON blockchain network is operational and accessible (standard third-party dependency)
- Users understand that blockchain transactions may take time to confirm depending on network conditions
- Transaction fees (gas) for reward distribution are covered by bank wallet (cost of operations)
- One TON wallet address per user (users can change wallet but only one active at a time)
- Reward amounts are small enough that blockchain transaction fees are negligible relative to reward value
- Testing will occur on TON testnet before production deployment
- Bank wallet private key is securely stored in environment variables with appropriate access controls
- System will initially handle 1,000-10,000 users as per project scale goals
- Blockchain confirmation time is outside system control and depends on TON network conditions

## Dependencies *(optional)*

- TON blockchain network availability and stability
- TON SDK integration for server-side transaction signing and broadcasting
- Existing user authentication system (Telegram validation)
- Existing buddy confirmation system and corgi sighting database
- Existing TON Connect integration for user wallet connections
- Bank wallet must be provisioned and funded before feature deployment
- Database schema must support transaction status tracking and pending reward records

## Out of Scope *(optional)*

- Refunds or reward reversals (sighting confirmations are final)
- Variable reward rates based on time of day, location, or user level
- Reward distribution for retroactively confirmed sightings (only new confirmations after deployment)
- Multi-currency support (only Corgi coin Jettons on TON blockchain)
- Hardware wallet integration for bank wallet (uses private key in environment variables)
- Real-time blockchain explorer integration within app (users can use external block explorers)
- Automated bank wallet refilling from external sources
- Reward distribution via methods other than direct blockchain transfer
- Guarantees about blockchain confirmation time (depends on TON network)

## Security & Privacy Considerations *(optional)*

- **Private Key Security**: Bank wallet private key must never be logged, exposed in API responses, or accessible to client-side code; stored only in secure environment variables
- **Authentication**: All reward confirmation requests must validate Telegram initData server-side using HMAC validation
- **Authorization**: Only designated buddies can trigger reward distribution for their paired user's sightings
- **Audit Trail**: All bank wallet operations must be logged with timestamps, transaction details, and outcomes for security auditing
- **Rate Limiting**: Confirmation endpoint should implement rate limiting to prevent transaction spam attacks
- **Balance Monitoring**: System must monitor bank wallet balance to detect unauthorized withdrawals or unusual activity
- **Transaction Validation**: All outbound transactions must be validated for correct recipient address format and reasonable reward amounts before signing
- **Error Handling**: Error messages must not expose sensitive information about bank wallet state or private key operations
- **Incident Response**: Compromised bank wallet key requires manual incident response procedure (out of system scope); automated key rotation is not included in this feature
