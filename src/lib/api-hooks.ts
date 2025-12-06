/**
 * API Hooks for Data Fetching
 * 
 * TanStack Query hooks for fetching data from the observability backend.
 * Provides typed, cached, and optimized data fetching.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from './query-client';
import { apiClient, edgeFunctions, ApiError } from './api-client';
import { supabase } from './supabaseClient';
import type { 
  Organization, 
  Project, 
  Metric, 
  LLMMetric, 
  Log, 
  Alert, 
  AlertRule,
  Incident,
  ApiKey,
  AlertUpdate,
  ApiKeyUpdate,
  IncidentUpdate,
  Database,
} from '@/types/database';

// Type helpers for Supabase updates
type AlertsTable = Database['public']['Tables']['alerts'];
type ApiKeysTable = Database['public']['Tables']['api_keys'];
type IncidentsTable = Database['public']['Tables']['incidents'];

// ==================== Organization Hooks ====================

/**
 * Fetch all organizations for the current user
 */
export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) throw new ApiError(error.message, 500);
      return data as Organization[];
    },
  });
}

/**
 * Fetch organization details
 */
export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      
      if (error) throw new ApiError(error.message, 500);
      return data as Organization;
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch organization members
 */
export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.members(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at');
      
      if (error) throw new ApiError(error.message, 500);
      return data;
    },
    enabled: !!orgId,
  });
}

// ==================== Project Hooks ====================

/**
 * Fetch projects for an organization
 */
export function useProjects(orgId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.projects.list(orgId, filters),
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw new ApiError(error.message, 500);
      return data as Project[];
    },
    enabled: !!orgId,
  });
}

/**
 * Fetch project details
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, organization:organizations(*)')
        .eq('id', projectId)
        .single();
      
      if (error) throw new ApiError(error.message, 500);
      return data as Project & { organization: Organization };
    },
    enabled: !!projectId,
  });
}

// ==================== Metrics Hooks ====================

/**
 * Fetch metrics overview for a project
 */
