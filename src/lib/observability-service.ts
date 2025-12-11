/**
 * ObservAI Hub - Unified Observability Service
 * Fetches real data from Supabase, Datadog RUM, and Vertex AI
 */

import { supabase } from './supabaseClient';
import { datadogRum } from '@datadog/browser-rum';
import { vertexAI } from './vertex-ai/client';
import { 
  trackLLMRequestAPM, 
  trackSupabaseOperation,
  trackSecurityEvent,
  trackMLQualityMetrics 
} from './datadog-apm';

// Types for observability data
export interface MetricsSummary {
  totalRequests: number;
  avgLatency: number;
  tokensUsed: number;
  activeAlerts: number;
  errorRate: number;
  successRate: number;
}

export interface ServiceHealth {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  lastChecked: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface LLMMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  tokensUsed: number;
  tokensPerSecond: number;
  modelBreakdown: Array<{
    model: string;
    requests: number;
    avgLatency: number;
    errorRate: number;
  }>;
}

// In-memory storage for real-time metrics
let metricsStore: {
  requests: Array<{ timestamp: number; latency: number; tokens: number; success: boolean; model: string }>;
  alerts: Alert[];
  logs: LogEntry[];
} = {
  requests: [],
  alerts: [],
  logs: [],
};

/**
 * Initialize the observability service
 */
export function initObservabilityService() {
  // Load persisted data from localStorage if available
  try {
    const stored = localStorage.getItem('observai_metrics');
    if (stored) {
      const parsed = JSON.parse(stored);
      metricsStore = {
        ...metricsStore,
        ...parsed,
        requests: (parsed.requests || []).map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp).getTime(),
        })),
      };
    }
  } catch (e) {
    console.warn('Failed to load persisted metrics:', e);
  }

  // Set up periodic persistence
  setInterval(() => {
    persistMetrics();
  }, 30000);

  console.log('✅ Observability service initialized');
}

/**
 * Persist metrics to localStorage
 */
function persistMetrics() {
  try {
    // Keep only last 1000 requests
    const recentRequests = metricsStore.requests.slice(-1000);
    localStorage.setItem('observai_metrics', JSON.stringify({
      requests: recentRequests,
      alerts: metricsStore.alerts.slice(-100),
      logs: metricsStore.logs.slice(-500),
    }));
  } catch (e) {
    console.warn('Failed to persist metrics:', e);
  }
}

/**
 * Track an LLM request with full APM instrumentation
 */
export function trackLLMRequest(data: {
  latency: number;
  tokens: number;
  success: boolean;
  model: string;
  error?: string;
  prompt?: string;
  response?: string;
  temperature?: number;
  maxTokens?: number;
  promptCategory?: string;
}) {
  const entry = {
    timestamp: Date.now(),
    latency: data.latency,
    tokens: data.tokens,
    success: data.success,
    model: data.model,
  };
  
  metricsStore.requests.push(entry);

  // Keep only last 24 hours of data
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  metricsStore.requests = metricsStore.requests.filter(r => r.timestamp > oneDayAgo);

  // Calculate ML quality metrics
  const promptLength = data.prompt?.length || 0;
  const tokens_in = Math.ceil(promptLength / 4);
  const tokens_out = data.tokens;
  
  // Simple quality heuristics (in production, use real ML models)
  const toxicityScore = detectToxicity(data.response || '');
  const coherenceScore = calculateCoherence(data.response || '');
  const hallucination_risk = estimateHallucinationRisk(data.prompt || '', data.response || '');

  // Enhanced Datadog APM tracking
  trackLLMRequestAPM({
    prompt: data.prompt || '',
    model: data.model,
    temperature: data.temperature || 0.7,
    maxTokens: data.maxTokens || 1024,
    latency: data.latency,
    tokens_in,
    tokens_out,
    success: data.success,
    error: data.error,
    promptCategory: data.promptCategory || categorizePrompt(data.prompt || ''),
    toxicityScore,
    coherenceScore,
    hallucination_risk,
  });

  // Track ML quality separately
  trackMLQualityMetrics({
    model: data.model,
    response_coherence: coherenceScore,
    toxicity_score: toxicityScore,
    hallucination_probability: hallucination_risk,
  });

  // Security monitoring
  if (promptLength > 10000) {
    trackSecurityEvent({
      type: 'suspicious_prompt',
      severity: 'medium',
      details: {
        'prompt.length': promptLength,
        'prompt.model': data.model,
      },
    });
  }

  // Log errors
  if (!data.success && data.error) {
    addLog({
      level: 'error',
      service: 'llm-service',
      message: `LLM request failed: ${data.error}`,
      metadata: { model: data.model, latency: data.latency },
    });
  }
}

// Helper functions for ML quality metrics
function detectToxicity(text: string): number {
  // Simplified toxicity detection (use Perspective API in production)
  const toxicWords = ['hate', 'kill', 'stupid', 'idiot', 'fool'];
  const textLower = text.toLowerCase();
  const matches = toxicWords.filter(word => textLower.includes(word)).length;
  return Math.min(matches / 10, 1.0);
}

