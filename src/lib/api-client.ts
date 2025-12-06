/**
 * API Client Configuration
 * 
 * Centralized API client for making requests to the backend.
 * Includes automatic error handling, authentication, and retry logic.
 */

import { z } from 'zod';

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public errors: z.ZodError) {
    super(message, 400, 'VALIDATION_ERROR', errors.format());
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Permission denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// Request configuration
interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  validateResponse?: boolean;
}

// Response types
interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * Get authentication headers
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Get JWT token from localStorage or session
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add API key if available
  const apiKey = localStorage.getItem('api_key');
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  return headers;
}

/**
 * Parse error response
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let errorData: { message?: string; code?: string; details?: unknown } = {};
  
  try {
    errorData = await response.json();
  } catch {
    // Response is not JSON
  }
  
  const message = errorData.message || response.statusText || 'Request failed';
  
  switch (response.status) {
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError(message);
    case 429:
      const retryAfter = response.headers.get('Retry-After');
      return new RateLimitError(message, retryAfter ? parseInt(retryAfter) : undefined);
    default:
      return new ApiError(message, response.status, errorData.code, errorData.details);
  }
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an API request with retry logic
 */
async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    validateResponse = true,
    ...fetchConfig
  } = config;
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Build headers
  const headers = new Headers(fetchConfig.headers);
  if (!headers.has('Content-Type') && fetchConfig.body) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Add auth headers
  const authHeaders = getAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchConfig,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle error responses
      if (!response.ok) {
        const error = await parseErrorResponse(response);
        
        // Don't retry on client errors (except rate limit)
        if (response.status < 500 && response.status !== 429) {
          throw error;
        }
        
        // Rate limit - wait before retry
        if (error instanceof RateLimitError && error.retryAfter) {
          await sleep(error.retryAfter * 1000);
          continue;
        }
        
        throw error;
      }
      
      // Parse response
      const data = await response.json();
      
      return {
        data: data.data ?? data,
        meta: data.meta,
      };
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408, 'TIMEOUT');
      }
      
      // Don't retry on client errors
      if (error instanceof ApiError && error.status < 500) {
        throw error;
      }
      
      // Wait before retry
      if (attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt));
      }
    }
  }
  
  clearTimeout(timeoutId);
  throw lastError || new ApiError('Request failed', 500);
}

/**
 * API client with typed methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'GET' }),
  
  /**
   * POST request
   */
  post: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  /**
   * PUT request
   */
  put: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'DELETE' }),
};

/**
 * Supabase Edge Functions client
 */
export const edgeFunctions = {
  /**
   * Invoke an Edge Function
   */
  invoke: async <T>(
    functionName: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> => {
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers,
    };
    
    // Add user token if available
    const userToken = localStorage.getItem('auth_token');
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw error;
    }
    
    return response.json();
  },
};

/**
 * Streaming API client for real-time data
 */
export const streamingClient = {
  /**
   * Create a Server-Sent Events connection
   */
  sse: (endpoint: string, onMessage: (data: unknown) => void, onError?: (error: Error) => void) => {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage(event.data);
      }
    };
    
    eventSource.onerror = (event) => {
      if (onError) {
        onError(new Error('SSE connection error'));
      }
      console.error('SSE error:', event);
    };
    
    return {
      close: () => eventSource.close(),
    };
  },
};

export default apiClient;
