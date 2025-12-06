/**
 * Authentication Middleware
 * 
 * Provides authentication and authorization utilities for the application.
 */

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User | null;
  userId: string | null;
  organizationId: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * Get current authentication context
 */
export async function getAuthContext(): Promise<AuthContext> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      user: null,
      userId: null,
      organizationId: null,
      role: null,
      isAuthenticated: false,
      isAdmin: false,
    };
  }
  
  // Fetch user profile with organization info
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();
  
  // Type assertion needed due to Supabase generic complexity
  const profile = profileData as { current_organization_id: string | null } | null;
  const currentOrgId: string | null = profile?.current_organization_id ?? null;
  
  // Get role from organization_members if user has an organization
  let role: string | null = null;
  if (currentOrgId) {
    const { data: membershipData } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', currentOrgId)
      .single();
    
    const membership = membershipData as { role: string } | null;
    role = membership?.role ?? null;
  }
  
  return {
    user,
    userId: user.id,
    organizationId: currentOrgId,
    role,
    isAuthenticated: true,
    isAdmin: role === 'owner' || role === 'admin',
  };
}

/**
 * Check if user has required role
 */
export function hasRole(
  context: AuthContext,
  requiredRoles: string | string[]
): boolean {
  if (!context.isAuthenticated || !context.role) {
    return false;
  }
  
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(context.role);
}

/**
 * Check if user has access to organization
 */
export function hasOrgAccess(
  context: AuthContext,
  organizationId: string
): boolean {
  if (!context.isAuthenticated) {
    return false;
  }
  
  return context.organizationId === organizationId;
}

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

/**
 * Check if user role meets minimum required level
 */
export function meetsRoleLevel(
  context: AuthContext,
  minimumRole: string
): boolean {
  if (!context.isAuthenticated || !context.role) {
    return false;
  }
  
  const userLevel = ROLE_HIERARCHY[context.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Authentication guard for protected routes
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  return context;
}

/**
 * Admin guard for admin-only routes
 */
export async function requireAdmin(): Promise<AuthContext> {
  const context = await getAuthContext();
  
  if (!context.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  if (!context.isAdmin) {
    throw new Error('Admin access required');
  }
  
  return context;
}
