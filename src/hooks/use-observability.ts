/**
 * React hooks for real-time observability data
 */

import { useState, useEffect, useCallback } from 'react';
import {
  observabilityService,
  MetricsSummary,
  LLMMetrics,
  LogEntry,
  Alert,
  ServiceHealth,
} from '@/lib/observability-service';

/**
 * Hook for metrics summary with auto-refresh
 */
export function useMetricsSummary(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<MetricsSummary>(observabilityService.getMetricsSummary());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(observabilityService.getMetricsSummary());
      setLoading(false);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { metrics, loading };
}

/**
 * Hook for LLM metrics with auto-refresh
 */
export function useLLMMetrics(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<LLMMetrics>(observabilityService.getLLMMetrics());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(observabilityService.getLLMMetrics());
      setLoading(false);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { metrics, loading };
}

/**
 * Hook for recent logs with auto-refresh
 */
export function useLogs(limit = 50, refreshInterval = 3000) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateLogs = () => {
      setLogs(observabilityService.getRecentLogs(limit));
      setLoading(false);
    };

    updateLogs();
    const interval = setInterval(updateLogs, refreshInterval);

    return () => clearInterval(interval);
  }, [limit, refreshInterval]);

  return { logs, loading };
}

/**
 * Hook for alerts with actions
 */
export function useAlerts(refreshInterval = 5000) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const updateAlerts = useCallback(() => {
    const allAlerts = observabilityService.getAllAlerts();
    const active = observabilityService.getActiveAlerts();
    setAlerts(allAlerts);
    setActiveCount(active.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    updateAlerts();
    const interval = setInterval(updateAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, updateAlerts]);

  const acknowledge = useCallback((alertId: string) => {
    observabilityService.acknowledgeAlert(alertId);
    updateAlerts();
  }, [updateAlerts]);

  const resolve = useCallback((alertId: string) => {
    observabilityService.resolveAlert(alertId);
    updateAlerts();
  }, [updateAlerts]);

  return { alerts, activeCount, loading, acknowledge, resolve };
}

/**
 * Hook for time series chart data
 */
export function useTimeSeriesData(
  metric: 'requests' | 'latency' | 'tokens' | 'errors',
  duration: '1h' | '6h' | '24h' = '1h',
  refreshInterval = 10000
) {
  const [data, setData] = useState<Array<{ timestamp: Date; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateData = () => {
      setData(observabilityService.getTimeSeriesData(metric, duration));
      setLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, refreshInterval);

    return () => clearInterval(interval);
  }, [metric, duration, refreshInterval]);

  return { data, loading };
}

/**
 * Hook for service health status
 */
export function useServiceHealth(refreshInterval = 30000) {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await observabilityService.checkServiceHealth();
        setServices(health);
      } catch (e) {
        console.error('Health check failed:', e);
      }
      setLoading(false);
    };

    checkHealth();
    const interval = setInterval(checkHealth, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { services, loading };
}

/**
 * Hook for making LLM requests with automatic tracking
 */
export function useTrackedLLMRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async (
    prompt: string,
    options?: { model?: string }
  ) => {
    setLoading(true);
    setError(null);
    
    const startTime = Date.now();
    const model = options?.model || 'gemini-2.0-flash';
    
    try {
      // Import dynamically to avoid circular deps
      const { vertexAI } = await import('@/lib/vertex-ai/client');
      
      const response = await vertexAI.predict({
        prompt,
        maxTokens: 1024,
        temperature: 0.7,
        model,
      });
      
      const latency = Date.now() - startTime;
      const tokens = response.tokens || Math.ceil(response.text.length / 4);
      
      // Track success
      observabilityService.trackLLMRequest({
        latency,
        tokens,
        success: true,
        model,
      });
      
      observabilityService.addLog({
        level: 'info',
        service: 'llm-service',
        message: `LLM request completed in ${latency}ms`,
        metadata: { model, tokens, promptLength: prompt.length },
      });
      
      setLoading(false);
      return response;
      
    } catch (e) {
      const latency = Date.now() - startTime;
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      
      // Track failure
      observabilityService.trackLLMRequest({
        latency,
        tokens: 0,
        success: false,
        model,
        error: errorMessage,
      });
      
      // Check if we should create an alert
      const llmMetrics = observabilityService.getLLMMetrics();
      if (llmMetrics.failedRequests > 3) {
        observabilityService.addAlert({
          title: 'High LLM Error Rate',
          description: `LLM service experiencing elevated error rate: ${llmMetrics.failedRequests} failures in the last hour`,
          severity: 'warning',
          source: 'llm-service',
        });
      }
      
      setError(errorMessage);
      setLoading(false);
      throw e;
    }
  }, []);

  return { makeRequest, loading, error };
}

export default {
  useMetricsSummary,
  useLLMMetrics,
  useLogs,
  useAlerts,
  useTimeSeriesData,
  useServiceHealth,
  useTrackedLLMRequest,
};
