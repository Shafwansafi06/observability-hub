/**
 * ObservAI Hub - Database Types
 * Auto-generated from PostgreSQL schema
 * 
 * These types represent the database schema and should be used
 * for type-safe database operations throughout the application.
 */

// =====================================================
// ENUMS
// =====================================================

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectStatus = 'active' | 'paused' | 'archived';
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AggregationPeriod = '1m' | '5m' | '15m' | '1h' | '6h' | '1d';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogSource = 'application' | 'llm' | 'infrastructure' | 'security' | 'system';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'pending' | 'firing' | 'resolved' | 'acknowledged' | 'silenced';
export type AlertConditionType = 'threshold' | 'anomaly' | 'absence' | 'rate_change' | 'pattern';
export type NotificationChannel = 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms' | 'teams';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

// =====================================================
// JSON TYPES
// =====================================================

export interface OrganizationSettings {
  timezone: string;
  date_format: string;
  notifications: {
    email: boolean;
    slack: boolean;
    pagerduty: boolean;
  };
  data_retention: {
    logs_days: number;
    metrics_days: number;
    traces_days: number;
  };
}

export interface ProjectConfig {
  ingestion: {
    batch_size: number;
    flush_interval_ms: number;
    max_batch_delay_ms: number;
  };
  sampling: {
    rate: number;
    rules: SamplingRule[];
  };
  pii_masking: {
    enabled: boolean;
    patterns: string[];
  };
}

export interface SamplingRule {
  match: Record<string, string>;
  rate: number;
}

export interface ProjectEnvironment {
  name: string;
  color: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  email_notifications: boolean;
  weekly_digest: boolean;
}

export interface AlertConditionConfig {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  threshold: number;
  for_duration: string;
}

