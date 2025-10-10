# API Contracts: Buddy Request Accept/Reject

This directory contains OpenAPI 3.0 specifications for the buddy request accept/reject endpoints.

## Files

- **api-accept.yaml** - OpenAPI spec for `POST /api/buddy/accept`
- **api-reject.yaml** - OpenAPI spec for `POST /api/buddy/reject`

## Endpoints Overview

### POST /api/buddy/accept

Allows the recipient of a buddy request to accept it.

**Request**:
```json
{
  "initData": "query_id=AAH...",
  "buddyPairId": 42
}
```

**Response (200)**:
```json
{
  "id": 42,
  "buddy": {
    "id": 123456789,
    "telegramUsername": "johndoe",
    "firstName": "John",
    "tonWalletAddress": "EQD...",
    "createdAt": "2025-10-01T12:00:00.000Z"
  },
  "status": "active",
  "createdAt": "2025-10-08T14:30:00.000Z",
  "confirmedAt": "2025-10-09T10:15:30.000Z",
  "initiatedBy": 123456789
}
```

---

### POST /api/buddy/reject

Allows the recipient of a buddy request to reject it.

**Request**:
```json
{
  "initData": "query_id=AAH...",
  "buddyPairId": 42
}
```

**Response (200)**:
```json
{
  "id": 42,
  "buddy": {
    "id": 123456789,
    "telegramUsername": "johndoe",
    "firstName": "John",
    "tonWalletAddress": null,
    "createdAt": "2025-10-01T12:00:00.000Z"
  },
  "status": "dissolved",
  "createdAt": "2025-10-08T14:30:00.000Z",
  "confirmedAt": null,
  "initiatedBy": 123456789
}
```

---

## Error Responses

Both endpoints use the same error response format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_REQUEST` | Cannot accept/reject own request, or request already processed |
| 401 | `UNAUTHORIZED` | Invalid or missing Telegram authentication |
| 404 | `BUDDY_NOT_FOUND` | Buddy pair ID doesn't exist |
| 404 | `USER_NOT_FOUND` | User account has been deleted |
| 409 | `CONFLICT` | Concurrent modification detected (race condition) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Authentication

Both endpoints require Telegram Mini App authentication via the `initData` field in the request body.

**Validation Process**:
1. Client sends `initData` string from Telegram SDK
2. Server validates signature using `TELEGRAM_BOT_TOKEN`
3. Server extracts user ID from validated data
4. Server checks user is authorized for the action

**Security**:
- All initData validation happens server-side
- HMAC signature verification prevents tampering
- User ID extracted from validated data, not client input

---

## Testing

### Using curl

**Accept Request**:
```bash
curl -X POST https://localhost:3000/api/buddy/accept \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "query_id=AAH...",
    "buddyPairId": 42
  }'
```

**Reject Request**:
```bash
curl -X POST https://localhost:3000/api/buddy/reject \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "query_id=AAH...",
    "buddyPairId": 42
  }'
```

### Using Telegram Web App

1. Run `pnpm run dev:https` to start HTTPS development server
2. Configure bot with @BotFather to use `https://127.0.0.1:3000`
3. Open mini app in Telegram
4. Navigate to buddy status screen
5. Receive a buddy request (or seed one in database)
6. Tap Accept or Reject button
7. Verify UI updates and notification sent

---

## Validation Tools

### OpenAPI Validators

You can validate these specifications using standard OpenAPI tools:

```bash
# Install openapi-cli (if not already installed)
npm install -g @redocly/cli

# Validate API specs
redocly lint contracts/api-accept.yaml
redocly lint contracts/api-reject.yaml
```

### Contract Testing

Integration tests should validate:
- Request/response schemas match OpenAPI specs
- All error codes documented are actually returned
- Authentication validation works correctly
- Status code ranges are correct

---

## Implementation Notes

1. **Rate Limiting**: Not currently implemented, but consider adding in production
2. **Idempotency**: Accept/reject operations are idempotent - calling twice returns same result (or 400 if already processed)
3. **Timeouts**: API routes have 120s timeout (Next.js default), but operations complete in <200ms typically
4. **Concurrent Requests**: Protected by database transactions, last write wins with validation

---

## Version History

- **v1.0.0** (2025-10-09) - Initial contract specification for accept/reject endpoints
