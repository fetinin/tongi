import { describe, test, expect } from '@jest/globals';

// T008: Contract test GET /api/buddy/search
// This test MUST FAIL until the actual API endpoint is implemented
describe('GET /api/buddy/search', () => {
  const baseUrl = 'http://localhost:3000';
  const endpoint = '/api/buddy/search';

  test('should return 200 with user results when searching by valid username', async () => {
    const username = 'johndoe';

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('users');
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);

    // Validate user profile structure
    const user = data.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('createdAt');
    expect(typeof user.id).toBe('number');
    expect(typeof user.firstName).toBe('string');
    expect(typeof user.createdAt).toBe('string');

    // Optional fields
    if (user.telegramUsername) {
      expect(typeof user.telegramUsername).toBe('string');
    }
    if (user.tonWalletAddress) {
      expect(typeof user.tonWalletAddress).toBe('string');
    }
  });

  test('should return 404 when no users found for username', async () => {
    const username = 'nonexistentuser12345';

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('message');
    expect(typeof data.error).toBe('string');
    expect(typeof data.message).toBe('string');
  });

  test('should return 400 when username parameter is missing', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
  });

  test('should return 401 when authorization header is missing', async () => {
    const username = 'johndoe';

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'UNAUTHORIZED');
    expect(data).toHaveProperty('message');
  });

  test('should return 400 when username parameter is empty', async () => {
    const username = '';

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(data).toHaveProperty('message');
  });

  test('should return multiple users when multiple matches exist', async () => {
    const username = 'john'; // Partial username that might match multiple users

    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_token'
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('users');
    expect(Array.isArray(data.users)).toBe(true);

    // All users should have required fields
    data.users.forEach((user: any) => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('createdAt');
      expect(typeof user.id).toBe('number');
      expect(typeof user.firstName).toBe('string');
      expect(typeof user.createdAt).toBe('string');
    });
  });
});