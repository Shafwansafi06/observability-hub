/**
 * ObservAI Hub - Shared Edge Function Utilities
 * CORS Headers Configuration
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-request-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create a CORS-enabled response
 */
export function createCorsResponse(
  body: unknown,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return createCorsResponse(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    status
  );
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  meta?: Record<string, unknown>
): Response {
  return createCorsResponse(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    status
  );
}
