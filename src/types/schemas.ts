/**
 * ObservAI Hub - API Types & Zod Schemas
 * 
 * Comprehensive validation schemas and API types for type-safe
 * request/response handling throughout the application.
 */

import { z } from 'zod';

// =====================================================
// BASE SCHEMAS
// =====================================================

export const uuidSchema = z.string().uuid();
export const dateTimeSchema = z.string().datetime();
export const emailSchema = z.string().email();
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).min(3).max(100);

// =====================================================
// ENUM SCHEMAS
// =====================================================

export const orgRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const projectStatusSchema = z.enum(['active', 'paused', 'archived']);
export const subscriptionTierSchema = z.enum(['free', 'pro', 'enterprise']);
export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram', 'summary']);
export const aggregationPeriodSchema = z.enum(['1m', '5m', '15m', '1h', '6h', '1d']);
export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
export const logSourceSchema = z.enum(['application', 'llm', 'infrastructure', 'security', 'system']);
export const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export const alertStatusSchema = z.enum(['pending', 'firing', 'resolved', 'acknowledged', 'silenced']);
export const alertConditionTypeSchema = z.enum(['threshold', 'anomaly', 'absence', 'rate_change', 'pattern']);
export const notificationChannelSchema = z.enum(['email', 'slack', 'pagerduty', 'webhook', 'sms', 'teams']);

// =====================================================
// PAGINATION & QUERY SCHEMAS
// =====================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timeRangeSchema = z.object({
  start: dateTimeSchema,
  end: dateTimeSchema,
});

export const sortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// =====================================================
// INGESTION SCHEMAS (High-throughput API)
// =====================================================

export const metricIngestionSchema = z.object({
  name: z.string().min(1).max(255),
  value: z.number(),
  type: metricTypeSchema.optional().default('gauge'),
  timestamp: dateTimeSchema.optional(),
  environment: z.string().max(50).optional().default('production'),
  model_name: z.string().max(255).optional(),
  endpoint: z.string().max(255).optional(),
  tags: z.record(z.string()).optional().default({}),
  trace_id: uuidSchema.optional(),
  span_id: uuidSchema.optional(),
});

export const batchMetricsIngestionSchema = z.object({
  metrics: z.array(metricIngestionSchema).min(1).max(1000),
});

export const llmMetricIngestionSchema = z.object({
  request_id: uuidSchema,
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
  trace_id: uuidSchema.optional(),
  tags: z.record(z.string()).optional().default({}),
  timestamp: dateTimeSchema.optional(),
});

export const batchLLMMetricsIngestionSchema = z.object({
  metrics: z.array(llmMetricIngestionSchema).min(1).max(500),
});

export const logIngestionSchema = z.object({
  level: logLevelSchema,
  source: logSourceSchema.optional().default('application'),
  message: z.string().min(1).max(65535),
  message_template: z.string().max(1000).optional(),
  attributes: z.record(z.unknown()).optional().default({}),
  environment: z.string().max(50).optional().default('production'),
  service_name: z.string().max(255).optional(),
  service_version: z.string().max(50).optional(),
  host_name: z.string().max(255).optional(),
  trace_id: uuidSchema.optional(),
  span_id: uuidSchema.optional(),
  parent_span_id: uuidSchema.optional(),
  request_id: uuidSchema.optional(),
  user_id: uuidSchema.optional(),
  session_id: uuidSchema.optional(),
  model_name: z.string().max(255).optional(),
  error_type: z.string().max(255).optional(),
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  timestamp: dateTimeSchema.optional(),
});

export const batchLogsIngestionSchema = z.object({
  logs: z.array(logIngestionSchema).min(1).max(1000),
});

// Span ingestion
export const spanIngestionSchema = z.object({
  span_id: uuidSchema,
  trace_id: uuidSchema,
  parent_span_id: uuidSchema.optional(),
  name: z.string().min(1).max(255),
  kind: z.enum(['internal', 'server', 'client', 'producer', 'consumer']).optional().default('internal'),
  start_time: dateTimeSchema,
  end_time: dateTimeSchema.optional(),
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
    timestamp: dateTimeSchema,
    attributes: z.record(z.unknown()).optional().default({}),
  })).optional().default([]),
});

export const batchSpansIngestionSchema = z.object({
  spans: z.array(spanIngestionSchema).min(1).max(500),
});

// Unified ingestion payload
export const ingestPayloadSchema = z.object({
  project_id: uuidSchema,
  metrics: z.array(metricIngestionSchema).optional(),
  llm_metrics: z.array(llmMetricIngestionSchema).optional(),
  logs: z.array(logIngestionSchema).optional(),
  spans: z.array(spanIngestionSchema).optional(),
}).refine(
  data => data.metrics || data.llm_metrics || data.logs || data.spans,
  { message: 'At least one of metrics, llm_metrics, logs, or spans must be provided' }
);

