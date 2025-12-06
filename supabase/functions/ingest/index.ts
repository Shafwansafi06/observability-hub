/**
 * ObservAI Hub - Ingestion Edge Function
 * 
 * High-throughput data ingestion endpoint for metrics, logs, and traces.
 * Supports batch processing with validation and rate limiting.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { corsHeaders, handleCorsPreFlight, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { authenticate, createAdminClient, type AuthResult } from '../_shared/auth.ts';
import { createCacheClient, checkRateLimit, cacheKeys } from '../_shared/cache.ts';

// =====================================================
// SCHEMAS
// =====================================================

const metricSchema = z.object({
  name: z.string().min(1).max(255),
  value: z.number(),
  type: z.enum(['counter', 'gauge', 'histogram', 'summary']).optional().default('gauge'),
  timestamp: z.string().datetime().optional(),
  environment: z.string().max(50).optional().default('production'),
  model_name: z.string().max(255).optional(),
  endpoint: z.string().max(255).optional(),
  tags: z.record(z.string()).optional().default({}),
  trace_id: z.string().uuid().optional(),
  span_id: z.string().uuid().optional(),
});

const llmMetricSchema = z.object({
  request_id: z.string().uuid(),
  model_name: z.string().min(1).max(255),
  model_provider: z.string().min(1).max(100),
  model_version: z.string().max(50).optional(),
  environment: z.string().max(50).optional().default('production'),
  endpoint: z.string().max(255).optional(),
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0).optional(),
  latency_ms: z.number().int().min(0),
  time_to_first_token_ms: z.number().int().min(0).optional(),
  tokens_per_second: z.number().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  toxicity_score: z.number().min(0).max(1).optional(),
  coherence_score: z.number().min(0).max(1).optional(),
  estimated_cost_cents: z.number().min(0).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  is_error: z.boolean().optional().default(false),
  error_code: z.string().max(50).optional(),
  error_message: z.string().optional(),
  is_streaming: z.boolean().optional().default(false),
  trace_id: z.string().uuid().optional(),
  tags: z.record(z.string()).optional().default({}),
  timestamp: z.string().datetime().optional(),
});

const logSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  source: z.enum(['application', 'llm', 'infrastructure', 'security', 'system']).optional().default('application'),
  message: z.string().min(1).max(65535),
  message_template: z.string().max(1000).optional(),
  attributes: z.record(z.unknown()).optional().default({}),
  environment: z.string().max(50).optional().default('production'),
  service_name: z.string().max(255).optional(),
  service_version: z.string().max(50).optional(),
  host_name: z.string().max(255).optional(),
  trace_id: z.string().uuid().optional(),
  span_id: z.string().uuid().optional(),
  parent_span_id: z.string().uuid().optional(),
  request_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  model_name: z.string().max(255).optional(),
  error_type: z.string().max(255).optional(),
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

const spanSchema = z.object({
  span_id: z.string().uuid(),
  trace_id: z.string().uuid(),
  parent_span_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  kind: z.enum(['internal', 'server', 'client', 'producer', 'consumer']).optional().default('internal'),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  duration_ms: z.number().int().min(0).optional(),
  status: z.enum(['unset', 'ok', 'error']).optional().default('unset'),
  status_message: z.string().optional(),
  service_name: z.string().max(255).optional(),
  service_version: z.string().max(50).optional(),
  is_llm_span: z.boolean().optional().default(false),
  model_name: z.string().max(255).optional(),
  prompt_tokens: z.number().int().min(0).optional(),
  completion_tokens: z.number().int().min(0).optional(),
  attributes: z.record(z.unknown()).optional().default({}),
  events: z.array(z.object({
    name: z.string(),
    timestamp: z.string().datetime(),
    attributes: z.record(z.unknown()).optional().default({}),
  })).optional().default([]),
});

const ingestPayloadSchema = z.object({
  project_id: z.string().uuid(),
  metrics: z.array(metricSchema).optional(),
  llm_metrics: z.array(llmMetricSchema).optional(),
  logs: z.array(logSchema).optional(),
  spans: z.array(spanSchema).optional(),
}).refine(
  (data: { metrics?: unknown[]; llm_metrics?: unknown[]; logs?: unknown[]; spans?: unknown[] }) => 
    data.metrics || data.llm_metrics || data.logs || data.spans,
  { message: 'At least one of metrics, llm_metrics, logs, or spans must be provided' }
);

// Inferred types from schemas
type MetricPayload = z.infer<typeof metricSchema>;
type LLMMetricPayload = z.infer<typeof llmMetricSchema>;
type LogPayload = z.infer<typeof logSchema>;
type SpanPayload = z.infer<typeof spanSchema>;

// =====================================================
// HANDLER
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is allowed', 405);
  }
  
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Authenticate request
    const auth = await authenticate(req);
    
    if (!auth.authenticated) {
      return createErrorResponse('UNAUTHORIZED', auth.error || 'Authentication required', 401);
    }
    
    // Check for write scope
    if (auth.authType === 'api_key' && !auth.scopes?.includes('write')) {
      return createErrorResponse('FORBIDDEN', 'Write scope required', 403);
    }
    
    // Rate limiting
    const cache = createCacheClient();
    const rateLimitKey = auth.authType === 'api_key' 
      ? cacheKeys.rateLimit('apikey', auth.organizationId!)
      : cacheKeys.rateLimit('user', auth.userId!);
    
    const rateLimit = await checkRateLimit(
      cache,
      rateLimitKey,
      auth.rateLimits?.perMinute || 1000,
      60
    );
    
    if (!rateLimit.allowed) {
      return createErrorResponse(
        'RATE_LIMITED',
        'Rate limit exceeded',
        429,
        {
          retry_after: Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
          limit: auth.rateLimits?.perMinute || 1000,
        }
      );
    }
    
    // Parse and validate payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
    }
    
    const validation = ingestPayloadSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        400,
        {
          errors: validation.error.errors.map((e: { path: (string | number)[]; message: string }) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        }
      );
    }
    
    const payload = validation.data;
    
    // Verify project access
    const adminClient = createAdminClient();
    
    // If API key has project_id, verify it matches
    if (auth.projectId && auth.projectId !== payload.project_id) {
      return createErrorResponse(
        'FORBIDDEN',
        'API key is not authorized for this project',
        403
      );
    }
    
    // Verify project exists and belongs to organization
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id, status')
      .eq('id', payload.project_id)
      .single();
    
    if (projectError || !project) {
      return createErrorResponse('NOT_FOUND', 'Project not found', 404);
    }
    
    if (project.organization_id !== auth.organizationId) {
      return createErrorResponse('FORBIDDEN', 'Not authorized for this project', 403);
    }
    
    if (project.status !== 'active') {
      return createErrorResponse('FORBIDDEN', 'Project is not active', 403);
    }
    
    // Prepare insert results
    const results = {
      metrics: { inserted: 0, errors: 0 },
      llm_metrics: { inserted: 0, errors: 0 },
      logs: { inserted: 0, errors: 0 },
      spans: { inserted: 0, errors: 0 },
    };
    
    const timestamp = new Date().toISOString();
    
    // Insert metrics
    if (payload.metrics && payload.metrics.length > 0) {
      const metricsToInsert = payload.metrics.map((m: MetricPayload) => ({
        organization_id: auth.organizationId!,
        project_id: payload.project_id,
        metric_name: m.name,
        metric_type: m.type,
        value: m.value,
        environment: m.environment,
        model_name: m.model_name,
        endpoint: m.endpoint,
        tags: m.tags,
        trace_id: m.trace_id,
        span_id: m.span_id,
        timestamp: m.timestamp || timestamp,
      }));
      
      const { error, count } = await adminClient
        .from('metrics')
        .insert(metricsToInsert);
      
      if (error) {
        console.error('Metrics insert error:', error);
        results.metrics.errors = metricsToInsert.length;
      } else {
        results.metrics.inserted = count || metricsToInsert.length;
      }
    }
    
    // Insert LLM metrics
    if (payload.llm_metrics && payload.llm_metrics.length > 0) {
      const llmMetricsToInsert = payload.llm_metrics.map((m: LLMMetricPayload) => ({
        organization_id: auth.organizationId!,
        project_id: payload.project_id,
        request_id: m.request_id,
        model_name: m.model_name,
        model_provider: m.model_provider,
        model_version: m.model_version,
        environment: m.environment,
        endpoint: m.endpoint,
        prompt_tokens: m.prompt_tokens,
        completion_tokens: m.completion_tokens,
        total_tokens: m.total_tokens || (m.prompt_tokens + m.completion_tokens),
        latency_ms: m.latency_ms,
        time_to_first_token_ms: m.time_to_first_token_ms,
        tokens_per_second: m.tokens_per_second,
        confidence_score: m.confidence_score,
        toxicity_score: m.toxicity_score,
        coherence_score: m.coherence_score,
        estimated_cost_cents: m.estimated_cost_cents,
        temperature: m.temperature,
        max_tokens: m.max_tokens,
        top_p: m.top_p,
        is_error: m.is_error,
        error_code: m.error_code,
        error_message: m.error_message,
        is_streaming: m.is_streaming,
        trace_id: m.trace_id,
        tags: m.tags,
        timestamp: m.timestamp || timestamp,
      }));
      
      const { error, count } = await adminClient
        .from('llm_metrics')
        .insert(llmMetricsToInsert);
      
      if (error) {
        console.error('LLM metrics insert error:', error);
        results.llm_metrics.errors = llmMetricsToInsert.length;
      } else {
        results.llm_metrics.inserted = count || llmMetricsToInsert.length;
      }
    }
    
    // Insert logs
    if (payload.logs && payload.logs.length > 0) {
      const logsToInsert = payload.logs.map((l: LogPayload) => ({
        organization_id: auth.organizationId!,
        project_id: payload.project_id,
        level: l.level,
        source: l.source,
        message: l.message,
        message_template: l.message_template,
        attributes: l.attributes,
        environment: l.environment,
        service_name: l.service_name,
        service_version: l.service_version,
        host_name: l.host_name,
        trace_id: l.trace_id,
        span_id: l.span_id,
        parent_span_id: l.parent_span_id,
        request_id: l.request_id,
        user_id: l.user_id,
        session_id: l.session_id,
        model_name: l.model_name,
        error_type: l.error_type,
        error_message: l.error_message,
        error_stack: l.error_stack,
        timestamp: l.timestamp || timestamp,
      }));
      
      const { error, count } = await adminClient
        .from('logs')
        .insert(logsToInsert);
      
      if (error) {
        console.error('Logs insert error:', error);
        results.logs.errors = logsToInsert.length;
      } else {
        results.logs.inserted = count || logsToInsert.length;
      }
    }
    
    // Insert spans
    if (payload.spans && payload.spans.length > 0) {
      // First, ensure traces exist
      const traceIds = [...new Set(payload.spans.map((s: SpanPayload) => s.trace_id))];
      
      for (const traceId of traceIds) {
        const rootSpan = payload.spans.find((s: SpanPayload) => s.trace_id === traceId && !s.parent_span_id);
        
        await adminClient
          .from('traces')
          .upsert({
            trace_id: traceId,
            organization_id: auth.organizationId!,
            project_id: payload.project_id,
            name: rootSpan?.name || 'Unknown',
            environment: rootSpan?.service_name || 'production',
            service_name: rootSpan?.service_name,
            start_time: rootSpan?.start_time || timestamp,
            root_span_id: rootSpan?.span_id,
            root_span_name: rootSpan?.name,
          }, {
            onConflict: 'trace_id',
          });
      }
      
      const spansToInsert = payload.spans.map((s: SpanPayload) => ({
        span_id: s.span_id,
        trace_id: s.trace_id,
        parent_span_id: s.parent_span_id,
        organization_id: auth.organizationId!,
        project_id: payload.project_id,
        name: s.name,
        kind: s.kind,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_ms: s.duration_ms,
        status: s.status,
        status_message: s.status_message,
        service_name: s.service_name,
        service_version: s.service_version,
        is_llm_span: s.is_llm_span,
        model_name: s.model_name,
        prompt_tokens: s.prompt_tokens,
        completion_tokens: s.completion_tokens,
        attributes: s.attributes,
        events: s.events,
      }));
      
      const { error, count } = await adminClient
        .from('spans')
        .insert(spansToInsert);
      
      if (error) {
        console.error('Spans insert error:', error);
        results.spans.errors = spansToInsert.length;
      } else {
        results.spans.inserted = count || spansToInsert.length;
      }
    }
    
    // Update organization event count
    const totalEvents = 
      results.metrics.inserted + 
      results.llm_metrics.inserted + 
      results.logs.inserted + 
      results.spans.inserted;
    
    if (totalEvents > 0) {
      await adminClient.rpc('increment_event_count', {
        org_id: auth.organizationId,
        count: totalEvents,
      });
    }
    
    const duration = Date.now() - startTime;
    
    return createSuccessResponse(
      {
        request_id: requestId,
        results,
        total_inserted: totalEvents,
        total_errors: 
          results.metrics.errors + 
          results.llm_metrics.errors + 
          results.logs.errors + 
          results.spans.errors,
      },
      200,
      {
        request_id: requestId,
        duration_ms: duration,
        rate_limit: {
          remaining: rateLimit.remaining,
          reset_at: rateLimit.resetAt.toISOString(),
        },
      }
    );
    
  } catch (error) {
    console.error('Ingestion error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      500,
      { request_id: requestId }
    );
  }
});
