/**
 * ObservAI Hub - Supabase Client Configuration
 * 
 * This file exports Supabase clients for different contexts:
 * - Browser client for client-side operations
 * - Server client for server-side operations
 * - Admin client for elevated operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment variables with fallbacks
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Check if we're in a development environment without proper setup
const isDevelopmentWithoutConfig = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (isDevelopmentWithoutConfig) {
  console.warn('⚠️ Supabase environment variables are not configured.');
  console.warn('The app will work in demo mode with mock data.');
  console.warn('To enable full functionality, add these to your Vercel environment variables:');
  console.warn('- VITE_SUPABASE_URL');
  console.warn('- VITE_SUPABASE_ANON_KEY');
}

// Use dummy values if not configured (app will use mock data)
const SAFE_SUPABASE_URL = SUPABASE_URL || 'https://placeholder.supabase.co';
const SAFE_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY || 'public-anon-placeholder-key';

/**
 * Browser Supabase Client
 * Use this client for client-side operations in React components
 */
export const supabase = createClient<Database>(SAFE_SUPABASE_URL, SAFE_SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'observai-hub/1.0.0',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = !isDevelopmentWithoutConfig;

/**
 * Get the current user's session
 */
export async function getSession() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get the current user
 */
export async function getUser() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw error;
  return data;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Type-safe database query helpers
 */
export const db = {
  // Organizations
  organizations: () => supabase.from('organizations'),
  organizationMembers: () => supabase.from('organization_members'),

  // Users
  userProfiles: () => supabase.from('user_profiles'),

  // Projects
  projects: () => supabase.from('projects'),

  // API Keys
  apiKeys: () => supabase.from('api_keys'),

  // Audit
  auditLogs: () => supabase.from('audit_logs'),

  // Metrics
  metricDefinitions: () => supabase.from('metric_definitions'),
  metrics: () => supabase.from('metrics'),
  metricsAggregated: () => supabase.from('metrics_aggregated'),
  llmMetrics: () => supabase.from('llm_metrics'),

  // Logs
  logs: () => supabase.from('logs'),
  traces: () => supabase.from('traces'),
  spans: () => supabase.from('spans'),
  logPatterns: () => supabase.from('log_patterns'),
  savedSearches: () => supabase.from('saved_searches'),

  // Alerts
  alertRules: () => supabase.from('alert_rules'),
  alerts: () => supabase.from('alerts'),
  notificationChannels: () => supabase.from('notification_channels'),
  notificationHistory: () => supabase.from('notification_history'),
  anomalies: () => supabase.from('anomalies'),
  oncallSchedules: () => supabase.from('oncall_schedules'),
  alertComments: () => supabase.from('alert_comments'),
};

/**
 * RPC function helpers with type safety
 * Note: Using 'as never' cast due to Supabase generic complexity
 */
export const rpc = {
  getDashboardOverview: (args: { p_org_id: string; p_project_id?: string; p_hours?: number }) =>
    supabase.rpc('get_dashboard_overview', args as never),

  getMetricStats: (args: {
    p_org_id: string;
    p_project_id: string;
    p_metric_name: string;
    p_start_time: string;
    p_end_time: string;
    p_environment?: string;
  }) => supabase.rpc('get_metric_stats', args as never),

  getLLMMetricsSummary: (args: {
    p_org_id: string;
    p_project_id: string;
    p_start_time: string;
    p_end_time: string;
  }) => supabase.rpc('get_llm_metrics_summary', args as never),

  getAlertsSummary: (args: { p_org_id: string }) =>
    supabase.rpc('get_alerts_summary', args as never),

  searchLogs: (args: {
    p_org_id: string;
    p_project_id: string;
    p_query: string;
    p_start_time: string;
    p_end_time: string;
    p_levels?: string[];
    p_sources?: string[];
    p_service_name?: string;
    p_limit?: number;
    p_offset?: number;
  }) => supabase.rpc('search_logs', args as never),

  getTimeSeries: (args: {
    p_org_id: string;
    p_project_id: string;
    p_metric_name: string;
    p_start_time: string;
    p_end_time: string;
    p_granularity?: string;
  }) => supabase.rpc('get_time_series', args as never),

  fireAlert: (args: { p_rule_id: string; p_current_value: number; p_labels?: Record<string, string> }) =>
    supabase.rpc('fire_alert', args as never),

  resolveAlert: (args: {
    p_alert_id: string;
    p_resolved_by?: string;
    p_resolution_type?: string;
    p_resolution_note?: string;
  }) => supabase.rpc('resolve_alert', args as never),

  acknowledgeAlert: (args: { p_alert_id: string; p_acknowledged_by: string }) =>
    supabase.rpc('acknowledge_alert', args as never),

  generateMockAuditData: (args: { target_user_id: string }) =>
    supabase.rpc('generate_mock_audit_data', args as never),
};

/**
 * Realtime subscription helpers
 */
export const realtime = {
  subscribeToAlerts: (organizationId: string, callback: (payload: unknown) => void) => {
    return supabase
      .channel(`alerts:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `organization_id=eq.${organizationId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToLogs: (projectId: string, callback: (payload: unknown) => void) => {
    return supabase
      .channel(`logs:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
          filter: `project_id=eq.${projectId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToMetrics: (projectId: string, callback: (payload: unknown) => void) => {
    return supabase
      .channel(`metrics:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'llm_metrics',
          filter: `project_id=eq.${projectId}`,
        },
        callback
      )
      .subscribe();
  },
};

export type { SupabaseClient };
export default supabase;
