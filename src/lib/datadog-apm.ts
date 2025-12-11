/**
 * Datadog APM + Enhanced Logging Integration
 * Competition-grade instrumentation for LLM observability
 */

import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

// Environment configuration
const DD_ENV = import.meta.env.VITE_DD_ENV || 'production';
const DD_SERVICE = 'observai-hub';
const DD_VERSION = '1.0.0';

/**
 * Initialize Datadog RUM with enhanced configuration
 */
export function initializeDatadogMonitoring() {
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN;
  const applicationId = import.meta.env.VITE_DD_APPLICATION_ID;
  const site = import.meta.env.VITE_DD_SITE || 'datadoghq.com';

  if (!clientToken || !applicationId) {
    console.warn('⚠️ Datadog credentials missing - monitoring disabled');
    return;
  }

  // Initialize RUM
  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: [
      'https://generativelanguage.googleapis.com',
      { match: /https:\/\/.*\.supabase\.co/, propagatorTypes: ['tracecontext'] },
    ],
    enableExperimentalFeatures: ['clickmap'],
  });

  // Initialize Logs
  datadogLogs.init({
    clientToken,
    site,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });

  // Set global context
  datadogRum.setGlobalContextProperty('team', 'observai-engineering');
  datadogRum.setGlobalContextProperty('product', 'llm-observability');
  
  datadogLogs.setGlobalContextProperty('team', 'observai-engineering');
  datadogLogs.setGlobalContextProperty('product', 'llm-observability');

  console.log('✅ Datadog RUM + Logs initialized');
}

/**
 * Track LLM Request with full APM span and enriched metadata
 */
