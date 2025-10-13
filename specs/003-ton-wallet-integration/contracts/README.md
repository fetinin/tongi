# API Contracts: TON Wallet Integration

This directory contains API contract specifications for the wallet integration endpoints.

## Files

### `wallet-api.yaml`
OpenAPI 3.0.3 specification for wallet management endpoints:
- `POST /api/wallet/connect` - Connect TON wallet to user account
- `POST /api/wallet/disconnect` - Disconnect TON wallet from user account
- `GET /api/wallet/status` - Get wallet connection status

## Usage

### Viewing the Specification
You can view the OpenAPI specification using:
- **Swagger Editor**: https://editor.swagger.io/ (paste the YAML content)
- **VS Code**: Use the "OpenAPI (Swagger) Editor" extension
- **Command line**: `npx @redocly/cli preview-docs wallet-api.yaml`

### Generating Code
You can generate client/server code from this specification:
```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i wallet-api.yaml \
  -g typescript-fetch \
  -o ./generated/client

# Generate API documentation
openapi-generator-cli generate \
  -i wallet-api.yaml \
  -g html2 \
  -o ./generated/docs
```

## Implementation Notes

### Authentication
All endpoints use Telegram initData for authentication:
- Client sends `initData` parameter (query string for GET, body for POST)
- Server validates HMAC signature using bot token
- Server middleware (`src/middleware/auth.ts`) handles validation
- Invalid authentication returns 401 Unauthorized

### Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_ADDRESS` | 400 | Wallet address format is invalid |
| `MISSING_WALLET` | 400 | Wallet address not provided |
| `AUTH_FAILED` | 401 | Telegram authentication failed |
| `USER_NOT_FOUND` | 404 | User does not exist in database |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INVALID_INITDATA` | 401 | initData parameter malformed |

### Response Format
All responses follow a consistent structure:
```typescript
// Success
{ success: true, ...data }

// Error
{ success: false, error: "message", code: "ERROR_CODE" }
```

## Validation Rules

### Wallet Address
- Must be valid TON address format (raw or user-friendly)
- Validated using `validateTonAddress()` from `src/lib/ton.ts`
- Normalized to user-friendly format before storage
- Cannot be empty string

### Telegram initData
- Must contain valid HMAC signature
- Must include user ID and other required fields
- Signature verified using bot token from environment
- Expires after 24 hours (Telegram default)

## Testing the API

### Manual Testing with curl

**Connect Wallet**:
```bash
curl -X POST https://127.0.0.1:3000/api/wallet/connect \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
    "initData": "query_id=AAHdF6IQ..."
  }'
```

**Disconnect Wallet**:
```bash
curl -X POST https://127.0.0.1:3000/api/wallet/disconnect \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "query_id=AAHdF6IQ..."
  }'
```

**Get Wallet Status**:
```bash
curl -X GET "https://127.0.0.1:3000/api/wallet/status?initData=query_id%3DAAHdF6IQ..."
```

### Integration Testing
See `tests/integration/wallet/` for automated integration tests that validate these contracts.

## References
- OpenAPI Specification: https://swagger.io/specification/
- TON Connect Protocol: https://docs.ton.org/develop/dapps/ton-connect/protocol
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
