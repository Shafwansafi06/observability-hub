/**
 * ObservAI Hub - Shared Edge Function Utilities
 * Authentication and Authorization
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createErrorResponse } from './cors.ts';

// Supabase configuration from environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Authentication result type
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  organizationId?: string;
  projectId?: string;
  scopes?: string[];
  rateLimits?: {
    perMinute: number;
    perDay: number;
  };
  authType: 'jwt' | 'api_key' | 'none';
  error?: string;
}

/**
 * Create a Supabase admin client (bypasses RLS)
 */
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with user's JWT
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Validate JWT token and get user info
 */
async function validateJWT(token: string): Promise<AuthResult> {
  const client = createUserClient(token);
  
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    
    if (error || !user) {
      return {
        authenticated: false,
        authType: 'jwt',
        error: 'Invalid or expired token',
      };
    }
    
    // Get user's current organization
    const { data: profile } = await client
      .from('user_profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single();
    
    return {
      authenticated: true,
      userId: user.id,
      email: user.email!,
      organizationId: profile?.current_organization_id || undefined,
      authType: 'jwt',
    };
  } catch {
    return {
      authenticated: false,
      authType: 'jwt',
      error: 'Token validation failed',
    };
  }
}

/**
 * Validate API key and get associated data
 */
async function validateApiKey(apiKey: string): Promise<AuthResult> {
  const adminClient = createAdminClient();
  
  try {
    // Hash the API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Validate via RPC function
    const { data: result, error } = await adminClient.rpc('validate_api_key', {
      key_hash_input: keyHash,
    });
    
    if (error || !result || result.length === 0) {
      return {
        authenticated: false,
        authType: 'api_key',
        error: 'Invalid API key',
      };
    }
    
    const keyData = result[0];
    return {
      authenticated: true,
      organizationId: keyData.organization_id,
      projectId: keyData.project_id,
      scopes: keyData.scopes,
      rateLimits: {
        perMinute: keyData.rate_limit_per_minute,
        perDay: keyData.rate_limit_per_day,
      },
      authType: 'api_key',
    };
  } catch {
    return {
      authenticated: false,
      authType: 'api_key',
      error: 'API key validation failed',
    };
  }
}

/**
 * Authenticate a request using JWT or API key
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  // Check for API key first (for SDK/programmatic access)
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return validateApiKey(apiKey);
  }
  
  // Check for JWT token
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  
  if (token) {
    return validateJWT(token);
  }
  
  return {
    authenticated: false,
    authType: 'none',
    error: 'No authentication provided',
  };
}

/**
 * Require authentication middleware
 */
export async function requireAuth(request: Request): Promise<AuthResult | Response> {
  const auth = await authenticate(request);
  
  if (!auth.authenticated) {
    return createErrorResponse('UNAUTHORIZED', auth.error || 'Authentication required', 401);
  }
  
  return auth;
}

/**
 * Require specific scopes for API key authentication
 */
export function requireScopes(auth: AuthResult, requiredScopes: string[]): Response | null {
  if (auth.authType === 'api_key') {
    const hasScope = requiredScopes.every(scope => auth.scopes?.includes(scope));
    if (!hasScope) {
      return createErrorResponse(
        'FORBIDDEN',
        `Required scopes: ${requiredScopes.join(', ')}`,
        403
      );
    }
  }
  return null;
}

/**
 * Check if user has role in organization
 */
export async function checkOrgRole(
  userId: string,
  organizationId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return requiredRoles.includes(data.role);
}

/**
 * Check if user is member of organization
 */
export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  
  const { count, error } = await adminClient
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('organization_id', organizationId);
  
  return !error && (count ?? 0) > 0;
}

export { createClient };
