/**
 * ObservAI Hub - Server-side Supabase Client
 * 
 * This client is used for server-side operations with elevated permissions.
 * Use in API routes, server actions, and Edge Functions.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Server-side environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

/**
 * Create a Supabase client for server-side operations
 * with the user's JWT token for RLS enforcement
 */
export function createServerClient(accessToken?: string): SupabaseClient<Database> {
  return createClient<Database>(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
      },
    }
  );
}

/**
 * Create an admin Supabase client with service role key
 * WARNING: This bypasses RLS - use with caution!
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  return createClient<Database>(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const client = createServerClient(token);
    const { data: { user }, error } = await client.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return {
      userId: user.id,
      email: user.email!,
    };
  } catch {
    return null;
  }
}

/**
 * Create audit log entry (uses admin client)
 */
export async function createAuditLog(params: {
  organizationId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const adminClient = createAdminClient();
  
  const insertData = {
    organization_id: params.organizationId,
    user_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    request_id: params.requestId,
    old_values: params.oldValues,
    new_values: params.newValues,
    metadata: params.metadata,
  };
  
  const { error } = await adminClient.from('audit_logs').insert(insertData as never);
  
  if (error) {
    console.error('Failed to create audit log:', error);
  }
}

// Type for API key validation result
interface ValidatedApiKey {
  api_key_id: string;
  organization_id: string;
  project_id: string | null;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

/**
 * Validate API key and return associated data
 */
export async function validateApiKey(apiKey: string): Promise<{
  apiKeyId: string;
  organizationId: string;
  projectId: string | null;
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
} | null> {
  const adminClient = createAdminClient();
  
  // Hash the API key for lookup
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const { data: result, error } = await adminClient.rpc('validate_api_key', {
    key_hash_input: keyHash,
  } as never);
  
  if (error || !result) {
    return null;
  }
  
  // Type cast the result
  const resultArray = result as unknown as ValidatedApiKey[];
  if (resultArray.length === 0) {
    return null;
  }
  
  const keyData = resultArray[0];
  return {
    apiKeyId: keyData.api_key_id,
    organizationId: keyData.organization_id,
    projectId: keyData.project_id,
    scopes: keyData.scopes,
    rateLimitPerMinute: keyData.rate_limit_per_minute,
    rateLimitPerDay: keyData.rate_limit_per_day,
  };
}

/**
 * Check if organization is within usage limits
 */
export async function checkOrganizationLimits(
  organizationId: string,
  resourceType: 'projects' | 'members' | 'events'
): Promise<boolean> {
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient.rpc('check_organization_limits', {
    org_id: organizationId,
    resource_type: resourceType,
  } as never);
  
  if (error) {
    console.error('Failed to check organization limits:', error);
    return false;
  }
  
  return data === true;
}

/**
 * Increment organization event count
 */
export async function incrementEventCount(organizationId: string, count: number = 1): Promise<void> {
  const adminClient = createAdminClient();
  
  // Note: This is a simplified version. In production, you'd use SQL directly
  // or a proper atomic increment function
  const { data: org } = await adminClient
    .from('organizations')
    .select('current_events_count')
    .eq('id', organizationId)
    .single();
  
  const currentCount = (org as { current_events_count: number } | null)?.current_events_count ?? 0;
  
  await adminClient
    .from('organizations')
    .update({ current_events_count: currentCount + count } as never)
    .eq('id', organizationId);
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string) {
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  
  if (error) {
    return null;
  }
  
  return data;
}

/**
 * Get project by slug within organization
 */
export async function getProjectBySlug(organizationId: string, projectSlug: string) {
  const adminClient = createAdminClient();
  
  const { data, error } = await adminClient
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('slug', projectSlug)
    .is('archived_at', null)
    .single();
  
  if (error) {
    return null;
  }
  
  return data;
}

export { createClient };
export type { SupabaseClient };
