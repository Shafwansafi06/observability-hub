/**
 * ObservAI Hub - Datadog RUM & Tracing Instrumentation
 * Frontend observability with Real User Monitoring
 */

// Datadog Browser RUM SDK Configuration
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

// Environment variables
const DD_APPLICATION_ID = import.meta.env.VITE_DD_APPLICATION_ID || '';
const DD_CLIENT_TOKEN = import.meta.env.VITE_DD_CLIENT_TOKEN || '';
const DD_SITE = import.meta.env.VITE_DD_SITE || 'datadoghq.com';
const DD_SERVICE = import.meta.env.VITE_DD_SERVICE || 'observai-frontend';
const DD_ENV = import.meta.env.VITE_DD_ENV || import.meta.env.MODE || 'development';
const DD_VERSION = import.meta.env.VITE_DD_VERSION || '1.0.0';

/**
 * Initialize Datadog RUM (Real User Monitoring)
 */
export function initializeDatadogRUM() {
  if (!DD_APPLICATION_ID || !DD_CLIENT_TOKEN) {
    console.warn('⚠️ Datadog RUM not initialized: Missing credentials');
    return;
  }

  datadogRum.init({
    applicationId: DD_APPLICATION_ID,
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    
    // Session configuration
    sessionSampleRate: 100, // 100% of sessions
    sessionReplaySampleRate: 20, // 20% of sessions with replay
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    
    // Default privacy level
    defaultPrivacyLevel: 'mask-user-input',
    
    // Enable tracing
    allowedTracingUrls: [
      { match: /https:\/\/.*\.supabase\.co\/.*/, propagatorTypes: ['datadog'] },
      { match: /https:\/\/.*\.observai\.dev\/.*/, propagatorTypes: ['datadog'] },
      { match: /http:\/\/localhost:.*/, propagatorTypes: ['datadog'] }
    ],
    
    // Custom error tracking
    beforeSend: (event) => {
      // Redact sensitive data
      if (event.type === 'error' && event.error?.stack) {
        event.error.stack = event.error.stack.replace(/apikey_[a-zA-Z0-9]+/g, '[REDACTED]');
        event.error.stack = event.error.stack.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]');
      }
      
      return true;
    },
    
    // Performance tracking
    enableExperimentalFeatures: ['clickmap'],
    
    // Proxy configuration (optional)
    // proxy: 'https://proxy.observai.dev/dd',
  });

  // Start RUM
  datadogRum.startSessionReplayRecording();
  
  console.log('✅ Datadog RUM initialized');
}

/**
 * Initialize Datadog Logs
 */
export function initializeDatadogLogs() {
  if (!DD_CLIENT_TOKEN) {
    console.warn('⚠️ Datadog Logs not initialized: Missing client token');
    return;
  }

  datadogLogs.init({
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    
    // Forward all logs to Datadog
    forwardErrorsToLogs: true,
    forwardConsoleLogs: ['error', 'warn'],
    
    // Session tracking
    sessionSampleRate: 100,
    
    // Custom log context
    beforeSend: (log) => {
      // Add global context
      log.service = DD_SERVICE;
      log.environment = DD_ENV;
      
      // Redact sensitive info
      if (log.message) {
        log.message = log.message.replace(/apikey_[a-zA-Z0-9]+/g, '[REDACTED]');
      }
      
      return true;
    }
  });
  
  console.log('✅ Datadog Logs initialized');
}

/**
 * Track custom user actions
 */
export function trackUserAction(name: string, context?: Record<string, any>) {
  datadogRum.addAction(name, context);
}

/**
 * Track LLM-specific events
 */
export function trackLLMEvent(event: {
  model: string;
  promptTokens: number;
  responseTokens: number;
  latency: number;
  confidence?: number;
  error?: string;
}) {
  datadogRum.addAction('llm_request', {
    'llm.model': event.model,
    'ai.prompt.tokens': event.promptTokens,
    'ai.response.tokens': event.responseTokens,
    'ai.total_tokens': event.promptTokens + event.responseTokens,
    'ai.latency_ms': event.latency,
    'ai.confidence': event.confidence,
    'ai.error': event.error,
    'event.category': 'llm',
  });
  
  // Also log as custom metric
  datadogLogs.logger.info('LLM request completed', {
    llm: {
      model: event.model,
      prompt_tokens: event.promptTokens,
      response_tokens: event.responseTokens,
      total_tokens: event.promptTokens + event.responseTokens,
      latency_ms: event.latency,
      confidence: event.confidence,
    }
  });
}

/**
 * Track hallucination detection events
 */
