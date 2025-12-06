/**
 * TanStack Query Configuration
 * 
 * Centralized query client configuration with optimized defaults
 * for the observability dashboard.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';
import { ApiError, AuthenticationError, RateLimitError } from './api-client';

/**
 * Determine if an error should trigger a retry
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Don't retry on authentication errors
  if (error instanceof AuthenticationError) {
    return false;
  }
  
  // Don't retry on rate limit (handled separately)
  if (error instanceof RateLimitError) {
    return false;
  }
  
  // Don't retry on client errors (4xx)
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  
  // Retry up to 3 times for server errors
  return failureCount < 3;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attemptIndex: number, error: unknown): number {
  // Use retry-after header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000;
  }
  
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
}

/**
 * Create and configure the query client
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 30 seconds for dashboard data
        staleTime: 30 * 1000,
        
        // Garbage collection time: 5 minutes
        gcTime: 5 * 60 * 1000,
        
        // Retry configuration
        retry: shouldRetry,
        retryDelay: getRetryDelay,
        
        // Refetch settings
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        
        // Network mode
        networkMode: 'online',
        
        // Error handling
        throwOnError: false,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        retryDelay: 1000,
        
        // Network mode
        networkMode: 'online',
        
        // Error handling
        throwOnError: false,
      },
    },
  });
}

// Singleton query client instance
let queryClient: QueryClient | null = null;

/**
 * Get the singleton query client instance
 */
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

/**
 * Query key factory for consistent key generation
 */
export const queryKeys = {
  // Organization queries
  organizations: {
    all: ['organizations'] as const,
    list: (filters?: { status?: string }) => 
      [...queryKeys.organizations.all, 'list', filters] as const,
    detail: (id: string) => 
      [...queryKeys.organizations.all, 'detail', id] as const,
    members: (id: string) => 
      [...queryKeys.organizations.all, 'members', id] as const,
  },
  
  // Project queries
  projects: {
    all: ['projects'] as const,
    list: (orgId: string, filters?: { status?: string }) => 
      [...queryKeys.projects.all, 'list', orgId, filters] as const,
    detail: (id: string) => 
      [...queryKeys.projects.all, 'detail', id] as const,
    settings: (id: string) => 
      [...queryKeys.projects.all, 'settings', id] as const,
  },
  
  // Metrics queries
  metrics: {
    all: ['metrics'] as const,
    overview: (projectId: string, timeRange: string) => 
      [...queryKeys.metrics.all, 'overview', projectId, timeRange] as const,
    timeseries: (projectId: string, params: { 
      metricName: string; 
      startTime: string; 
      endTime: string;
      interval?: string;
    }) => 
      [...queryKeys.metrics.all, 'timeseries', projectId, params] as const,
    aggregated: (projectId: string, params: {
      metricName: string;
      aggregation: string;
      groupBy?: string[];
    }) => 
      [...queryKeys.metrics.all, 'aggregated', projectId, params] as const,
  },
  
  // LLM Metrics queries
  llmMetrics: {
    all: ['llm-metrics'] as const,
    overview: (projectId: string, timeRange: string) => 
      [...queryKeys.llmMetrics.all, 'overview', projectId, timeRange] as const,
    byModel: (projectId: string, model: string) => 
      [...queryKeys.llmMetrics.all, 'by-model', projectId, model] as const,
    costs: (projectId: string, timeRange: string) => 
      [...queryKeys.llmMetrics.all, 'costs', projectId, timeRange] as const,
    latency: (projectId: string, params: { percentile?: number }) => 
      [...queryKeys.llmMetrics.all, 'latency', projectId, params] as const,
  },
  
  // Logs queries
  logs: {
    all: ['logs'] as const,
    stream: (projectId: string, filters?: { 
      level?: string[]; 
      search?: string;
      traceId?: string;
    }) => 
      [...queryKeys.logs.all, 'stream', projectId, filters] as const,
    detail: (id: string) => 
      [...queryKeys.logs.all, 'detail', id] as const,
    trace: (traceId: string) => 
      [...queryKeys.logs.all, 'trace', traceId] as const,
  },
  
  // Alerts queries
  alerts: {
    all: ['alerts'] as const,
    active: (projectId: string) => 
      [...queryKeys.alerts.all, 'active', projectId] as const,
    history: (projectId: string, timeRange: string) => 
      [...queryKeys.alerts.all, 'history', projectId, timeRange] as const,
    rules: (projectId: string) => 
      [...queryKeys.alerts.all, 'rules', projectId] as const,
    ruleDetail: (ruleId: string) => 
      [...queryKeys.alerts.all, 'rule', ruleId] as const,
  },
  
  // Incidents queries
  incidents: {
    all: ['incidents'] as const,
    open: (projectId: string) => 
      [...queryKeys.incidents.all, 'open', projectId] as const,
    detail: (id: string) => 
      [...queryKeys.incidents.all, 'detail', id] as const,
    timeline: (id: string) => 
      [...queryKeys.incidents.all, 'timeline', id] as const,
  },
  
  // Anomalies queries
  anomalies: {
    all: ['anomalies'] as const,
    recent: (projectId: string, limit?: number) => 
      [...queryKeys.anomalies.all, 'recent', projectId, limit] as const,
    byMetric: (projectId: string, metricName: string) => 
      [...queryKeys.anomalies.all, 'by-metric', projectId, metricName] as const,
  },
  
  // User queries
  user: {
    current: ['user', 'current'] as const,
    preferences: ['user', 'preferences'] as const,
    notifications: ['user', 'notifications'] as const,
  },
  
  // API Keys queries
  apiKeys: {
    all: ['api-keys'] as const,
    list: (projectId: string) => 
      [...queryKeys.apiKeys.all, 'list', projectId] as const,
  },
};

/**
 * Query client provider component
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const client = getQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default getQueryClient;