export function useMetricsOverview(projectId: string, timeRange: string) {
  return useQuery({
    queryKey: queryKeys.metrics.overview(projectId, timeRange),
    queryFn: async () => {
      const response = await edgeFunctions.invoke<{
        summary: Record<string, number>;
        trends: Record<string, number>;
      }>('metrics', {
        body: {
          action: 'overview',
          projectId,
          timeRange,
        },
      });
      return response;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch time-series metrics data
 */
export function useMetricsTimeseries(
  projectId: string,
  params: {
    metricName: string;
    startTime: string;
    endTime: string;
    interval?: string;
  }
) {
  return useQuery({
    queryKey: queryKeys.metrics.timeseries(projectId, params),
    queryFn: async () => {
      const response = await edgeFunctions.invoke<{
        data: Array<{ timestamp: string; value: number }>;
        aggregation: string;
      }>('metrics', {
        body: {
          action: 'timeseries',
          projectId,
          ...params,
        },
      });
      return response;
    },
    enabled: !!projectId && !!params.metricName,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch aggregated metrics
 */
export function useMetricsAggregated(
  projectId: string,
  params: {
    metricName: string;
    aggregation: string;
    groupBy?: string[];
  }
) {
  return useQuery({
    queryKey: queryKeys.metrics.aggregated(projectId, params),
    queryFn: async () => {
      const response = await edgeFunctions.invoke<{
        value: number;
        groups?: Record<string, number>;
      }>('metrics', {
        body: {
          action: 'aggregate',
          projectId,
          ...params,
        },
      });
      return response;
    },
    enabled: !!projectId && !!params.metricName,
  });
}

// ==================== LLM Metrics Hooks ====================

/**
 * Fetch LLM metrics overview
 */
export function useLLMMetricsOverview(projectId: string, timeRange: string) {
  return useQuery({
    queryKey: queryKeys.llmMetrics.overview(projectId, timeRange),
    queryFn: async () => {
      const response = await edgeFunctions.invoke<{
        totalRequests: number;
        totalTokens: number;
        totalCost: number;
        avgLatency: number;
        errorRate: number;
        modelBreakdown: Record<string, {
          requests: number;
          tokens: number;
          cost: number;
        }>;
      }>('metrics', {
        body: {
          action: 'llm-overview',
          projectId,
          timeRange,
        },
      });
      return response;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch LLM metrics by model
 */
export function useLLMMetricsByModel(projectId: string, model: string) {
  return useQuery({
    queryKey: queryKeys.llmMetrics.byModel(projectId, model),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_metrics')
        .select('*')
        .eq('project_id', projectId)
        .eq('model', model)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw new ApiError(error.message, 500);
      return data as LLMMetric[];
    },
    enabled: !!projectId && !!model,
  });
}

/**
 * Fetch LLM cost breakdown
 */
export function useLLMCosts(projectId: string, timeRange: string) {
  return useQuery({
    queryKey: queryKeys.llmMetrics.costs(projectId, timeRange),
    queryFn: async () => {
      const response = await edgeFunctions.invoke<{
        total: number;
        byModel: Record<string, number>;
        byDay: Array<{ date: string; cost: number }>;
        projected: number;
      }>('metrics', {
        body: {
          action: 'llm-costs',
          projectId,
          timeRange,
        },
      });
      return response;
    },
    enabled: !!projectId,
  });
}

// ==================== Logs Hooks ====================

/**
 * Fetch log stream with filters
 */
export function useLogs(
  projectId: string,
  filters?: {
    level?: string[];
    search?: string;
    traceId?: string;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: queryKeys.logs.stream(projectId, filters),
    queryFn: async () => {
      let query = supabase
        .from('logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(filters?.limit || 100);
      
      if (filters?.level && filters.level.length > 0) {
        query = query.in('level', filters.level);
      }
      
      if (filters?.search) {
        query = query.textSearch('message', filters.search);
      }
      
      if (filters?.traceId) {
        query = query.eq('trace_id', filters.traceId);
      }
      
      const { data, error } = await query;
      
      if (error) throw new ApiError(error.message, 500);
      return data as Log[];
    },
    enabled: !!projectId,
    staleTime: 10 * 1000, // 10 seconds for logs
    refetchInterval: 10 * 1000,
  });
}

/**
 * Fetch log details
 */
export function useLogDetail(logId: string) {
  return useQuery({
    queryKey: queryKeys.logs.detail(logId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('*, trace:trace_context(*)')
        .eq('id', logId)
        .single();
      
      if (error) throw new ApiError(error.message, 500);
      return data;
    },
    enabled: !!logId,
  });
}

/**
 * Fetch trace with all related logs
 */
export function useTrace(traceId: string) {
  return useQuery({
    queryKey: queryKeys.logs.trace(traceId),
    queryFn: async () => {
      const [traceResult, logsResult] = await Promise.all([
        supabase
          .from('trace_context')
          .select('*')
          .eq('trace_id', traceId)
          .single(),
        supabase
          .from('logs')
          .select('*')
          .eq('trace_id', traceId)
          .order('timestamp'),
      ]);
      
      if (traceResult.error) throw new ApiError(traceResult.error.message, 500);
      if (logsResult.error) throw new ApiError(logsResult.error.message, 500);
      
      return {
        trace: traceResult.data,
        logs: logsResult.data as Log[],
      };
    },
    enabled: !!traceId,
  });
}

// ==================== Alerts Hooks ====================

/**
 * Fetch active alerts
 */
export function useActiveAlerts(projectId: string) {
  return useQuery({
    queryKey: queryKeys.alerts.active(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, rule:alert_rules(*)')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('triggered_at', { ascending: false });
      
      if (error) throw new ApiError(error.message, 500);
      return data as (Alert & { rule: AlertRule })[];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Fetch alert rules
 */
export function useAlertRules(projectId: string) {
  return useQuery({
    queryKey: queryKeys.alerts.rules(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      
      if (error) throw new ApiError(error.message, 500);
      return data as AlertRule[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create alert rule mutation
 */
export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await edgeFunctions.invoke<AlertRule>('alerts', {
        body: {
          action: 'create-rule',
          rule,
        },
      });
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate alert rules cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.rules(variables.project_id),
      });
    },
  });
}

/**
 * Update alert rule mutation
 */
export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      ruleId, 
      updates 
    }: { 
      ruleId: string; 
      updates: Partial<AlertRule>;
      projectId: string;
    }) => {
      const response = await edgeFunctions.invoke<AlertRule>('alerts', {
        body: {
          action: 'update-rule',
          ruleId,
          updates,
        },
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.rules(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.ruleDetail(variables.ruleId),
      });
    },
  });
}

/**
 * Acknowledge alert mutation
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ alertId, projectId }: { alertId: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: AlertUpdate = { 
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id || null,
      };
      const { error } = await supabase
        .from('alerts')
        .update(updateData as never)
        .eq('id', alertId);
      
      if (error) throw new ApiError(error.message, 500);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.alerts.active(variables.projectId),
      });
    },
  });
}

// ==================== Incidents Hooks ====================

/**
 * Fetch open incidents
 */
export function useOpenIncidents(projectId: string) {
  return useQuery({
    queryKey: queryKeys.incidents.open(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, alert_rule:alert_rules(*)')
        .eq('project_id', projectId)
        .in('status', ['open', 'acknowledged'])
        .order('first_occurrence_at', { ascending: false });
      
      if (error) throw new ApiError(error.message, 500);
      return data as (Incident & { alert_rule: AlertRule })[];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Fetch incident details
 */
export function useIncident(incidentId: string) {
  return useQuery({
    queryKey: queryKeys.incidents.detail(incidentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, alert_rule:alert_rules(*), alerts(*)')
        .eq('id', incidentId)
        .single();
      
      if (error) throw new ApiError(error.message, 500);
      return data;
    },
    enabled: !!incidentId,
  });
}

/**
 * Resolve incident mutation
 */
export function useResolveIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      incidentId, 
      projectId,
      resolution 
    }: { 
      incidentId: string; 
      projectId: string;
      resolution?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: IncidentUpdate = { 
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
        metadata: resolution ? { resolution } : {},
      };
      const { error } = await supabase
        .from('incidents')
        .update(updateData as never)
        .eq('id', incidentId);
      
      if (error) throw new ApiError(error.message, 500);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.open(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(variables.incidentId),
      });
    },
  });
}

// ==================== Anomalies Hooks ====================

/**
 * Fetch recent anomalies
 */
export function useAnomalies(projectId: string, limit = 20) {
  return useQuery({
    queryKey: queryKeys.anomalies.recent(projectId, limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomalies')
        .select('*')
        .eq('project_id', projectId)
        .order('detected_at', { ascending: false })
        .limit(limit);
      
      if (error) throw new ApiError(error.message, 500);
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}

// ==================== API Keys Hooks ====================

/**
 * Fetch API keys for a project
 */
export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: queryKeys.apiKeys.list(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, prefix, permissions, rate_limit, expires_at, created_at, last_used_at, revoked')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw new ApiError(error.message, 500);
      return data as Omit<ApiKey, 'key_hash'>[];
    },
    enabled: !!projectId,
  });
}

/**
 * Create API key mutation
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      name, 
      permissions,
      expiresAt 
    }: { 
      projectId: string;
      name: string;
      permissions: string[];
      expiresAt?: string;
    }) => {
      const response = await edgeFunctions.invoke<{ key: string; id: string }>('ingest', {
        body: {
          action: 'create-api-key',
          projectId,
          name,
          permissions,
          expiresAt,
        },
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.list(variables.projectId),
      });
    },
  });
}

/**
 * Revoke API key mutation
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ keyId, projectId }: { keyId: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: ApiKeyUpdate = { 
        status: 'revoked',
        revoked_by: user?.id,
        revoke_reason: 'Revoked by user',
      };
      const { error } = await supabase
        .from('api_keys')
        .update(updateData as never)
        .eq('id', keyId);
      
      if (error) throw new ApiError(error.message, 500);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.list(variables.projectId),
      });
    },
  });
}

// ==================== User Hooks ====================

/**
 * Fetch current user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user.current,
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw new ApiError(error.message, 401);
      if (!user) return null;
      
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*, organization:organizations(*)')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw new ApiError(profileError.message, 500);
      return profile;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch user notifications
 */
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.user.notifications,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20);
      
      
      if (error) throw new ApiError(error.message, 500);
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

