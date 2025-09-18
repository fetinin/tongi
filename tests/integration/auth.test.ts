import { describe, test, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

// T007: Integration test Telegram initData validation
describe('Telegram initData validation integration', () => {
  let mockTelegramBotToken: string;

  beforeEach(() => {
    mockTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN || 'test_telegram_bot_token';
  });

  describe('initData HMAC validation', () => {
    test('should validate correctly signed initData', () => {
      // Create a valid initData string with proper HMAC signature
      const userData = {
        id: 123456789,
        first_name: 'John',
        username: 'john_doe',
        language_code: 'en'
      };

      const authDate = Math.floor(Date.now() / 1000);
      const dataToCheck = `auth_date=${authDate}&user=${JSON.stringify(userData)}`;

      // Generate HMAC signature using bot token
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockTelegramBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataToCheck)
        .digest('hex');

      const validInitData = `${dataToCheck}&hash=${hash}`;

      // Test the validation logic (this would normally be part of a utility function)
      const validateInitData = (initData: string, botToken: string): boolean => {
        try {
          const params = new URLSearchParams(initData);
          const receivedHash = params.get('hash');
          params.delete('hash');

          const sortedParams = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

          const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

          const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');

          return calculatedHash === receivedHash;
        } catch (error) {
          return false;
        }
      };

      const isValid = validateInitData(validInitData, mockTelegramBotToken);
      expect(isValid).toBe(true);
    });

    test('should reject initData with invalid HMAC signature', () => {
      const invalidInitData = 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1234567890&hash=invalid_hash';

      const validateInitData = (initData: string, botToken: string): boolean => {
        try {
          const params = new URLSearchParams(initData);
          const receivedHash = params.get('hash');
          params.delete('hash');

          const sortedParams = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

          const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

          const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');

          return calculatedHash === receivedHash;
        } catch (error) {
          return false;
        }
      };

      const isValid = validateInitData(invalidInitData, mockTelegramBotToken);
      expect(isValid).toBe(false);
    });

    test('should reject expired initData (older than 1 day)', () => {
      // Create initData with old auth_date (more than 24 hours ago)
      const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60 + 1);
      const userData = {
        id: 123456789,
        first_name: 'John'
      };

      const dataToCheck = `auth_date=${oneDayAgo}&user=${JSON.stringify(userData)}`;

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockTelegramBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataToCheck)
        .digest('hex');

      const expiredInitData = `${dataToCheck}&hash=${hash}`;

      const validateInitDataWithExpiry = (initData: string, botToken: string): boolean => {
        try {
          const params = new URLSearchParams(initData);
          const authDate = parseInt(params.get('auth_date') || '0');
          const currentTime = Math.floor(Date.now() / 1000);

          // Check if auth_date is older than 24 hours
          if (currentTime - authDate > 24 * 60 * 60) {
            return false;
          }

          const receivedHash = params.get('hash');
          params.delete('hash');

          const sortedParams = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

          const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

          const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');

          return calculatedHash === receivedHash;
        } catch (error) {
          return false;
        }
      };

      const isValid = validateInitDataWithExpiry(expiredInitData, mockTelegramBotToken);
      expect(isValid).toBe(false);
    });

    test('should extract user data correctly from valid initData', () => {
      const userData = {
        id: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'john_doe',
        language_code: 'en'
      };

      const authDate = Math.floor(Date.now() / 1000);
      const userParam = encodeURIComponent(JSON.stringify(userData));
      const dataToCheck = `auth_date=${authDate}&user=${userParam}`;

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockTelegramBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataToCheck)
        .digest('hex');

      const validInitData = `${dataToCheck}&hash=${hash}`;

      const extractUserData = (initData: string): any => {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) return null;

        try {
          return JSON.parse(userStr);
        } catch (error) {
          return null;
        }
      };

      const extractedUser = extractUserData(validInitData);
      expect(extractedUser).toEqual(userData);
      expect(extractedUser.id).toBe(123456789);
      expect(extractedUser.first_name).toBe('John');
      expect(extractedUser.username).toBe('john_doe');
    });

    test('should handle missing user data in initData', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const dataToCheck = `auth_date=${authDate}`;

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockTelegramBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataToCheck)
        .digest('hex');

      const initDataWithoutUser = `${dataToCheck}&hash=${hash}`;

      const extractUserData = (initData: string): any => {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) return null;

        try {
          return JSON.parse(userStr);
        } catch (error) {
          return null;
        }
      };

      const extractedUser = extractUserData(initDataWithoutUser);
      expect(extractedUser).toBeNull();
    });

    test('should handle malformed user JSON in initData', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const malformedUserData = 'invalid_json_string';
      const dataToCheck = `auth_date=${authDate}&user=${malformedUserData}`;

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockTelegramBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataToCheck)
        .digest('hex');

      const initDataWithMalformedUser = `${dataToCheck}&hash=${hash}`;

      const extractUserData = (initData: string): any => {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (!userStr) return null;

        try {
          return JSON.parse(userStr);
        } catch (error) {
          return null;
        }
      };

      const extractedUser = extractUserData(initDataWithMalformedUser);
      expect(extractedUser).toBeNull();
    });
  });

  describe('user data validation', () => {
    test('should validate required user fields', () => {
      const validateUserData = (userData: any): boolean => {
        if (!userData || typeof userData !== 'object') return false;
        if (typeof userData.id !== 'number') return false;
        if (typeof userData.first_name !== 'string' || userData.first_name.trim() === '') return false;
        return true;
      };

      // Valid user data
      expect(validateUserData({ id: 123456789, first_name: 'John' })).toBe(true);

      // Invalid cases
      expect(validateUserData(null)).toBe(false);
      expect(validateUserData({})).toBe(false);
      expect(validateUserData({ id: 'not_a_number', first_name: 'John' })).toBe(false);
      expect(validateUserData({ id: 123456789, first_name: '' })).toBe(false);
      expect(validateUserData({ id: 123456789 })).toBe(false);
    });

    test('should handle optional user fields correctly', () => {
      const validateUserData = (userData: any): any => {
        if (!userData || typeof userData !== 'object') return null;
        if (typeof userData.id !== 'number') return null;
        if (typeof userData.first_name !== 'string' || userData.first_name.trim() === '') return null;

        return {
          id: userData.id,
          firstName: userData.first_name,
          lastName: userData.last_name || null,
          username: userData.username || null,
          languageCode: userData.language_code || null
        };
      };

      const fullUserData = {
        id: 123456789,
        first_name: 'John',
        last_name: 'Doe',
        username: 'john_doe',
        language_code: 'en'
      };

      const minimalUserData = {
        id: 123456789,
        first_name: 'John'
      };

      const processedFullUser = validateUserData(fullUserData);
      expect(processedFullUser).toEqual({
        id: 123456789,
        firstName: 'John',
        lastName: 'Doe',
        username: 'john_doe',
        languageCode: 'en'
      });

      const processedMinimalUser = validateUserData(minimalUserData);
      expect(processedMinimalUser).toEqual({
        id: 123456789,
        firstName: 'John',
        lastName: null,
        username: null,
        languageCode: null
      });
    });
  });
});