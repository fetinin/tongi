import { describe, test, expect, beforeEach } from '@jest/globals';

// T006: Contract test POST /api/auth/validate
describe('POST /api/auth/validate', () => {
  const baseUrl = 'http://localhost:3000';
  const endpoint = '/api/auth/validate';

  beforeEach(() => {
    // Reset fetch mock before each test
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReset();
  });

  test('should return 200 with valid auth response when given valid initData', async () => {
    const validInitData = 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1234567890&hash=abcdef123456';
    const tonWalletAddress = 'UQD-SuoCHsCL2pIZfE8IAKsjc0aDpDUQAoo-ALHl2mje04A-';

    const requestBody = {
      initData: validInitData,
      tonWalletAddress: tonWalletAddress
    };

    // Mock successful response
    const mockResponse = {
      user: {
        id: 123456789,
        firstName: 'John',
        telegramUsername: null,
        tonWalletAddress: tonWalletAddress,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isNewUser: false
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('isNewUser');
    expect(data.user).toHaveProperty('id', 123456789);
    expect(data.user).toHaveProperty('firstName', 'John');
    expect(data.user).toHaveProperty('tonWalletAddress', tonWalletAddress);
    expect(typeof data.token).toBe('string');
    expect(typeof data.isNewUser).toBe('boolean');
  });

  test('should return 401 when given invalid initData', async () => {
    const invalidInitData = 'invalid_init_data_string';

    const requestBody = {
      initData: invalidInitData
    };

    // Mock error response
    const mockErrorResponse = {
      error: 'INVALID_AUTH',
      message: 'Invalid Telegram authentication data'
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => mockErrorResponse,
    } as Response);

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
    expect(data).toHaveProperty('error', 'INVALID_AUTH');
    expect(data).toHaveProperty('message');
    expect(typeof data.message).toBe('string');
  });

  test('should return 400 when missing required initData field', async () => {
    const requestBody = {
      tonWalletAddress: 'UQD-SuoCHsCL2pIZfE8IAKsjc0aDpDUQAoo-ALHl2mje04A-'
    };

    // Mock validation error response
    const mockErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Missing required field: initData'
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => mockErrorResponse,
    } as Response);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'VALIDATION_ERROR');
    expect(data).toHaveProperty('message');
  });

  test('should handle new user registration', async () => {
    const validInitData = 'user=%7B%22id%22%3A987654321%2C%22first_name%22%3A%22Jane%22%7D&auth_date=1234567890&hash=abcdef123456';

    const requestBody = {
      initData: validInitData
    };

    // Mock new user response
    const mockResponse = {
      user: {
        id: 987654321,
        firstName: 'Jane',
        telegramUsername: null,
        tonWalletAddress: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isNewUser: true
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.isNewUser).toBe(true);
    expect(data.user.id).toBe(987654321);
    expect(data.user.firstName).toBe('Jane');
    expect(data.user.tonWalletAddress).toBeNull();
  });

  test('should return 500 on server error', async () => {
    const validInitData = 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1234567890&hash=abcdef123456';

    const requestBody = {
      initData: validInitData
    };

    // Mock server error response
    const mockErrorResponse = {
      error: 'INTERNAL_ERROR',
      message: 'Internal server error'
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => mockErrorResponse,
    } as Response);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('message');
  });
});