export function trackLLMRequestAPM(data: {
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  latency: number;
  tokens_in: number;
  tokens_out: number;
  success: boolean;
  error?: string;
  cost?: number;
  promptCategory?: string;
  toxicityScore?: number;
  coherenceScore?: number;
  hallucination_risk?: number;
}) {
  const spanId = `llm-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create RUM action for the LLM request
  datadogRum.addAction('llm_inference', {
    // Core metrics
    'llm.model': data.model,
    'llm.latency_ms': data.latency,
    'llm.tokens.input': data.tokens_in,
    'llm.tokens.output': data.tokens_out,
    'llm.tokens.total': data.tokens_in + data.tokens_out,
    'llm.temperature': data.temperature,
    'llm.max_tokens': data.maxTokens,
    'llm.success': data.success,
    
    // Cost tracking
    'llm.cost_usd': data.cost || calculateCost(data.tokens_in, data.tokens_out, data.model),
    
    // Prompt analysis
    'llm.prompt.length': data.prompt.length,
    'llm.prompt.category': data.promptCategory || 'general',
    'llm.prompt.word_count': data.prompt.split(/\s+/).length,
    
    // ML Observability signals
    'llm.quality.toxicity_score': data.toxicityScore || 0,
    'llm.quality.coherence_score': data.coherenceScore || 0,
    'llm.quality.hallucination_risk': data.hallucination_risk || 0,
    
    // Performance
    'llm.performance.tokens_per_second': (data.tokens_out / (data.latency / 1000)).toFixed(2),
    
    // Error tracking
    'llm.error': data.error || null,
    'llm.error_type': data.error ? classifyError(data.error) : null,
    
    // Session correlation
    'rum.session_id': datadogRum.getInternalContext()?.session_id,
    'rum.view_id': datadogRum.getInternalContext()?.view?.id,
    
    // Span ID for tracing
    'trace.span_id': spanId,
  });

  // Send enriched log
  const logContext = {
    service: 'vertex-ai-client',
    'llm.model': data.model,
    'llm.latency_ms': data.latency,
    'llm.tokens.total': data.tokens_in + data.tokens_out,
    'llm.success': data.success,
    'llm.error': data.error,
    'llm.cost_usd': data.cost || calculateCost(data.tokens_in, data.tokens_out, data.model),
    'trace.span_id': spanId,
  };
  
  if (data.success) {
    datadogLogs.logger.info('LLM Inference Complete', logContext);
  } else {
    datadogLogs.logger.error('LLM Inference Failed', logContext);
  }

  // Track anomalies
  if (data.latency > 5000) {
    datadogLogs.logger.warn('High Latency Detected', {
      'llm.latency_ms': data.latency,
      'llm.model': data.model,
      'alert.type': 'latency_spike',
    });
  }

  if (data.hallucination_risk && data.hallucination_risk > 0.7) {
    datadogLogs.logger.warn('High Hallucination Risk', {
      'llm.hallucination_risk': data.hallucination_risk,
      'llm.model': data.model,
      'alert.type': 'hallucination_risk',
    });
  }

  if (data.toxicityScore && data.toxicityScore > 0.5) {
    datadogLogs.logger.error('Toxic Content Detected', {
      'llm.toxicity_score': data.toxicityScore,
      'llm.model': data.model,
      'alert.type': 'content_safety',
    });
  }
}

/**
 * Track Supabase operations
 */
export function trackSupabaseOperation(operation: {
  type: 'query' | 'insert' | 'update' | 'delete';
  table: string;
  duration: number;
  success: boolean;
  error?: string;
  rowCount?: number;
}) {
  datadogRum.addAction('supabase_operation', {
    'db.operation': operation.type,
    'db.table': operation.table,
    'db.duration_ms': operation.duration,
    'db.success': operation.success,
    'db.row_count': operation.rowCount || 0,
    'db.error': operation.error,
  });

  datadogLogs.logger.info('Supabase Operation', {
    service: 'supabase-client',
    'db.operation': operation.type,
    'db.table': operation.table,
    'db.duration_ms': operation.duration,
    'db.success': operation.success,
  });
}

/**
 * Track security events
 */
export function trackSecurityEvent(event: {
  type: 'rate_limit' | 'api_abuse' | 'key_leak' | 'suspicious_prompt' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  userId?: string;
}) {
  datadogRum.addAction('security_event', {
    'security.event_type': event.type,
    'security.severity': event.severity,
    'security.user_id': event.userId,
    ...event.details,
  });

  datadogLogs.logger.error('Security Event Detected', {
    service: 'security-monitor',
    'security.event_type': event.type,
    'security.severity': event.severity,
    ...event.details,
  });
}

/**
 * Track ML quality metrics
 */
export function trackMLQualityMetrics(metrics: {
  model: string;
  embeddings_distance?: number;
  semantic_drift?: number;
  response_coherence?: number;
  factual_accuracy?: number;
  toxicity_score?: number;
  hallucination_probability?: number;
}) {
  datadogRum.addAction('ml_quality_check', {
    'ml.model': metrics.model,
    'ml.quality.embeddings_distance': metrics.embeddings_distance,
    'ml.quality.semantic_drift': metrics.semantic_drift,
    'ml.quality.coherence': metrics.response_coherence,
    'ml.quality.factual_accuracy': metrics.factual_accuracy,
    'ml.quality.toxicity': metrics.toxicity_score,
    'ml.quality.hallucination_prob': metrics.hallucination_probability,
  });

  datadogLogs.logger.info('ML Quality Metrics', {
    service: 'ml-observability',
    'ml.model': metrics.model,
    ...metrics,
  });
}

/**
 * Track custom business metrics
 */
export function trackBusinessMetric(metric: {
  name: string;
  value: number;
  tags?: Record<string, string>;
}) {
  datadogRum.addAction('business_metric', {
    'metric.name': metric.name,
    'metric.value': metric.value,
    ...metric.tags,
  });
}

/**
 * Calculate cost based on model and tokens
 */
function calculateCost(tokensIn: number, tokensOut: number, model: string): number {
  // Pricing per 1M tokens (approximate) - Updated for latest models
  const pricing: Record<string, { input: number; output: number }> = {
    // Gemini 2.5 Series (Latest)
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-flash-lite': { input: 0.05, output: 0.20 },
    'gemini-2.5-pro': { input: 1.25, output: 5.00 },
    
    // Gemini 2.0 Series
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
    'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 }, // Experimental (free)
    'gemini-2.0-flash-lite': { input: 0.05, output: 0.20 },
    
    // Legacy models
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    
    // Image models (per image) - Legacy
    'imagen-3.0-generate-001': { input: 0.02, output: 0.0 },
    'imagen-3.0-fast-001': { input: 0.015, output: 0.0 },
    'imagen-4.0-fast-generate': { input: 0.02, output: 0.0 },
    'imagen-4.0-generate': { input: 0.04, output: 0.0 },
    'imagen-4.0-ultra-generate': { input: 0.08, output: 0.0 },
  };

  const modelPricing = pricing[model] || pricing['gemini-2.5-flash'];
  
  // For legacy Imagen models, cost is per image (tokensIn represents number of images)
  if (model.includes('imagen') && !model.includes('gemini')) {
    return parseFloat((tokensIn * modelPricing.input).toFixed(6));
  }
  
  // For all Gemini models (including multi-modal), calculate based on tokens
  const costIn = (tokensIn / 1_000_000) * modelPricing.input;
  const costOut = (tokensOut / 1_000_000) * modelPricing.output;
  
  return parseFloat((costIn + costOut).toFixed(6));
}

/**
 * Classify error type for better alerting
 */
function classifyError(error: string): string {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('quota') || errorLower.includes('rate limit')) return 'quota_exceeded';
  if (errorLower.includes('timeout')) return 'timeout';
  if (errorLower.includes('network') || errorLower.includes('fetch')) return 'network_error';
  if (errorLower.includes('auth') || errorLower.includes('permission')) return 'auth_error';
  if (errorLower.includes('model') || errorLower.includes('not found')) return 'model_error';
  if (errorLower.includes('token')) return 'token_error';
  
  return 'unknown_error';
}

/**
 * Set user context for RUM
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
}) {
  datadogRum.setUser({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
  });

  datadogLogs.setUserProperty('id', user.id);
  datadogLogs.setUserProperty('role', user.role);
}

/**
 * Report error with full context
 */
export function reportError(error: Error, context?: Record<string, any>) {
  datadogRum.addError(error, {
    ...context,
    'error.timestamp': new Date().toISOString(),
  });

  datadogLogs.logger.error(error.message, {
    error: {
      kind: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

export { datadogRum, datadogLogs };
