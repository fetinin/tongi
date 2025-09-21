# Research: Corgi Buddy TON Cryptocurrency Mini-App

## Technical Decisions Summary

### **Authentication & Session Management**
- **Decision**: Use Telegram's seamless authentication with server-side validation
- **Rationale**: Telegram provides user identity (`ID`, `username`, `first_name`) automatically; secure validation prevents tampering
- **Alternatives considered**: Custom auth rejected due to friction; TON wallet auth alone rejected due to lack of Telegram username access

### **User Data Persistence**
- **Decision**: Three-tier storage strategy
  - `SecureStorage`: Authentication tokens, sensitive data (10 items limit)
  - `DeviceStorage`: User preferences, app state (5MB limit)
  - `CloudStorage`: Buddy relationships, transaction history (1024 items)
- **Rationale**: Matches data sensitivity levels; SecureStorage prevents token theft; CloudStorage enables cross-device continuity
- **Alternatives considered**: Single storage tier rejected due to security concerns; external database rejected for initial scope

### **Real-time Notifications**
- **Decision**: Bot-mediated communication via `sendData()` and Bot API
- **Rationale**: Mini Apps cannot directly message users; bot acts as relay for buddy confirmations
- **Alternatives considered**: WebSockets rejected (not supported in Mini Apps); polling rejected (poor UX for confirmations)

### **TON Blockchain Integration**
- **Decision**: TON Connect SDK with user-initiated transactions
- **Rationale**: Official SDK handles wallet connection securely; user controls all cryptocurrency transactions
- **Alternatives considered**: Custom wallet integration rejected (complex, insecure); server-side transactions rejected (regulatory/security issues)

### **Database Schema**
- **Decision**: SQLite with Next.js API routes
- **Rationale**: Simple deployment; adequate for initial scale (1k-10k users); familiar ORM patterns
- **Alternatives considered**: PostgreSQL rejected (over-engineering for scale); Firebase rejected (vendor lock-in concerns)

### **User Interface Components**
- **Decision**: @telegram-apps/telegram-ui for all UI components
- **Rationale**: Provides native Telegram Mini App styling; ensures consistency with Telegram design system; includes AppRoot, List, Section, Cell components
- **Alternatives considered**: Custom UI rejected (inconsistent styling); Material-UI rejected (not Telegram-native); Chakra UI rejected (wrong design language)
- **Documentation**: Developers MUST use context7 to search for "telegramui" to get up-to-date component documentation

### **State Management**
- **Decision**: React state + Telegram storage APIs
- **Rationale**: Leverages Telegram's built-in persistence; React handles UI state reactively
- **Alternatives considered**: Redux rejected (overkill for app size); Context API rejected (storage synchronization complex)

## Architecture Patterns

### **Component Structure**
```
src/
├── components/
│   ├── buddy/           # Buddy components using telegram-ui List/Cell
│   ├── corgi/           # Corgi components using telegram-ui Section/Cell
│   ├── wish/            # Wish components using telegram-ui List/Section
│   └── wallet/          # TON Connect with telegram-ui styling
├── app/
│   ├── layout.tsx       # Must import @telegram-apps/telegram-ui/dist/styles.css
│   ├── page.tsx         # Must use AppRoot wrapper from telegram-ui
│   └── api/
│       ├── buddy/       # Buddy relationship endpoints
│       ├── corgi/       # Corgi sighting endpoints
│       ├── wish/        # Wish marketplace endpoints
│       └── wallet/      # Bank wallet operations
└── core/
    ├── telegram/        # Telegram SDK utilities
    ├── ton/             # TON Connect utilities
    └── database/        # SQLite schema and queries
```

### **Data Flow Pattern**
1. User action in React component
2. API call to Next.js route handler
3. Database operation + Telegram bot notification (if needed)
4. Response back to component
5. UI update + storage sync

### **Security Pattern**
- All `initData` validated server-side using HMAC-SHA-256
- No private keys stored; TON Connect handles wallet security
- Bank wallet private key in secure environment variables
- Buddy confirmations verified through bot communication

## Integration Requirements

### **Telegram Mini Apps SDK**
- Initialize with `@telegram-apps/sdk-react`
- Use `@telegram-apps/telegram-ui` for all UI components
- Import `@telegram-apps/telegram-ui/dist/styles.css` globally
- Wrap app with AppRoot component from telegram-ui
- Use List, Section, Cell, Placeholder components from telegram-ui
- Handle viewport changes for mobile responsiveness
- Implement theme binding for light/dark modes (telegram-ui provides built-in theme support)
- Mock environment for development/testing
- Get telegram-ui documentation via context7 by searching "telegramui"

### **TON Connect Integration**
- User wallet connection via `@tonconnect/ui-react`
- Transaction initiation for wish purchases
- Bank wallet operations for Corgi coin distribution
- Error handling for failed transactions

### **Mobile Optimization**
- Use `viewportStableHeight` for layout calculations
- Respect safe area insets for modern devices
- Implement haptic feedback for confirmations
- Optimize for 3G network conditions

## Testing Strategy

### **Development Environment**
- HTTPS development server required for Telegram testing
- Mock Telegram environment for standalone development
- Bot backend simulator for notification testing

### **Test Levels**
1. **Unit**: Component logic, utility functions
2. **Integration**: API endpoints, database operations
3. **Contract**: Telegram SDK integration, TON Connect flows
4. **End-to-End**: Full user journeys in Telegram environment

### **Test Data**
- Mock user profiles with various buddy states
- Simulated TON transactions and wallet states
- Bot message scenarios for confirmations

## Performance Considerations

### **Loading Optimization**
- Target <3s initial load in Telegram environment
- Lazy load wish marketplace and transaction history
- Optimize bundle size for mobile networks

### **Real-time Responsiveness**
- Cache buddy status for instant UI feedback
- Optimistic updates for corgi sighting submissions
- Background sync for cross-device consistency

### **Scalability Boundaries**
- SQLite appropriate for 1k-10k users
- Bot API rate limits handled gracefully
- Migration path to PostgreSQL documented for growth

## Risk Mitigation

### **Telegram Platform Dependencies**
- Mock environment enables standalone development
- Feature flags for Telegram-specific functionality
- Graceful degradation for unsupported features

### **TON Blockchain Reliability**
- User controls all transactions (no system risk)
- Bank wallet operations logged for audit
- Failed transaction states handled gracefully

### **User Experience**
- Offline-capable with local storage
- Clear error messages for crypto operations
- Progressive disclosure of advanced features