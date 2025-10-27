# API Contracts

This directory contains the API contract specifications for the mobile-first onboarding flow feature.

## Files

- `onboarding-api.yaml` - OpenAPI 3.0 specification for all onboarding-related endpoints

## Usage

### Viewing the API Documentation

You can view the API documentation using any OpenAPI viewer:

**Online Viewers:**
- https://editor.swagger.io/ - Paste the YAML content
- https://redocly.github.io/redoc/ - Render documentation

**Local Viewers:**
```bash
# Using npx (no install required)
npx @redocly/cli preview-docs contracts/onboarding-api.yaml

# Or using swagger-ui
npx serve-swagger-ui contracts/onboarding-api.yaml
```

### Validating the API Specification

```bash
# Validate OpenAPI schema
npx @redocly/cli lint contracts/onboarding-api.yaml
```

## API Endpoints Summary

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onboarding/status` | Get user's current onboarding state (wallet + buddy) |
| DELETE | `/api/buddy/cancel` | Cancel pending buddy request |

### Modified Endpoints

| Method | Endpoint | Changes |
|--------|----------|---------|
| POST | `/api/wallet/connect` | Enhanced with automatic wallet unlinking logic |

### Existing Endpoints (Used)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/status` | Get wallet connection status |
| GET | `/api/buddy/status` | Get buddy relationship status |
| POST | `/api/buddy/request` | Send buddy request |
| GET | `/api/buddy/search` | Search for users to add as buddy |

## Authentication

All endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

JWT token is obtained from `/api/auth/validate` by validating Telegram initData.

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE"
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_FAILED` | 401 | Authentication token invalid or expired |
| `VALIDATION_ERROR` | 400 | Request validation failed (invalid input) |
| `NO_PENDING_REQUEST` | 400 | No pending buddy request found to cancel |
| `BUDDY_NOT_FOUND` | 404 | Buddy request/relationship not found |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `NETWORK_ERROR` | 500 | Network/connectivity issue (retryable) |

## Testing the API

### Example: First-Time User Onboarding Flow

```bash
# Step 1: Authenticate user (get JWT token)
curl -X POST http://localhost:3000/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "user=%7B%22id%22%3A123...&hash=abc123...",
    "tonWalletAddress": null
  }'

# Response: { "user": {...}, "token": "eyJhbGc...", "isNewUser": true }

# Step 2: Check onboarding status
curl -X GET http://localhost:3000/api/onboarding/status \
  -H "Authorization: Bearer eyJhbGc..."

# Response: { "success": true, "onboarding": { "current_step": "welcome", "wallet_connected": false, "buddy_confirmed": false } }

# Step 3: Connect wallet
curl -X POST http://localhost:3000/api/wallet/connect \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{ "address": "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2" }'

# Step 4: Check onboarding status again
curl -X GET http://localhost:3000/api/onboarding/status \
  -H "Authorization: Bearer eyJhbGc..."

# Response: { "success": true, "onboarding": { "current_step": "buddy", "wallet_connected": true, "buddy_confirmed": false }, "wallet": { "address": "EQ..." } }

# Step 5: Search for buddy
curl -X GET "http://localhost:3000/api/buddy/search?query=alice" \
  -H "Authorization: Bearer eyJhbGc..."

# Step 6: Send buddy request
curl -X POST http://localhost:3000/api/buddy/request \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{ "recipientId": 456 }'

# Step 7: Cancel buddy request (optional)
curl -X DELETE http://localhost:3000/api/buddy/cancel \
  -H "Authorization: Bearer eyJhbGc..."

# Step 8: Check onboarding status after buddy confirms
curl -X GET http://localhost:3000/api/onboarding/status \
  -H "Authorization: Bearer eyJhbGc..."

# Response: { "success": true, "onboarding": { "current_step": "complete", "wallet_connected": true, "buddy_confirmed": true }, "wallet": {...}, "buddy": {...} }
```

## Integration Testing

See [../../tests/integration/onboarding.test.ts](../../../tests/integration/onboarding.test.ts) for complete integration test examples that exercise these API endpoints.

## References

- Feature Specification: [../spec.md](../spec.md)
- Data Model: [../data-model.md](../data-model.md)
- Research: [../research.md](../research.md)
