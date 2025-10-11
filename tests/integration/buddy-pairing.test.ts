import { describe, test, expect } from '@jest/globals';
import { POST as buddyRequestHandler } from '@/app/api/buddy/request/route';
import { GET as buddyStatusHandler } from '@/app/api/buddy/status/route';
import { GET as buddySearchHandler } from '@/app/api/buddy/search/route';
import { authenticateTestUser } from '../helpers/auth';
import {
  createAuthenticatedRequest,
  createMockRequest,
} from '../helpers/request';

// T011: Integration test buddy pairing flow
describe('Buddy Pairing Flow Integration', () => {
  test('should complete full buddy pairing flow successfully', async () => {
    // Step 1: User A authenticates
    const userAToken = await authenticateTestUser({
      id: 123456789,
      firstName: 'Alice',
    });

    // Step 2: User B authenticates
    const userBToken = await authenticateTestUser({
      id: 987654321,
      firstName: 'Bob',
      username: 'bob_user',
    });

    // Step 3: User A checks initial buddy status (should be no_buddy)
    const initialStatusRequest = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/status',
    });

    const initialStatusResponse =
      await buddyStatusHandler(initialStatusRequest);
    expect(initialStatusResponse.status).toBe(200);
    const initialStatus = await initialStatusResponse.json();
    expect(initialStatus.status).toBe('no_buddy');

    // Step 4: User A searches for User B by username
    const searchRequest = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/search',
      query: { username: 'bob_user' },
    });

    const searchResponse = await buddySearchHandler(searchRequest);
    expect(searchResponse.status).toBe(200);
    const searchResults = await searchResponse.json();
    expect(searchResults.users).toHaveLength(1);
    expect(searchResults.users[0].id).toBe(987654321);
    expect(searchResults.users[0].firstName).toBe('Bob');

    // Step 5: User A sends buddy request to User B
    const buddyRequestRequest = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 987654321 },
    });

    const buddyRequestResponse = await buddyRequestHandler(buddyRequestRequest);
    expect(buddyRequestResponse.status).toBe(201);
    const buddyRequest = await buddyRequestResponse.json();
    expect(buddyRequest.status).toBe('pending');
    expect(buddyRequest.buddy.id).toBe(987654321);
    expect(buddyRequest.initiatedBy).toBe(123456789);

    // Step 6: User A checks buddy status (should be pending)
    const pendingStatusRequest = createAuthenticatedRequest(userAToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/status',
    });

    const pendingStatusResponse =
      await buddyStatusHandler(pendingStatusRequest);
    expect(pendingStatusResponse.status).toBe(200);
    const pendingStatus = await pendingStatusResponse.json();
    expect(pendingStatus.status).toBe('pending');
    expect(pendingStatus.buddy.id).toBe(987654321);

    // Step 7: User B checks their buddy status (should also be pending)
    const userBStatusRequest = createAuthenticatedRequest(userBToken, {
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/status',
    });

    const userBStatusResponse = await buddyStatusHandler(userBStatusRequest);
    expect(userBStatusResponse.status).toBe(200);
    const userBStatus = await userBStatusResponse.json();
    expect(userBStatus.status).toBe('pending');
    expect(userBStatus.buddy.id).toBe(123456789);
    expect(userBStatus.initiatedBy).toBe(123456789);
  });

  test('should prevent duplicate buddy requests', async () => {
    // User A authenticates
    const userAToken = await authenticateTestUser({
      id: 111222333,
      firstName: 'Charlie',
    });

    // User B authenticates
    await authenticateTestUser({
      id: 444555666,
      firstName: 'David',
    });

    // First buddy request
    const firstRequestRequest = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 444555666 },
    });

    const firstRequestResponse = await buddyRequestHandler(firstRequestRequest);
    expect(firstRequestResponse.status).toBe(201);

    // Second buddy request (should fail)
    const secondRequestRequest = createAuthenticatedRequest(userAToken, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 444555666 },
    });

    const secondRequestResponse =
      await buddyRequestHandler(secondRequestRequest);
    expect(secondRequestResponse.status).toBe(400);
    const errorData = await secondRequestResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toMatch(/already.*buddy|existing.*relationship/i);
  });

  test('should prevent self-buddy requests', async () => {
    // User authenticates
    const token = await authenticateTestUser({
      id: 777888999,
      firstName: 'Eve',
    });

    // Try to send buddy request to self
    const selfRequestRequest = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 777888999 }, // Same as authenticated user
    });

    const selfRequestResponse = await buddyRequestHandler(selfRequestRequest);
    expect(selfRequestResponse.status).toBe(400);
    const errorData = await selfRequestResponse.json();
    expect(errorData.error).toBe('INVALID_REQUEST');
    expect(errorData.message).toMatch(/self|same user/i);
  });

  test('should handle buddy request to non-existent user', async () => {
    // User authenticates
    const token = await authenticateTestUser({
      id: 100200300,
      firstName: 'Frank',
    });

    // Try to send buddy request to non-existent user
    const requestRequest = createAuthenticatedRequest(token, {
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 999999999 }, // Non-existent user
    });

    const requestResponse = await buddyRequestHandler(requestRequest);
    expect(requestResponse.status).toBe(404);
    const errorData = await requestResponse.json();
    expect(errorData.error).toBe('USER_NOT_FOUND');
  });

  test('should handle search for non-existent username', async () => {
    // User authenticates
    const token = await authenticateTestUser({
      id: 400500600,
      firstName: 'Grace',
    });

    // Search for non-existent username
    const searchRequest = createAuthenticatedRequest(token, {
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/search',
      query: { username: 'nonexistentuser12345' },
    });

    const searchResponse = await buddySearchHandler(searchRequest);
    expect(searchResponse.status).toBe(404);
    const errorData = await searchResponse.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData).toHaveProperty('message');
  });

  test('should require authentication for all buddy endpoints', async () => {
    // Test buddy search without auth
    const searchRequest = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/search',
      query: { username: 'test' },
    });
    const searchResponse = await buddySearchHandler(searchRequest);
    expect(searchResponse.status).toBe(401);

    // Test buddy request without auth
    const requestRequest = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/buddy/request',
      body: { targetUserId: 123 },
    });
    const requestResponse = await buddyRequestHandler(requestRequest);
    expect(requestResponse.status).toBe(401);

    // Test buddy status without auth
    const statusRequest = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/buddy/status',
    });
    const statusResponse = await buddyStatusHandler(statusRequest);
    expect(statusResponse.status).toBe(401);
  });
});
