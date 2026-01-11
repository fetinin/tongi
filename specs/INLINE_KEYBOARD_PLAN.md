# Inline Keyboard for Corgi Sighting Confirmation

## Overview
Add inline keyboard buttons to Telegram notifications for corgi sightings, allowing users to approve or reject sightings directly in the chat without opening the Mini App.

## Current Flow
1. User reports corgi sighting via Mini App
2. Bot sends plain text notification to buddy
3. Buddy opens Mini App to confirm/deny sighting
4. Confirmation results sent via Telegram notification

## New Flow
1. User reports corgi sighting via Mini App
2. Bot sends notification with inline keyboard buttons to buddy
3. Buddy clicks "Approve" or "Reject" button in chat
4. Webhook processes button click → confirms/denies sighting
5. Success/error notification sent to reporter

## Implementation Phases

### Phase 1: Inline Keyboard Actions
**Files to modify:**
- `src/services/NotificationService.ts`

**Changes:**
1. Add `reply_markup` support to `BotSendOptions` interface
2. Update `sendMessage()` to accept and send `reply_markup` parameter
3. Modify `notifyNewSighting()` to:
   - Accept `sightingId` parameter
   - Create inline keyboard with Approve/Reject buttons
   - Pass inline keyboard to `sendMessage()`

**Inline Keyboard Structure:**
```typescript
{
  inline_keyboard: [[
    { text: '✅ Approve', callback_data: `approve:${sightingId}` },
    { text: '❌ Reject', callback_data: `reject:${sightingId}` }
  ]]
}
```

### Phase 2: Webhook Handler
**Files to create:**
- `src/app/api/telegram/webhook/route.ts`

**Implementation:**
1. Create POST endpoint `/api/telegram/webhook`
2. Verify `TELEGRAM_BOT_SECRET` header for security
3. Parse incoming `callback_query` from Telegram
4. Extract `callback_data` (format: `approve:{id}` or `reject:{id}`)
5. Identify user from callback query
6. Call `CorgiService.confirmSighting()` with extracted data
7. Answer callback query with success/error message
8. Send notification to reporter via existing `notifySightingResponse()`

### Phase 3: Service Integration
**Files to modify:**
- `src/services/CorgiService.ts`

**Changes:**
1. Pass `sightingId` to `notifyNewSighting()` call in `createSighting()` method

## Callback Data Format
- Approval: `approve:{sightingId}`
- Rejection: `reject:{sightingId}`

Example: `approve:123` or `reject:456`

## Security Considerations
- Verify webhook requests using `X-Telegram-Bot-Api-Secret-Token` header
- Ensure only valid sighting IDs are processed
- Validate user permissions (only buddy can confirm their assigned sightings)

## API Endpoints
- `POST /api/telegram/webhook` - Handle callback queries from inline keyboard buttons

## Error Handling
- Invalid callback data format → Show error message in answerCallbackQuery
- Sighting not found → Show "Sighting not found or already processed"
- User not authorized → Show "You're not authorized to confirm this sighting"
- Blockchain errors → Show retryable error with details

## Testing
- Test inline keyboard appears correctly in notifications
- Test approve button triggers confirmation
- Test reject button triggers denial
- Test error handling for invalid/expired sightings
- Test duplicate button clicks (should show "already processed")
