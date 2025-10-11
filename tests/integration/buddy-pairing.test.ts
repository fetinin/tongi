import { describe, test, expect } from '@jest/globals';

// T011: Integration test buddy pairing flow
// This test MUST FAIL until the actual API endpoints are implemented
describe('Buddy Pairing Flow Integration', () => {
  const baseUrl = 'http://localhost:3000';

  test('should complete full buddy pairing flow successfully', async () => {
    // Step 1: User A authenticates
    const userAAuthResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Alice%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    expect(userAAuthResponse.ok).toBe(true);
    const userAAuth = await userAAuthResponse.json();
    const userAToken = userAAuth.token;

    // Step 2: User B authenticates
    const userBAuthResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A987654321%2C%22first_name%22%3A%22Bob%22%2C%22username%22%3A%22bob_user%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    expect(userBAuthResponse.ok).toBe(true);
    const userBAuth = await userBAuthResponse.json();
    // TODO: Use userBToken for future User B perspective tests
    const _userBToken = userBAuth.token;
    void _userBToken; // Mark as intentionally unused for now

    // Step 3: User A checks initial buddy status (should be no_buddy)
    const initialStatusResponse = await fetch(`${baseUrl}/api/buddy/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
    });

    expect(initialStatusResponse.ok).toBe(true);
    const initialStatus = await initialStatusResponse.json();
    expect(initialStatus.status).toBe('no_buddy');

    // Step 4: User A searches for User B by username
    const searchResponse = await fetch(
      `${baseUrl}/api/buddy/search?username=bob_user`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
      }
    );

    expect(searchResponse.ok).toBe(true);
    const searchResults = await searchResponse.json();
    expect(searchResults.users).toHaveLength(1);
    expect(searchResults.users[0].id).toBe(987654321);
    expect(searchResults.users[0].firstName).toBe('Bob');

    // Step 5: User A sends buddy request to User B
    const buddyRequestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetUserId: 987654321,
      }),
    });

    expect(buddyRequestResponse.ok).toBe(true);
    expect(buddyRequestResponse.status).toBe(201);
    const buddyRequest = await buddyRequestResponse.json();
    expect(buddyRequest.status).toBe('pending');
    expect(buddyRequest.buddy.id).toBe(987654321);
    expect(buddyRequest.initiatedBy).toBe(123456789);

    // Step 6: User A checks buddy status (should be pending)
    const pendingStatusResponse = await fetch(`${baseUrl}/api/buddy/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
    });

    expect(pendingStatusResponse.ok).toBe(true);
    const pendingStatus = await pendingStatusResponse.json();
    expect(pendingStatus.status).toBe('pending');
    expect(pendingStatus.buddy.id).toBe(987654321);

    // Step 7: User B checks their buddy status (should also be pending)
    const userBStatusResponse = await fetch(`${baseUrl}/api/buddy/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_userBToken}`,
      },
    });

    expect(userBStatusResponse.ok).toBe(true);
    const userBStatus = await userBStatusResponse.json();
    expect(userBStatus.status).toBe('pending');
    expect(userBStatus.buddy.id).toBe(123456789);
    expect(userBStatus.initiatedBy).toBe(123456789);
  });

  test('should prevent duplicate buddy requests', async () => {
    // User A authenticates
    const userAAuthResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A111222333%2C%22first_name%22%3A%22Charlie%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    const userAAuth = await userAAuthResponse.json();
    const userAToken = userAAuth.token;

    // User B authenticates
    const userBAuthResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A444555666%2C%22first_name%22%3A%22David%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    const userBAuth = await userBAuthResponse.json();
    // TODO: Use userBToken for future User B perspective tests
    const _userBToken = userBAuth.token;
    void _userBToken; // Mark as intentionally unused for now

    // First buddy request
    const firstRequestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetUserId: 444555666,
      }),
    });

    expect(firstRequestResponse.status).toBe(201);

    // Second buddy request (should fail)
    const secondRequestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        targetUserId: 444555666,
      }),
    });

    expect(secondRequestResponse.ok).toBe(false);
    expect(secondRequestResponse.status).toBe(400);
    const errorData = await secondRequestResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toMatch(/already.*buddy|existing.*relationship/i);
  });

  test('should prevent self-buddy requests', async () => {
    // User authenticates
    const authResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A777888999%2C%22first_name%22%3A%22Eve%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    const auth = await authResponse.json();
    const token = auth.token;

    // Try to send buddy request to self
    const selfRequestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetUserId: 777888999, // Same as authenticated user
      }),
    });

    expect(selfRequestResponse.ok).toBe(false);
    expect(selfRequestResponse.status).toBe(400);
    const errorData = await selfRequestResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toMatch(/self|same user/i);
  });

  test('should handle buddy request to non-existent user', async () => {
    // User authenticates
    const authResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A100200300%2C%22first_name%22%3A%22Frank%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    const auth = await authResponse.json();
    const token = auth.token;

    // Try to send buddy request to non-existent user
    const requestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetUserId: 999999999, // Non-existent user
      }),
    });

    expect(requestResponse.ok).toBe(false);
    expect(requestResponse.status).toBe(404);
    const errorData = await requestResponse.json();
    expect(errorData.error).toBe('USER_NOT_FOUND');
  });

  test('should handle search for non-existent username', async () => {
    // User authenticates
    const authResponse = await fetch(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData:
          'user=%7B%22id%22%3A400500600%2C%22first_name%22%3A%22Grace%22%7D&auth_date=1234567890&hash=abcdef123456',
      }),
    });

    const auth = await authResponse.json();
    const token = auth.token;

    // Search for non-existent username
    const searchResponse = await fetch(
      `${baseUrl}/api/buddy/search?username=nonexistentuser12345`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(searchResponse.ok).toBe(false);
    expect(searchResponse.status).toBe(404);
    const errorData = await searchResponse.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData).toHaveProperty('message');
  });

  test('should require authentication for all buddy endpoints', async () => {
    // Test buddy search without auth
    const searchResponse = await fetch(
      `${baseUrl}/api/buddy/search?username=test`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    expect(searchResponse.status).toBe(401);

    // Test buddy request without auth
    const requestResponse = await fetch(`${baseUrl}/api/buddy/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: 123 }),
    });
    expect(requestResponse.status).toBe(401);

    // Test buddy status without auth
    const statusResponse = await fetch(`${baseUrl}/api/buddy/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(statusResponse.status).toBe(401);
  });
});