export interface Percentiles {
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface SpanLink {
  trace_id: string;
  span_id: string;
  attributes: Record<string, unknown>;
}

// =====================================================
// TABLE TYPES
// =====================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  max_projects: number;
  max_events_per_month: number;
  max_retention_days: number;
  max_members: number;
  current_events_count: number;
  events_reset_at: string;
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: UserPreferences;
  current_organization_id: string | null;
  gdpr_consent_at: string | null;
  marketing_consent: boolean;
  data_processing_consent: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  config: ProjectConfig;
  environments: ProjectEnvironment[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ApiKey {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  environment: string;
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  created_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_date: string;
}

export interface MetricDefinition {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  display_name: string | null;
  description: string | null;
  unit: string | null;
  metric_type: MetricType;
  aggregation_methods: string[];
  warning_threshold: number | null;
  critical_threshold: number | null;
  threshold_direction: 'above' | 'below';
  tag_schema: Record<string, unknown>;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Metric {
  id: string;
  organization_id: string;
  project_id: string;
  metric_name: string;
  metric_type: MetricType;
  value: number;
  environment: string;
  model_name: string | null;
  endpoint: string | null;
  tags: Record<string, string>;
  trace_id: string | null;
  span_id: string | null;
  timestamp: string;
  ingested_at: string;
}

export interface MetricsAggregated {
  id: string;
  organization_id: string;
  project_id: string;
  metric_name: string;
  period: AggregationPeriod;
  period_start: string;
  period_end: string;
  count: number;
  sum: number;
  avg: number;
  min: number | null;
  max: number | null;
  percentiles: Percentiles;
  environment: string;
  model_name: string | null;
  tags: Record<string, string>;
  created_at: string;
}

export interface LLMMetric {
  id: string;
  organization_id: string;
  project_id: string;
  request_id: string;
  trace_id: string | null;
  model_name: string;
  model_provider: string;
  model_version: string | null;
  environment: string;
  endpoint: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  time_to_first_token_ms: number | null;
  tokens_per_second: number | null;
  confidence_score: number | null;
  toxicity_score: number | null;
  coherence_score: number | null;
  estimated_cost_cents: number | null;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  is_error: boolean;
  error_code: string | null;
  error_message: string | null;
  is_streaming: boolean;
  tags: Record<string, string>;
  timestamp: string;
  ingested_at: string;
}

export interface Log {
  id: string;
  organization_id: string;
  project_id: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  message_template: string | null;
  attributes: Record<string, unknown>;
  environment: string;
  service_name: string | null;
  service_version: string | null;
  host_name: string | null;
  trace_id: string | null;
  span_id: string | null;
  parent_span_id: string | null;
  request_id: string | null;
  user_id: string | null;
  session_id: string | null;
  model_name: string | null;
  prompt_hash: string | null;
  error_type: string | null;
  error_message: string | null;
  error_stack: string | null;
  timestamp: string;
  ingested_at: string;
}

export interface Trace {
  id: string;
  trace_id: string;
  organization_id: string;
  project_id: string;
  name: string;
  environment: string;
  service_name: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'unset' | 'ok' | 'error';
  status_message: string | null;
  span_count: number;
  error_count: number;
  root_span_id: string | null;
  root_span_name: string | null;
  user_id: string | null;
  session_id: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Span {
  id: string;
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  organization_id: string;
  project_id: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  status: 'unset' | 'ok' | 'error';
  status_message: string | null;
  service_name: string | null;
  service_version: string | null;
  is_llm_span: boolean;
  model_name: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  links: SpanLink[];
  created_at: string;
}

export interface LogPattern {
  id: string;
  organization_id: string;
  project_id: string | null;
  pattern_hash: string;
  pattern_template: string;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  level: LogLevel | null;
  source: LogSource | null;
  service_name: string | null;
  is_error: boolean;
  is_anomaly: boolean;
  title: string | null;
  description: string | null;
  tags: string[];
  is_muted: boolean;
  muted_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  description: string | null;
  query: string;
  filters: Record<string, unknown>;
  columns: string[];
  sort_by: string;
  sort_order: 'asc' | 'desc';
  is_shared: boolean;
  shared_with_org: boolean;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: AlertSeverity;
  condition_type: AlertConditionType;
  condition_config: AlertConditionConfig;
  query: string;
  evaluation_interval_seconds: number;
  pending_period_seconds: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  group_by: string[];
  notification_channels: string[];
  auto_resolve: boolean;
  resolve_after_seconds: number;
  is_silenced: boolean;
  silenced_until: string | null;
  silenced_by: string | null;
  silence_reason: string | null;
  last_evaluation_at: string | null;
  last_fired_at: string | null;
  fire_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  organization_id: string;
  project_id: string | null;
  alert_rule_id: string;
  fingerprint: string;
  status: AlertStatus;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  current_value: number | null;
  threshold_value: number | null;
  source: string | null;
  environment: string;
  model_name: string | null;
  trace_id: string | null;
  related_alerts: string[];
  started_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_type: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelConfig {
  id: string;
  organization_id: string;
  name: string;
  channel_type: NotificationChannel;
  config: Record<string, unknown>;
  enabled: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  rate_limit_per_hour: number;
  total_sent: number;
  total_failed: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationHistory {
  id: string;
  organization_id: string;
  alert_id: string | null;
  channel_id: string | null;
  channel_type: NotificationChannel;
  status: NotificationStatus;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
}

export interface Anomaly {
  id: string;
  organization_id: string;
  project_id: string;
  anomaly_type: string;
  detection_method: string;
  severity: AlertSeverity;
  confidence_score: number;
  metric_name: string | null;
  model_name: string | null;
  environment: string;
  observed_value: number;
  expected_value: number;
  baseline_mean: number | null;
  baseline_stddev: number | null;
  deviation_score: number;
  affected_requests: number | null;
  affected_users: number | null;
  status: 'new' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';
  related_alert_id: string | null;
  related_trace_ids: string[];
  investigated_by: string | null;
  investigation_notes: string | null;
  detected_at: string;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OncallSchedule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  timezone: string;
  rotation_type: 'daily' | 'weekly' | 'custom';
  rotation_config: Record<string, unknown>;
  members: string[];
  current_oncall_user_id: string | null;
  current_rotation_start: string | null;
  current_rotation_end: string | null;
  escalation_timeout_minutes: number;
  escalation_levels: Record<string, unknown>[];
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertComment {
  id: string;
  alert_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  project_id: string;
  alert_rule_id: string;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  status: 'open' | 'acknowledged' | 'resolved';
  occurrence_count: number;
  first_occurrence_at: string;
  last_occurrence_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// INSERT/UPDATE TYPES
// =====================================================

export type OrganizationInsert = Omit<Organization, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'current_events_count' | 'events_reset_at'>;
export type OrganizationUpdate = Partial<OrganizationInsert>;

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'archived_at'>;
export type ProjectUpdate = Partial<ProjectInsert>;

export type ApiKeyInsert = Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'last_used_at' | 'usage_count' | 'revoked_at'>;
export type ApiKeyUpdate = Partial<Pick<ApiKey, 'name' | 'status' | 'expires_at' | 'revoked_by' | 'revoke_reason'>>;

export type MetricInsert = Omit<Metric, 'id' | 'ingested_at'>;
export type LLMMetricInsert = Omit<LLMMetric, 'id' | 'ingested_at'>;
export type LogInsert = Omit<Log, 'id' | 'ingested_at'>;

export type AlertRuleInsert = Omit<AlertRule, 'id' | 'created_at' | 'updated_at' | 'last_evaluation_at' | 'last_fired_at' | 'fire_count'>;
export type AlertRuleUpdate = Partial<AlertRuleInsert>;

export type AlertInsert = Omit<Alert, 'id' | 'created_at' | 'updated_at'>;
export type AlertUpdate = Partial<Pick<Alert, 'status' | 'acknowledged_at' | 'acknowledged_by' | 'resolved_at' | 'resolved_by' | 'resolution_type' | 'resolution_note'>>;

export type IncidentUpdate = Partial<Pick<Incident, 'status' | 'severity' | 'description' | 'acknowledged_at' | 'acknowledged_by' | 'resolved_at' | 'resolved_by' | 'metadata'>>;

// =====================================================
// QUERY RESULT TYPES
// =====================================================

export interface DashboardOverview {
  current_period: {
    total_requests: number;
    avg_latency: number;
    total_tokens: number;
    error_rate: number;
  };
  previous_period: {
    total_requests: number;
    avg_latency: number;
    total_tokens: number;
  };
  active_alerts: number;
  changes: {
    requests_change: number;
    latency_change: number;
    tokens_change: number;
  };
  time_range: {
    start: string;
    end: string;
  };
}

export interface MetricStats {
  count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface LLMMetricsSummary {
  model_name: string;
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  total_cost_cents: number;
  avg_confidence: number;
}

export interface AlertsSummary {
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  pending_count: number;
  firing_count: number;
  acknowledged_count: number;
}

export interface LogStats {
  level: LogLevel;
  count: number;
  percentage: number;
}

export interface TimeSeriesDataPoint {
  bucket: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count: number;
}

// =====================================================
// DATABASE TYPE HELPER
// =====================================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: OrganizationInsert;
        Update: OrganizationUpdate;
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: Omit<OrganizationMember, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Pick<OrganizationMember, 'role'>>;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>;
        Update: Partial<UserProfile>;
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      api_keys: {
        Row: ApiKey;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at' | 'created_date'>;
        Update: never;
      };
      metric_definitions: {
        Row: MetricDefinition;
        Insert: Omit<MetricDefinition, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<MetricDefinition>;
      };
      metrics: {
        Row: Metric;
        Insert: MetricInsert;
        Update: never;
      };
      metrics_aggregated: {
        Row: MetricsAggregated;
        Insert: Omit<MetricsAggregated, 'id' | 'created_at'>;
        Update: MetricsAggregated;
      };
      llm_metrics: {
        Row: LLMMetric;
        Insert: LLMMetricInsert;
        Update: never;
      };
      logs: {
        Row: Log;
        Insert: LogInsert;
        Update: never;
      };
      traces: {
        Row: Trace;
        Insert: Omit<Trace, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Trace>;
      };
      spans: {
        Row: Span;
        Insert: Omit<Span, 'id' | 'created_at'>;
        Update: never;
      };
      log_patterns: {
        Row: LogPattern;
        Insert: Omit<LogPattern, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<LogPattern>;
      };
      saved_searches: {
        Row: SavedSearch;
        Insert: Omit<SavedSearch, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<SavedSearch>;
      };
      alert_rules: {
        Row: AlertRule;
        Insert: AlertRuleInsert;
        Update: AlertRuleUpdate;
      };
      alerts: {
        Row: Alert;
        Insert: AlertInsert;
        Update: AlertUpdate;
      };
      notification_channels: {
        Row: NotificationChannelConfig;
        Insert: Omit<NotificationChannelConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<NotificationChannelConfig>;
      };
      notification_history: {
        Row: NotificationHistory;
        Insert: Omit<NotificationHistory, 'id' | 'created_at'>;
        Update: Partial<NotificationHistory>;
      };
      anomalies: {
        Row: Anomaly;
        Insert: Omit<Anomaly, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Anomaly>;
      };
      oncall_schedules: {
        Row: OncallSchedule;
        Insert: Omit<OncallSchedule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<OncallSchedule>;
      };
      alert_comments: {
        Row: AlertComment;
        Insert: Omit<AlertComment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Pick<AlertComment, 'content'>>;
      };
      incidents: {
        Row: Incident;
        Insert: Omit<Incident, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Pick<Incident, 'status' | 'severity' | 'description' | 'acknowledged_at' | 'acknowledged_by' | 'resolved_at' | 'resolved_by' | 'metadata'>>;
      };
    };
    Views: {
      mv_daily_metrics_summary: {
        Row: {
          organization_id: string;
          project_id: string;
          metric_name: string;
          environment: string;
          model_name: string | null;
          day: string;
          data_points: number;
          avg_value: number;
          min_value: number;
          max_value: number;
          p50: number;
          p95: number;
          p99: number;
        };
      };
      mv_hourly_llm_summary: {
        Row: {
          organization_id: string;
          project_id: string;
          model_name: string;
          model_provider: string;
          environment: string;
          hour: string;
          total_requests: number;
          error_count: number;
          total_prompt_tokens: number;
          total_completion_tokens: number;
          total_tokens: number;
          avg_latency_ms: number;
          p95_latency_ms: number;
          avg_confidence: number;
          total_cost_cents: number;
          avg_tokens_per_second: number;
        };
      };
      mv_active_alerts_count: {
        Row: {
          organization_id: string;
          firing_count: number;
          pending_count: number;
          acknowledged_count: number;
          critical_count: number;
          warning_count: number;
          info_count: number;
        };
      };
    };
    Functions: {
      get_user_organizations: {
        Args: Record<string, never>;
        Returns: string[];
      };
      has_org_role: {
        Args: { org_id: string; required_roles: OrgRole[] };
        Returns: boolean;
      };
      is_org_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { org_id: string };
        Returns: boolean;
      };
      validate_api_key: {
        Args: { key_hash_input: string };
        Returns: {
          api_key_id: string;
          organization_id: string;
          project_id: string | null;
          scopes: string[];
          rate_limit_per_minute: number;
          rate_limit_per_day: number;
        }[];
      };
      get_dashboard_overview: {
        Args: { p_org_id: string; p_project_id?: string; p_hours?: number };
        Returns: DashboardOverview;
      };
      get_metric_stats: {
        Args: {
          p_org_id: string;
          p_project_id: string;
          p_metric_name: string;
          p_start_time: string;
          p_end_time: string;
          p_environment?: string;
        };
        Returns: MetricStats[];
      };
      get_llm_metrics_summary: {
        Args: {
          p_org_id: string;
          p_project_id: string;
          p_start_time: string;
          p_end_time: string;
        };
        Returns: LLMMetricsSummary[];
      };
      get_alerts_summary: {
        Args: { p_org_id: string };
        Returns: AlertsSummary[];
      };
      search_logs: {
        Args: {
          p_org_id: string;
          p_project_id: string;
          p_query: string;
          p_start_time: string;
          p_end_time: string;
          p_levels?: LogLevel[];
          p_sources?: LogSource[];
          p_service_name?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
          id: string;
          level: LogLevel;
          source: LogSource;
          message: string;
          service_name: string;
          trace_id: string | null;
          attributes: Record<string, unknown>;
          timestamp: string;
          rank: number;
        }>;
      };
      get_time_series: {
        Args: {
          p_org_id: string;
          p_project_id: string;
          p_metric_name: string;
          p_start_time: string;
          p_end_time: string;
          p_granularity?: string;
        };
        Returns: TimeSeriesDataPoint[];
      };
      fire_alert: {
        Args: { p_rule_id: string; p_current_value: number; p_labels?: Record<string, string> };
        Returns: string;
      };
      resolve_alert: {
        Args: {
          p_alert_id: string;
          p_resolved_by?: string;
          p_resolution_type?: string;
          p_resolution_note?: string;
        };
        Returns: boolean;
      };
      acknowledge_alert: {
        Args: { p_alert_id: string; p_acknowledged_by: string };
        Returns: boolean;
      };
      export_user_data: {
        Args: { p_user_id: string };
        Returns: Record<string, unknown>;
      };
      delete_user_data: {
        Args: { p_user_id: string };
        Returns: Record<string, unknown>;
      };
    };
    Enums: {
      org_role: OrgRole;
      project_status: ProjectStatus;
      api_key_status: ApiKeyStatus;
      subscription_tier: SubscriptionTier;
      metric_type: MetricType;
      aggregation_period: AggregationPeriod;
      log_level: LogLevel;
      log_source: LogSource;
      alert_severity: AlertSeverity;
      alert_status: AlertStatus;
      alert_condition_type: AlertConditionType;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
    };
  };
}