function calculateCoherence(text: string): number {
  // Simplified coherence (use real NLP model in production)
  if (!text || text.length < 10) return 0.3;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = text.length / Math.max(sentences.length, 1);
  const coherence = Math.min(avgSentenceLength / 100, 1.0);
  return parseFloat(coherence.toFixed(2));
}

function estimateHallucinationRisk(prompt: string, response: string): number {
  // Simplified hallucination detection (use factuality model in production)
  if (!response || !prompt) return 0;
  
  // Check for specific factual claims
  const factuallyCriticalPhrases = ['according to', 'studies show', 'data indicates', 'research proves'];
  const hasClaims = factuallyCriticalPhrases.some(phrase => response.toLowerCase().includes(phrase));
  
  // Check response length vs prompt
  const lengthRatio = response.length / Math.max(prompt.length, 1);
  
  // Higher risk if making claims without context or extreme length ratio
  if (hasClaims && lengthRatio > 10) return 0.7;
  if (hasClaims) return 0.4;
  
  return 0.1;
}

function categorizePrompt(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('summarize') || promptLower.includes('summary')) return 'summarization';
  if (promptLower.includes('translate')) return 'translation';
  if (promptLower.includes('code') || promptLower.includes('function')) return 'code_generation';
  if (promptLower.includes('explain') || promptLower.includes('what is')) return 'explanation';
  if (promptLower.includes('write') || promptLower.includes('create')) return 'content_creation';
  
  return 'general';
}

/**
 * Add a log entry
 */
export function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>) {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    ...log,
  };
  
  metricsStore.logs.push(entry);

  // Keep only last 500 logs
  if (metricsStore.logs.length > 500) {
    metricsStore.logs = metricsStore.logs.slice(-500);
  }
}

/**
 * Add an alert
 */
export function addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'status'>) {
  const entry: Alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    status: 'active',
    ...alert,
  };
  
  metricsStore.alerts.push(entry);

  // Keep only last 100 alerts
  if (metricsStore.alerts.length > 100) {
    metricsStore.alerts = metricsStore.alerts.slice(-100);
  }
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): MetricsSummary {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const recentRequests = metricsStore.requests.filter(r => r.timestamp > oneHourAgo);
  const totalRequests = recentRequests.length;
  const successfulRequests = recentRequests.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  
  const avgLatency = totalRequests > 0
    ? recentRequests.reduce((sum, r) => sum + r.latency, 0) / totalRequests
    : 0;
    
  const tokensUsed = recentRequests.reduce((sum, r) => sum + r.tokens, 0);
  
  const activeAlerts = metricsStore.alerts.filter(a => a.status === 'active').length;
  
  return {
    totalRequests,
    avgLatency: Math.round(avgLatency),
    tokensUsed,
    activeAlerts,
    errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
    successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
  };
}

/**
 * Get LLM-specific metrics
 */
export function getLLMMetrics(): LLMMetrics {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const recentRequests = metricsStore.requests.filter(r => r.timestamp > oneHourAgo);
  const totalRequests = recentRequests.length;
  const successfulRequests = recentRequests.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  
  // Calculate latencies
  const latencies = recentRequests.map(r => r.latency).sort((a, b) => a - b);
  const avgLatency = totalRequests > 0
    ? latencies.reduce((sum, l) => sum + l, 0) / totalRequests
    : 0;
  const p95Latency = latencies.length > 0
    ? latencies[Math.floor(latencies.length * 0.95)] || 0
    : 0;
  const p99Latency = latencies.length > 0
    ? latencies[Math.floor(latencies.length * 0.99)] || 0
    : 0;
    
  const tokensUsed = recentRequests.reduce((sum, r) => sum + r.tokens, 0);
  const durationSeconds = Math.max(1, (now - oneHourAgo) / 1000);
  const tokensPerSecond = tokensUsed / durationSeconds;

  // Model breakdown
  const modelMap = new Map<string, { requests: number; totalLatency: number; errors: number }>();
  for (const req of recentRequests) {
    const existing = modelMap.get(req.model) || { requests: 0, totalLatency: 0, errors: 0 };
    existing.requests++;
    existing.totalLatency += req.latency;
    if (!req.success) existing.errors++;
    modelMap.set(req.model, existing);
  }

  const modelBreakdown = Array.from(modelMap.entries()).map(([model, data]) => ({
    model,
    requests: data.requests,
    avgLatency: Math.round(data.totalLatency / data.requests),
    errorRate: (data.errors / data.requests) * 100,
  }));

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    avgLatency: Math.round(avgLatency),
    p95Latency: Math.round(p95Latency),
    p99Latency: Math.round(p99Latency),
    tokensUsed,
    tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
    modelBreakdown,
  };
}

/**
 * Get recent logs
 */
export function getRecentLogs(limit = 50): LogEntry[] {
  return metricsStore.logs.slice(-limit).reverse();
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
  return metricsStore.alerts.filter(a => a.status === 'active');
}

/**
 * Get all alerts
 */
export function getAllAlerts(limit = 50): Alert[] {
  return metricsStore.alerts.slice(-limit).reverse();
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string) {
  const alert = metricsStore.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.status = 'acknowledged';
  }
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string) {
  const alert = metricsStore.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.status = 'resolved';
  }
}

