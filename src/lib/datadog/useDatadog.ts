import { useState, useEffect, useCallback } from 'react';
import { datadog, ServiceStatus } from './client';

export interface UseDatadogReturn {
  services: ServiceStatus[];
  systemMetrics: {
    cpu: number;
    memory: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
  } | null;
  alertStats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    resolved24h: number;
  } | null;
  events: Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error' | 'critical';
    service: string;
    message: string;
  }>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDatadog(autoRefresh = true, refreshInterval = 30000): UseDatadogReturn {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<UseDatadogReturn['systemMetrics']>(null);
  const [alertStats, setAlertStats] = useState<UseDatadogReturn['alertStats']>(null);
  const [events, setEvents] = useState<UseDatadogReturn['events']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      
      const [serviceData, systemData, alertData, eventData] = await Promise.all([
        datadog.getServiceMetrics(),
        datadog.getSystemMetrics(),
        datadog.getAlertStats(),
        datadog.getRecentEvents(),
      ]);

      setServices(serviceData);
      setSystemMetrics(systemData);
      setAlertStats(alertData);
      setEvents(eventData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, autoRefresh, refreshInterval]);

  return {
    services,
    systemMetrics,
    alertStats,
    events,
    loading,
    error,
    refresh,
  };
}

export function useTimeSeriesData(
  metric: string,
  duration: '1h' | '6h' | '24h' | '7d' = '1h',
  autoRefresh = true
) {
  const [data, setData] = useState<Array<{ timestamp: Date; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await datadog.getTimeSeriesData(metric, duration);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch time series data');
    } finally {
      setLoading(false);
    }
  }, [metric, duration]);

  useEffect(() => {
    refresh();

    if (autoRefresh) {
      const interval = setInterval(refresh, 60000);
      return () => clearInterval(interval);
    }
  }, [refresh, autoRefresh]);

  return { data, loading, error, refresh };
}

export default useDatadog;
