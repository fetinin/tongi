import { NextRequest } from 'next/server';

export interface CreateRequestOptions {
  method?: string;
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  url?: string;
}

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
  options: CreateRequestOptions = {}
): NextRequest {
  const {
    method = 'GET',
    body = null,
    headers = {},
    query = {},
    url = 'http://localhost:3000/api/test',
  } = options;

  // Build URL with query params
  const urlObj = new URL(url);
  Object.entries(query).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  // Create request init options
  const requestInit: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // Add body if provided
  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj.toString(), requestInit);
}

/**
 * Create an authenticated request with Bearer token
 */
export function createAuthenticatedRequest(
  token: string,
  options: CreateRequestOptions = {}
): NextRequest {
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
