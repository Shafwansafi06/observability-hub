/**
 * Datadog Client for Observability Hub
 * Provides metrics fetching and monitoring capabilities
 */

const DD_API_KEY = import.meta.env.DD_API_KEY || import.meta.env.VITE_DD_API_KEY;
const DD_SITE = import.meta.env.VITE_DD_SITE || 'datadoghq.com';

export interface DatadogMetric {
  metric: string;
  points: Array<[number, number]>;
  type: 'gauge' | 'rate' | 'count';
  host?: string;
  tags?: string[];
}

export interface DatadogEvent {
  title: string;
  text: string;
  priority?: 'normal' | 'low';
  tags?: string[];
  alert_type?: 'error' | 'warning' | 'info' | 'success';
}

export interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  requestsPerSecond: number;
}

class DatadogClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `https://api.${DD_SITE}`;
    this.headers = {
      'Content-Type': 'application/json',
      'DD-API-KEY': DD_API_KEY || '',
    };
  }

  /**
   * Check if Datadog is configured
   */
  isConfigured(): boolean {
    return !!DD_API_KEY;
  }

  /**
   * Get simulated service metrics (for demo purposes)
   * In production, this would fetch from Datadog API
   */
  async getServiceMetrics(): Promise<ServiceStatus[]> {
    // Simulated metrics for demo
    return [
      {
        name: 'API Gateway',
        status: 'operational',
        latency: 45 + Math.random() * 20,
        errorRate: 0.1 + Math.random() * 0.2,
        requestsPerSecond: 1200 + Math.random() * 300,
      },
      {
        name: 'LLM Service',
        status: 'operational',
        latency: 850 + Math.random() * 200,
        errorRate: 0.5 + Math.random() * 0.3,
        requestsPerSecond: 150 + Math.random() * 50,
      },
      {
        name: 'Database',
        status: 'operational',
        latency: 12 + Math.random() * 8,
        errorRate: 0.01 + Math.random() * 0.02,
        requestsPerSecond: 3500 + Math.random() * 500,
      },
      {
        name: 'Cache Layer',
        status: 'operational',
        latency: 2 + Math.random() * 3,
        errorRate: 0.001,
        requestsPerSecond: 8000 + Math.random() * 1000,
      },
      {
        name: 'ML Pipeline',
        status: Math.random() > 0.9 ? 'degraded' : 'operational',
        latency: 1200 + Math.random() * 400,
        errorRate: 1.2 + Math.random() * 0.5,
        requestsPerSecond: 45 + Math.random() * 15,
      },
    ];
  }

  /**
   * Get system-wide metrics
   */
  async getSystemMetrics(): Promise<{
    cpu: number;
    memory: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
  }> {
    // Simulated system metrics
    return {
      cpu: 35 + Math.random() * 25,
      memory: 62 + Math.random() * 15,
      diskUsage: 45 + Math.random() * 10,
      networkIn: 150 + Math.random() * 50,
      networkOut: 80 + Math.random() * 30,
    };
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
    resolved24h: number;
  }> {
    return {
      total: 23,
      critical: 2,
      warning: 8,
      info: 13,
      resolved24h: 15,
    };
  }

  /**
   * Get recent events/logs
   */
  async getRecentEvents(): Promise<Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error' | 'critical';
    service: string;
    message: string;
  }>> {
    const services = ['api-gateway', 'llm-service', 'auth-service', 'ml-pipeline', 'database'];
    const levels: Array<'info' | 'warning' | 'error' | 'critical'> = ['info', 'warning', 'error', 'critical'];
    const messages = [
      'Request completed successfully',
      'High latency detected',
      'Connection timeout',
      'Rate limit exceeded',
      'Model inference completed',
      'Cache miss - fetching from source',
      'Authentication failed',
      'Batch processing started',
      'Memory usage above threshold',
      'New deployment detected',
    ];

    return Array.from({ length: 20 }, (_, i) => ({
      id: `evt-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 30000),
      level: levels[Math.floor(Math.random() * levels.length)],
      service: services[Math.floor(Math.random() * services.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
    }));
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(
    metric: string,
    duration: '1h' | '6h' | '24h' | '7d' = '1h'
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const points = duration === '1h' ? 60 : duration === '6h' ? 72 : duration === '24h' ? 96 : 168;
    const interval = duration === '1h' ? 60000 : duration === '6h' ? 300000 : duration === '24h' ? 900000 : 3600000;
    
    let baseValue = 50;
    const data: Array<{ timestamp: Date; value: number }> = [];

    for (let i = points - 1; i >= 0; i--) {
      baseValue += (Math.random() - 0.5) * 10;
      baseValue = Math.max(10, Math.min(100, baseValue));
      
      data.push({
        timestamp: new Date(Date.now() - i * interval),
        value: baseValue + Math.random() * 5,
      });
    }

    return data;
  }

  /**
   * Submit a custom metric
   */
  async submitMetric(metric: DatadogMetric): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Datadog not configured - metric not submitted');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/series`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ series: [metric] }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to submit metric:', error);
      return false;
    }
  }

  /**
   * Submit a custom event
   */
  async submitEvent(event: DatadogEvent): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('Datadog not configured - event not submitted');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(event),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to submit event:', error);
      return false;
    }
  }
}

// Export singleton instance
export const datadog = new DatadogClient();
export default datadog;