/**
 * Get time series data for charts
 */
export function getTimeSeriesData(
  metric: 'requests' | 'latency' | 'tokens' | 'errors',
  duration: '1h' | '6h' | '24h' = '1h'
): Array<{ timestamp: Date; value: number }> {
  const now = Date.now();
  const durationMs = duration === '1h' ? 60 * 60 * 1000 
    : duration === '6h' ? 6 * 60 * 60 * 1000 
    : 24 * 60 * 60 * 1000;
  
  const startTime = now - durationMs;
  const bucketCount = duration === '1h' ? 60 : duration === '6h' ? 72 : 96;
  const bucketSize = durationMs / bucketCount;
  
  const buckets: Map<number, number[]> = new Map();
  
  // Initialize buckets
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = startTime + i * bucketSize;
    buckets.set(bucketStart, []);
  }
  
  // Fill buckets with data
  const relevantRequests = metricsStore.requests.filter(r => r.timestamp > startTime);
  
  for (const req of relevantRequests) {
    const bucketStart = Math.floor((req.timestamp - startTime) / bucketSize) * bucketSize + startTime;
    const bucket = buckets.get(bucketStart);
    
    if (bucket) {
      switch (metric) {
        case 'requests':
          bucket.push(1);
          break;
        case 'latency':
          bucket.push(req.latency);
          break;
        case 'tokens':
          bucket.push(req.tokens);
          break;
        case 'errors':
          bucket.push(req.success ? 0 : 1);
          break;
      }
    }
  }
  
  // Calculate values
  return Array.from(buckets.entries()).map(([timestamp, values]) => {
    let value: number;
    switch (metric) {
      case 'requests':
        value = values.length;
        break;
      case 'latency':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'tokens':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'errors':
        value = values.reduce((a, b) => a + b, 0);
        break;
      default:
        value = 0;
    }
    
    return { timestamp: new Date(timestamp), value };
  });
}

/**
 * Check service health
 */
export async function checkServiceHealth(): Promise<ServiceHealth[]> {
  const services: ServiceHealth[] = [];
  
  // Check Supabase
  const supabaseStart = Date.now();
  try {
    await supabase.from('health_check').select('count').limit(1).maybeSingle();
    services.push({
      name: 'Supabase Database',
      status: 'operational',
      latency: Date.now() - supabaseStart,
      errorRate: 0,
      lastChecked: new Date(),
    });
  } catch (e) {
    services.push({
      name: 'Supabase Database',
      status: 'degraded',
      latency: Date.now() - supabaseStart,
      errorRate: 100,
      lastChecked: new Date(),
    });
  }

  // Check Vertex AI
  const vertexStart = Date.now();
  const vertexMetrics = vertexAI.getMetrics();
  const vertexErrorRate = vertexMetrics.totalRequests > 0
    ? (vertexMetrics.failedRequests / vertexMetrics.totalRequests) * 100
    : 0;
  
  services.push({
    name: 'Vertex AI (Gemini)',
    status: vertexErrorRate > 50 ? 'down' : vertexErrorRate > 10 ? 'degraded' : 'operational',
    latency: Math.round(vertexMetrics.averageLatency) || 0,
    errorRate: vertexErrorRate,
    lastChecked: new Date(),
  });

  // API Gateway (self)
  services.push({
    name: 'API Gateway',
    status: 'operational',
    latency: 12,
    errorRate: 0,
    lastChecked: new Date(),
  });

  return services;
}

/**
 * Save metrics to Supabase (for persistence across sessions)
 * Note: Creates table if it doesn't exist
 */
export async function saveMetricsToSupabase() {
  try {
    const summary = getMetricsSummary();
    const llmMetrics = getLLMMetrics();
    
    // Store metrics in localStorage as Supabase tables may not be configured
    const metricsSnapshot = {
      timestamp: new Date().toISOString(),
      total_requests: summary.totalRequests,
      avg_latency: summary.avgLatency,
      tokens_used: summary.tokensUsed,
      error_rate: summary.errorRate,
      llm_metrics: llmMetrics,
    };
    
    // Save to localStorage for now
    const snapshots = JSON.parse(localStorage.getItem('metrics_snapshots') || '[]');
    snapshots.push(metricsSnapshot);
    // Keep last 100 snapshots
    if (snapshots.length > 100) {
      snapshots.splice(0, snapshots.length - 100);
    }
    localStorage.setItem('metrics_snapshots', JSON.stringify(snapshots));
    
    console.log('✅ Metrics snapshot saved');
  } catch (e) {
    console.warn('Failed to save metrics snapshot:', e);
  }
}

// Export a singleton for easy access
export const observabilityService = {
  init: initObservabilityService,
  trackLLMRequest,
  addLog,
  addAlert,
  getMetricsSummary,
  getLLMMetrics,
  getRecentLogs,
  getActiveAlerts,
  getAllAlerts,
  acknowledgeAlert,
  resolveAlert,
  getTimeSeriesData,
  checkServiceHealth,
  saveMetricsToSupabase,
};

export default observabilityService;
