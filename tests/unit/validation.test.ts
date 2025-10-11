import { UserValidation } from '../../src/models/User';
import {
  validateTonAddress,
  validateTransactionParams,
} from '../../src/lib/ton';
// Note: Transaction validation helpers return string[] of errors; we only assert on messages present
// to avoid coupling tests to every individual rule.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { validateCreateTransactionInput } from '../../src/models/Transaction';

describe('UserValidation', () => {
  test('isValidTelegramId validates positive integers', () => {
    expect(UserValidation.isValidTelegramId(1)).toBe(true);
    expect(UserValidation.isValidTelegramId(123456789)).toBe(true);
    expect(UserValidation.isValidTelegramId(0)).toBe(false);
    expect(UserValidation.isValidTelegramId(-5)).toBe(false);
  });

  test('isValidFirstName enforces 1-64 chars', () => {
    expect(UserValidation.isValidFirstName('A')).toBe(true);
    expect(UserValidation.isValidFirstName('a'.repeat(64))).toBe(true);
    expect(UserValidation.isValidFirstName('')).toBe(false);
    expect(UserValidation.isValidFirstName('a'.repeat(65))).toBe(false);
  });

  test('isValidUsername enforces Telegram format (5-32, alnum + _)', () => {
    expect(UserValidation.isValidUsername('user_123')).toBe(true);
    expect(UserValidation.isValidUsername('abcde')).toBe(true);

    expect(UserValidation.isValidUsername('a')).toBe(false);
    expect(UserValidation.isValidUsername('user name')).toBe(false);
    expect(UserValidation.isValidUsername('a'.repeat(33))).toBe(false);
  });

  test('isValidTonAddress accepts supported formats', () => {
    // 48 hex chars (per UserValidation rule)
    const hex48 = 'a'.repeat(48);
    // EQ + 46 URL-safe base64-like chars
    const eqPrefixed = 'EQ' + 'A'.repeat(46);
    expect(UserValidation.isValidTonAddress(hex48)).toBe(true);
    expect(UserValidation.isValidTonAddress(eqPrefixed)).toBe(true);

    expect(UserValidation.isValidTonAddress('not-an-address')).toBe(false);
  });
});

describe('TON utils validation', () => {
  test('validateTonAddress supports multiple address forms', () => {
    // 64 hex chars (raw)
    const hex64 = 'b'.repeat(64);
    // EQ-prefixed (user-friendly)
    const eqPrefixed = 'EQ' + 'B'.repeat(46);

    expect(validateTonAddress(hex64)).toBe(true);
    expect(validateTonAddress(eqPrefixed)).toBe(true);
    expect(validateTonAddress('invalid')).toBe(false);
  });

  test('validateTransactionParams reports expiry and missing messages', () => {
    const expiredNow = Math.floor(Date.now() / 1000) - 10;
    const errors = validateTransactionParams({
      validUntil: expiredNow,
      messages: [],
    } as any);

    expect(errors).toEqual(
      expect.arrayContaining([
        'Transaction has expired',
        'Transaction must have at least one message',
      ])
    );
  });

  test('validateTransactionParams validates recipient and amount per message', () => {
    const future = Math.floor(Date.now() / 1000) + 60;
    const errors = validateTransactionParams({
      validUntil: future,
      messages: [{ address: 'bad', amount: '0' }],
    } as any);

    expect(errors).toEqual(
      expect.arrayContaining([
        'Invalid recipient address in message 1',
        'Invalid amount in message 1',
      ])
    );
  });
});

describe('Transaction validation helpers', () => {
  test('validateCreateTransactionInput returns errors for invalid inputs', () => {
    const errors = validateCreateTransactionInput({
      from_wallet: 'bad',
      to_wallet: 'bad',
      amount: 0,
      // Intentionally pass an invalid type to trigger validation error

      transaction_type: 'invalid' as any,
      related_entity_id: 1,
      // Omit related_entity_type to trigger dependency error
    } as any);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toEqual(
      expect.arrayContaining([
        'Invalid from_wallet TON address format',
        'Invalid to_wallet TON address format',
        'Amount must be positive',
        'Invalid transaction_type',
        'related_entity_type is required when related_entity_id is provided',
      ])
    );
  });
});