// =====================================================
// ORGANIZATION SCHEMAS
// =====================================================

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional(),
  logo_url: z.string().url().optional(),
  settings: z.object({
    timezone: z.string().optional(),
    date_format: z.string().optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      slack: z.boolean().optional(),
      pagerduty: z.boolean().optional(),
    }).optional(),
    data_retention: z.object({
      logs_days: z.number().int().min(1).max(365).optional(),
      metrics_days: z.number().int().min(1).max(365).optional(),
      traces_days: z.number().int().min(1).max(90).optional(),
    }).optional(),
  }).optional(),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema.exclude(['owner']),
});

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema.exclude(['owner']),
});

// =====================================================
// PROJECT SCHEMAS
// =====================================================

export const createProjectSchema = z.object({
  name: z.string().min(2).max(255),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  environments: z.array(z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: projectStatusSchema.optional(),
  config: z.object({
    ingestion: z.object({
      batch_size: z.number().int().min(1).max(1000).optional(),
      flush_interval_ms: z.number().int().min(100).max(60000).optional(),
      max_batch_delay_ms: z.number().int().min(1000).max(300000).optional(),
    }).optional(),
    sampling: z.object({
      rate: z.number().min(0).max(1).optional(),
      rules: z.array(z.object({
        match: z.record(z.string()),
        rate: z.number().min(0).max(1),
      })).optional(),
    }).optional(),
    pii_masking: z.object({
      enabled: z.boolean().optional(),
      patterns: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

// =====================================================
// API KEY SCHEMAS
// =====================================================

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  project_id: uuidSchema.optional(),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  environment: z.string().max(50).optional().default('production'),
  expires_at: dateTimeSchema.optional(),
  rate_limit_per_minute: z.number().int().min(1).max(100000).optional().default(1000),
  rate_limit_per_day: z.number().int().min(1).max(10000000).optional().default(100000),
});

export const revokeApiKeySchema = z.object({
  reason: z.string().max(500).optional(),
});

// =====================================================
// ALERT RULE SCHEMAS
// =====================================================

export const alertConditionConfigSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'ne']),
  threshold: z.number(),
  for_duration: z.string().regex(/^\d+[smhd]$/),
});

export const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  project_id: uuidSchema.optional(),
  severity: alertSeveritySchema,
  condition_type: alertConditionTypeSchema,
  condition_config: alertConditionConfigSchema,
  query: z.string().min(1),
  evaluation_interval_seconds: z.number().int().min(10).max(3600).optional().default(60),
  pending_period_seconds: z.number().int().min(0).max(3600).optional().default(300),
  labels: z.record(z.string()).optional().default({}),
  annotations: z.record(z.string()).optional().default({}),
  group_by: z.array(z.string()).optional().default([]),
  notification_channels: z.array(uuidSchema).optional().default([]),
  auto_resolve: z.boolean().optional().default(true),
  resolve_after_seconds: z.number().int().min(60).max(86400).optional().default(300),
});

export const updateAlertRuleSchema = createAlertRuleSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const silenceAlertRuleSchema = z.object({
  silenced_until: dateTimeSchema,
  reason: z.string().max(500).optional(),
});

// =====================================================
// NOTIFICATION CHANNEL SCHEMAS
// =====================================================

export const emailChannelConfigSchema = z.object({
  to: z.array(emailSchema).min(1),
  cc: z.array(emailSchema).optional().default([]),
  subject_template: z.string().optional(),
});

export const slackChannelConfigSchema = z.object({
  webhook_url: z.string().url(),
  channel: z.string().optional(),
  username: z.string().optional(),
  icon_emoji: z.string().optional(),
});

export const pagerdutyChannelConfigSchema = z.object({
  routing_key: z.string().min(1),
  severity_map: z.record(z.enum(['info', 'warning', 'error', 'critical'])).optional(),
});

export const webhookChannelConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).optional().default('POST'),
  headers: z.record(z.string()).optional().default({}),
  body_template: z.string().optional(),
});

export const createNotificationChannelSchema = z.object({
  name: z.string().min(1).max(255),
  channel_type: notificationChannelSchema,
  config: z.union([
    emailChannelConfigSchema,
    slackChannelConfigSchema,
    pagerdutyChannelConfigSchema,
    webhookChannelConfigSchema,
    z.record(z.unknown()),
  ]),
  rate_limit_per_hour: z.number().int().min(1).max(1000).optional().default(100),
});

export const updateNotificationChannelSchema = createNotificationChannelSchema.partial().extend({
  enabled: z.boolean().optional(),
});

// =====================================================
// QUERY SCHEMAS
// =====================================================

