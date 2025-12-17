/**
 * ObservAI Hub - Auth Callback Handler
 * Validates OAuth tokens with proper error handling
 * 
 * PRIORITY 1: Backend API Validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface CallbackResponse {
  success: boolean;
  user_id?: string;
  email?: string;
  error?: string;
  message?: string;
}

/**
 * Validate JWT token format
 */
function isValidJWTFormat(token: string): boolean {
  // JWT format: header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Check each part is base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64UrlRegex.test(part));
}

/**
 * Validate callback URL format
 */
function isValidCallbackURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. VALIDATE TOKEN PRESENCE
    const authHeader = req.headers.get('Authorization');
    const urlParams = new URL(req.url).searchParams;
    const tokenFromQuery = urlParams.get('token');
    const tokenFromHash = urlParams.get('access_token'); // OAuth callback format
    
    const token = authHeader?.replace('Bearer ', '') || tokenFromQuery || tokenFromHash;
    
    if (!token) {
      console.error('[Auth Callback] Missing token');
      return createErrorResponse(
        'missing_token',
        'Authentication token is required',
        400
      );
    }

    // 2. VALIDATE TOKEN FORMAT
    if (!isValidJWTFormat(token)) {
      console.error('[Auth Callback] Malformed token');
      return createErrorResponse(
        'malformed_token',
        'Token format is invalid',
        401
      );
    }

    // 3. VERIFY TOKEN WITH SUPABASE
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('[Auth Callback] Invalid token:', error?.message);
      return createErrorResponse(
        'invalid_token',
        'Token is expired or invalid',
        401
      );
    }

    // 4. VALIDATE CALLBACK URL (if present)
    const callbackUrl = urlParams.get('callback_url') || urlParams.get('redirect_uri');
    
    if (callbackUrl && !isValidCallbackURL(callbackUrl)) {
      console.error('[Auth Callback] Invalid callback URL:', callbackUrl);
      return createErrorResponse(
        'invalid_callback_url',
        'Callback URL format is invalid',
        400
      );
    }

    // 5. SUCCESS RESPONSE
    console.log('[Auth Callback] Success:', {
      userId: data.user.id,
      email: data.user.email,
      timestamp: new Date().toISOString(),
    });

    const response: CallbackResponse = {
      success: true,
      user_id: data.user.id,
      email: data.user.email,
    };

    return createSuccessResponse(response);

  } catch (err: any) {
    console.error('[Auth Callback] Unexpected error:', err);
    
    // Handle concurrent request errors (JSON decode issues)
    if (err.message?.includes('JSON') || err.message?.includes('parse')) {
      return createErrorResponse(
        'request_error',
        'Invalid request format. Please try again.',
        400
      );
    }
    
    return createErrorResponse(
      'internal_error',
      'An unexpected error occurred',
      500
    );
  }
});
