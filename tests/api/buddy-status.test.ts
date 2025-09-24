import { describe, test, expect } from '@jest/globals';

// T010: Contract test GET /api/buddy/status
// This test MUST FAIL until the actual API endpoint is implemented
describe('GET /api/buddy/status', () => {
  const baseUrl = 'http://localhost:3000';
  const endpoint = '/api/buddy/status';

  test('should return 200 with buddy pair when user has active buddy', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_with_buddy',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('buddy');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');

    // Validate buddy pair structure
    expect(typeof data.id).toBe('number');
    expect(data.status).toMatch(/^(pending|active|dissolved)$/);
    expect(typeof data.createdAt).toBe('string');

    // Validate buddy user profile
    expect(data.buddy).toHaveProperty('id');
    expect(data.buddy).toHaveProperty('firstName');
    expect(data.buddy).toHaveProperty('createdAt');
    expect(typeof data.buddy.id).toBe('number');
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

  test('should return 200 with no_buddy status when user has no buddy', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_no_buddy',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'no_buddy');
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
    expect(data.message).toBe('No active buddy relationship');
  });

  test('should return 200 with pending status when user has pending buddy request', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_pending_buddy',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('buddy');
    expect(data).toHaveProperty('status', 'pending');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('initiatedBy');

    // Validate structure for pending relationship
    expect(typeof data.id).toBe('number');
    expect(typeof data.createdAt).toBe('string');
    expect(typeof data.initiatedBy).toBe('number');

    // Validate buddy user profile
    expect(data.buddy).toHaveProperty('id');
    expect(data.buddy).toHaveProperty('firstName');
    expect(data.buddy).toHaveProperty('createdAt');
  });

  test('should return 401 when authorization header is missing', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
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
    expect(typeof data.message).toBe('string');
  });

  test('should return 401 when authorization token is invalid', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_token',
      },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'UNAUTHORIZED');
    expect(data).toHaveProperty('message');
  });

  test('should return consistent response format for active buddy relationship', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_active_buddy',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('active');

    // Should not have a message field when returning buddy pair
    expect(data).not.toHaveProperty('message');

    // Should have all required buddy pair fields
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('buddy');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');
  });

  test('should return dissolved status when buddy relationship was dissolved', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token_dissolved_buddy',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'dissolved');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('buddy');
    expect(data).toHaveProperty('createdAt');

    // Dissolved relationships should still show buddy info
    expect(data.buddy).toHaveProperty('id');
    expect(data.buddy).toHaveProperty('firstName');
  });

  test('should handle server errors gracefully', async () => {
    // This will FAIL until the actual endpoint is implemented
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock_jwt_token',
      },
    });

    // We expect this to fail with 404 (not found) until endpoint exists
    // When implemented, adjust this test for actual server error scenarios
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('message');
  });
});