export function trackHallucinationEvent(event: {
  model: string;
  score: number;
  requestId: string;
  embeddingDistance?: number;
}) {
  datadogRum.addAction('hallucination_detected', {
    'llm.model': event.model,
    'ai.hallucination.score': event.score,
    'ai.request_id': event.requestId,
    'ai.embedding.distance': event.embeddingDistance,
    'event.category': 'safety',
    'alert.severity': event.score > 0.7 ? 'high' : 'medium',
  });
  
  datadogLogs.logger.warn('Hallucination risk detected', {
    llm: { model: event.model },
    ai: {
      hallucination: { score: event.score },
      request_id: event.requestId,
      embedding: { distance: event.embeddingDistance }
    }
  });
}

/**
 * Track errors with context
 */
export function trackError(error: Error, context?: Record<string, any>) {
  datadogRum.addError(error, {
    ...context,
    'error.origin': 'frontend',
    'error.handled': true,
  });
  
  datadogLogs.logger.error(error.message, {
    error: {
      kind: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context
  });
}

/**
 * Set user context
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  name?: string;
  organizationId?: string;
}) {
  datadogRum.setUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  
  // Add organization as global context
  if (user.organizationId) {
    datadogRum.setGlobalContextProperty('organization.id', user.organizationId);
  }
  
  datadogLogs.setUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  datadogRum.clearUser();
  datadogLogs.clearUser();
}

/**
 * Add global context properties
 */
export function addGlobalContext(key: string, value: any) {
  datadogRum.setGlobalContextProperty(key, value);
  datadogLogs.setGlobalContextProperty(key, value);
}

/**
 * Track page view with custom context
 */
export function trackPageView(routeName: string, context?: Record<string, any>) {
  datadogRum.addAction('page_view', {
    'view.name': routeName,
    ...context
  });
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature: string, details?: Record<string, any>) {
  datadogRum.addAction('feature_used', {
    'feature.name': feature,
    ...details
  });
}

/**
 * Custom timing metric
 */
export function trackTiming(name: string, duration: number, context?: Record<string, any>) {
  datadogRum.addTiming(name, duration);
  
  if (context) {
    datadogRum.addAction(name, {
      'timing.duration': duration,
      ...context
    });
  }
}

/**
 * Track WebVitals (Core Web Vitals)
 */
export function initializeWebVitals() {
  // Datadog RUM automatically tracks Web Vitals
  // But we can add custom tracking if needed
  
  if (typeof window !== 'undefined') {
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS((metric) => trackTiming('CLS', metric.value, { metric: 'cls' }));
      onINP((metric) => trackTiming('INP', metric.value, { metric: 'inp' }));
      onFCP((metric) => trackTiming('FCP', metric.value, { metric: 'fcp' }));
      onLCP((metric) => trackTiming('LCP', metric.value, { metric: 'lcp' }));
      onTTFB((metric) => trackTiming('TTFB', metric.value, { metric: 'ttfb' }));
    }).catch(() => {
      // Web Vitals not available
    });
  }
}

/**
 * Performance observer for custom metrics
 */
export function observePerformance() {
  if ('PerformanceObserver' in window) {
    // Observe long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        datadogLogs.logger.warn('Long task detected', {
          task: {
            duration: entry.duration,
            name: entry.name,
            entry_type: entry.entryType
          }
        });
      }
    });
    
    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Browser doesn't support longtask
    }
  }
}

/**
 * Initialize all Datadog monitoring
 */
export function initializeDatadogMonitoring() {
  initializeDatadogRUM();
  initializeDatadogLogs();
  initializeWebVitals();
  observePerformance();
  
  // Add global app context
  addGlobalContext('app.name', 'ObservAI Hub');
  addGlobalContext('app.version', DD_VERSION);
  addGlobalContext('app.environment', DD_ENV);
  
  console.log('✅ Datadog monitoring fully initialized');
}

// Export singleton logger for convenience
export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    datadogLogs.logger.info(message, context);
  },
  warn: (message: string, context?: Record<string, any>) => {
    datadogLogs.logger.warn(message, context);
  },
  error: (message: string, context?: Record<string, any>) => {
    datadogLogs.logger.error(message, context);
  },
  debug: (message: string, context?: Record<string, any>) => {
    datadogLogs.logger.debug(message, context);
  },
};

// Re-export hooks from datadog folder
export { useDatadog, useTimeSeriesData } from './datadog/useDatadog';
export { datadog } from './datadog/client';
export type { ServiceStatus, DatadogMetric, DatadogEvent } from './datadog/client';
