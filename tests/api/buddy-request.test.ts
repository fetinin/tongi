import { describe, test, expect } from '@jest/globals';

// T009: Contract test POST /api/buddy/request
// This test MUST FAIL until the actual API endpoint is implemented
describe('POST /api/buddy/request', () => {
  const baseUrl = 'http://localhost:3000';
  const endpoint = '/api/buddy/request';

  test('should return 201 with buddy pair when sending valid buddy request', async () => {
    const requestBody = {
      targetUserId: 987654321
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('buddy');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');

    // Validate buddy pair structure
    expect(typeof data.id).toBe('number');
    expect(data.status).toMatch(/^(pending|active)$/);
    expect(typeof data.createdAt).toBe('string');

    // Validate buddy user profile
    expect(data.buddy).toHaveProperty('id', 987654321);
    expect(data.buddy).toHaveProperty('firstName');
    expect(data.buddy).toHaveProperty('createdAt');
    expect(typeof data.buddy.firstName).toBe('string');
    expect(typeof data.buddy.createdAt).toBe('string');

    // Optional fields on buddy
    if (data.buddy.telegramUsername) {
      expect(typeof data.buddy.telegramUsername).toBe('string');
    }
    if (data.buddy.tonWalletAddress) {
      expect(typeof data.buddy.tonWalletAddress).toBe('string');
    }

    // Optional initiatedBy field
    if (data.initiatedBy) {
      expect(typeof data.initiatedBy).toBe('number');
    }
  });

  test('should return 400 when target user ID is missing', async () => {
    const requestBody = {};

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
  });

  test('should return 400 when trying to buddy with self', async () => {
    const requestBody = {
      targetUserId: 123456789 // Assuming this is the current user's ID
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_REQUEST');
    expect(data).toHaveProperty('message');
    expect(data.message).toMatch(/self|same user/i);
  });

  test('should return 400 when user already has an active buddy', async () => {
    const requestBody = {
      targetUserId: 987654321
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_REQUEST');
    expect(data).toHaveProperty('message');
    expect(data.message).toMatch(/already.*buddy|existing.*relationship/i);
  });

  test('should return 404 when target user does not exist', async () => {
    const requestBody = {
      targetUserId: 999999999 // Non-existent user ID
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'USER_NOT_FOUND');
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
  });

  test('should return 401 when authorization header is missing', async () => {
    const requestBody = {
      targetUserId: 987654321
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'UNAUTHORIZED');
    expect(data).toHaveProperty('message');
  });

  test('should return 400 when targetUserId is invalid format', async () => {
    const requestBody = {
      targetUserId: 'invalid_id'
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(data).toHaveProperty('message');
    expect(data.message).toMatch(/invalid.*id|format/i);
  });

  test('should handle pending buddy request status correctly', async () => {
    const requestBody = {
      targetUserId: 555666777
    };

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.status).toBe('pending');
    expect(data).toHaveProperty('initiatedBy');
    expect(typeof data.initiatedBy).toBe('number');
  });
});