export const metricsQuerySchema = z.object({
  project_id: uuidSchema,
  metric_name: z.string().optional(),
  environment: z.string().optional(),
  model_name: z.string().optional(),
  start_time: dateTimeSchema,
  end_time: dateTimeSchema,
  granularity: aggregationPeriodSchema.optional().default('1h'),
}).merge(paginationSchema.partial());

export const logsQuerySchema = z.object({
  project_id: uuidSchema,
  query: z.string().optional(),
  levels: z.array(logLevelSchema).optional(),
  sources: z.array(logSourceSchema).optional(),
  service_name: z.string().optional(),
  trace_id: uuidSchema.optional(),
  start_time: dateTimeSchema,
  end_time: dateTimeSchema,
}).merge(paginationSchema);

export const alertsQuerySchema = z.object({
  project_id: uuidSchema.optional(),
  status: z.array(alertStatusSchema).optional(),
  severity: z.array(alertSeveritySchema).optional(),
  start_time: dateTimeSchema.optional(),
  end_time: dateTimeSchema.optional(),
}).merge(paginationSchema);

export const anomaliesQuerySchema = z.object({
  project_id: uuidSchema,
  anomaly_type: z.string().optional(),
  status: z.enum(['new', 'investigating', 'confirmed', 'false_positive', 'resolved']).optional(),
  severity: alertSeveritySchema.optional(),
  start_time: dateTimeSchema,
  end_time: dateTimeSchema,
}).merge(paginationSchema);

// =====================================================
// ACTION SCHEMAS
// =====================================================

export const acknowledgeAlertSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const resolveAlertSchema = z.object({
  resolution_note: z.string().max(1000).optional(),
});

export const addAlertCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const updateAnomalyStatusSchema = z.object({
  status: z.enum(['investigating', 'confirmed', 'false_positive', 'resolved']),
  notes: z.string().max(5000).optional(),
});

// =====================================================
// SAVED SEARCH SCHEMAS
// =====================================================

export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  query: z.string().min(1),
  filters: z.record(z.unknown()).optional().default({}),
  columns: z.array(z.string()).optional().default(['timestamp', 'level', 'message']),
  sort_by: z.string().optional().default('timestamp'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  is_shared: z.boolean().optional().default(false),
});

export const updateSavedSearchSchema = createSavedSearchSchema.partial();

// =====================================================
// RESPONSE SCHEMAS
// =====================================================

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    meta: z.object({
      request_id: uuidSchema,
      timestamp: dateTimeSchema,
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        total_pages: z.number(),
      }).optional(),
    }),
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      total_pages: z.number(),
      has_next: z.boolean(),
      has_prev: z.boolean(),
    }),
  });

// =====================================================
// TYPE EXPORTS
// =====================================================

export type MetricIngestion = z.infer<typeof metricIngestionSchema>;
export type BatchMetricsIngestion = z.infer<typeof batchMetricsIngestionSchema>;
export type LLMMetricIngestion = z.infer<typeof llmMetricIngestionSchema>;
export type BatchLLMMetricsIngestion = z.infer<typeof batchLLMMetricsIngestionSchema>;
export type LogIngestion = z.infer<typeof logIngestionSchema>;
export type BatchLogsIngestion = z.infer<typeof batchLogsIngestionSchema>;
export type SpanIngestion = z.infer<typeof spanIngestionSchema>;
export type BatchSpansIngestion = z.infer<typeof batchSpansIngestionSchema>;
export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRole = z.infer<typeof updateMemberRoleSchema>;

export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type CreateApiKey = z.infer<typeof createApiKeySchema>;
export type RevokeApiKey = z.infer<typeof revokeApiKeySchema>;

export type AlertConditionConfig = z.infer<typeof alertConditionConfigSchema>;
export type CreateAlertRule = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRule = z.infer<typeof updateAlertRuleSchema>;
export type SilenceAlertRule = z.infer<typeof silenceAlertRuleSchema>;

export type CreateNotificationChannel = z.infer<typeof createNotificationChannelSchema>;
export type UpdateNotificationChannel = z.infer<typeof updateNotificationChannelSchema>;

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type LogsQuery = z.infer<typeof logsQuerySchema>;
export type AlertsQuery = z.infer<typeof alertsQuerySchema>;
export type AnomaliesQuery = z.infer<typeof anomaliesQuerySchema>;

export type AcknowledgeAlert = z.infer<typeof acknowledgeAlertSchema>;
export type ResolveAlert = z.infer<typeof resolveAlertSchema>;
export type AddAlertComment = z.infer<typeof addAlertCommentSchema>;
export type UpdateAnomalyStatus = z.infer<typeof updateAnomalyStatusSchema>;

export type CreateSavedSearch = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearch = z.infer<typeof updateSavedSearchSchema>;

export type Pagination = z.infer<typeof paginationSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
