-- ============================================================================
-- ObservAI Hub - Complete Database Schema Migration
-- Version: 1.0.0
-- Date: December 15, 2025
-- Description: Comprehensive database schema for AI/LLM observability platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- SECTION 1: Core Tables
-- ============================================================================

-- User Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    company TEXT,
    role TEXT,
    preferences JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'Extended user profile information';
COMMENT ON COLUMN public.user_profiles.preferences IS 'User preferences for dashboard customization, notification settings, etc.';

-- ============================================================================
-- SECTION 2: LLM Request Tracking
-- ============================================================================

-- LLM Requests - Core observability data
CREATE TABLE IF NOT EXISTS public.llm_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Request metadata
    model TEXT NOT NULL,
    prompt TEXT,
    response TEXT,
    prompt_category TEXT DEFAULT 'general',
    
    -- Performance metrics
    latency_ms INTEGER NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    tokens_total INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    
    -- Quality metrics
    coherence_score DECIMAL(3, 2) DEFAULT 0,
    toxicity_score DECIMAL(3, 2) DEFAULT 0,
    hallucination_risk DECIMAL(3, 2) DEFAULT 0,
    sentiment_score DECIMAL(3, 2),
    
    -- Request parameters
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1024,
    top_p DECIMAL(3, 2),
    frequency_penalty DECIMAL(3, 2),
    presence_penalty DECIMAL(3, 2),
    
    -- Status and error tracking
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata and context
    request_id TEXT,
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    trace_id TEXT,
    span_id TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.llm_requests IS 'Complete tracking of all LLM API requests with performance and quality metrics';
COMMENT ON COLUMN public.llm_requests.prompt_category IS 'Category: summarization, translation, code_generation, explanation, content_creation, general';
COMMENT ON COLUMN public.llm_requests.coherence_score IS 'Response coherence quality score (0.0-1.0)';
COMMENT ON COLUMN public.llm_requests.toxicity_score IS 'Toxicity detection score (0.0-1.0, higher = more toxic)';
COMMENT ON COLUMN public.llm_requests.hallucination_risk IS 'Estimated hallucination probability (0.0-1.0)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_requests_user_id ON public.llm_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_requests_created_at ON public.llm_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_model ON public.llm_requests(model);
CREATE INDEX IF NOT EXISTS idx_llm_requests_success ON public.llm_requests(success);
CREATE INDEX IF NOT EXISTS idx_llm_requests_user_created ON public.llm_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_model_created ON public.llm_requests(model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_category ON public.llm_requests(prompt_category);
CREATE INDEX IF NOT EXISTS idx_llm_requests_session ON public.llm_requests(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_requests_trace ON public.llm_requests(trace_id) WHERE trace_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_llm_requests_user_model_time ON public.llm_requests(user_id, model, created_at DESC);

-- ============================================================================
-- SECTION 3: Alerts and Anomalies
-- ============================================================================

-- Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Alert details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    source TEXT NOT NULL,
    alert_type TEXT DEFAULT 'manual',
    
    -- Detection details
    detection_rule_id UUID,
    threshold_value DECIMAL,
    current_value DECIMAL,
    anomaly_score DECIMAL(3, 2),
    
    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'closed')),
    priority INTEGER DEFAULT 0,
    
    -- Resolution tracking
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Metadata
    affected_resources JSONB DEFAULT '[]'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.alerts IS 'System alerts for anomalies, threshold breaches, and manual incidents';
COMMENT ON COLUMN public.alerts.alert_type IS 'Type: manual, automated, ml_detected, threshold_breach';
COMMENT ON COLUMN public.alerts.anomaly_score IS 'ML anomaly detection score (0.0-1.0)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON public.alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_detection_rule ON public.alerts(detection_rule_id) WHERE detection_rule_id IS NOT NULL;

-- ============================================================================
-- SECTION 4: Detection Rules
-- ============================================================================

-- Detection Rules
CREATE TABLE IF NOT EXISTS public.detection_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Rule definition
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'threshold', 'anomaly', 'pattern', 'ml', 'composite'
    )),
    category TEXT NOT NULL,
    
    -- Rule logic
    condition JSONB NOT NULL,
    threshold_value DECIMAL,
    time_window_minutes INTEGER DEFAULT 60,
    evaluation_interval_seconds INTEGER DEFAULT 60,
    
    -- Alert configuration
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    alert_template JSONB,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    triggers_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.detection_rules IS '40+ AI/ML-specific detection rules for observability';
COMMENT ON COLUMN public.detection_rules.category IS 'Category: performance, quality, security, cost, reliability, etc.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detection_rules_user_id ON public.detection_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_rules_enabled ON public.detection_rules(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_detection_rules_category ON public.detection_rules(category);
CREATE INDEX IF NOT EXISTS idx_detection_rules_type ON public.detection_rules(rule_type);

-- ============================================================================
-- SECTION 5: Logs
-- ============================================================================

-- Application logs
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Log details
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Context
    trace_id TEXT,
    span_id TEXT,
    request_id TEXT,
    session_id TEXT,
    
    -- Technical details
    error_stack TEXT,
    error_code TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Source
    source_file TEXT,
    source_line INTEGER,
    function_name TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.logs IS 'Centralized application logs with structured data';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON public.logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_service ON public.logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_user_level_time ON public.logs(user_id, level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_trace ON public.logs(trace_id) WHERE trace_id IS NOT NULL;

-- Partitioning hint for large-scale deployments (optional)
-- Consider partitioning by created_at for logs older than 30 days

-- ============================================================================
-- SECTION 6: Service Health
-- ============================================================================

-- Service health checks
CREATE TABLE IF NOT EXISTS public.service_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Service details
    service_name TEXT NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN (
        'llm_provider', 'database', 'api', 'cache', 'queue', 'storage', 'other'
    )),
    
    -- Health status
    status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'down', 'maintenance')),
    
    -- Metrics
    latency_ms INTEGER,
    error_rate DECIMAL(5, 2),
    success_rate DECIMAL(5, 2),
    throughput INTEGER,
    
    -- Additional data
    response_code INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.service_health IS 'Health check results for external services and dependencies';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_health_user_id ON public.service_health(user_id);
CREATE INDEX IF NOT EXISTS idx_service_health_service_name ON public.service_health(service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_status ON public.service_health(status);
CREATE INDEX IF NOT EXISTS idx_service_health_checked_at ON public.service_health(checked_at DESC);

-- ============================================================================
-- SECTION 7: Analytics and Aggregations
-- ============================================================================

-- Metrics snapshots (hourly/daily aggregations)
CREATE TABLE IF NOT EXISTS public.metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Snapshot metadata
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Aggregated metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10, 2),
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(12, 6),
    
    -- Model breakdown
    model_stats JSONB DEFAULT '{}'::JSONB,
    
    -- Quality metrics
    avg_coherence_score DECIMAL(3, 2),
    avg_toxicity_score DECIMAL(3, 2),
    avg_hallucination_risk DECIMAL(3, 2),
    
    -- Alert summary
    alerts_triggered INTEGER DEFAULT 0,
    critical_alerts INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.metrics_snapshots IS 'Pre-aggregated metrics for fast analytics queries';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_user_period ON public.metrics_snapshots(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_type ON public.metrics_snapshots(snapshot_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_snapshots_unique ON public.metrics_snapshots(user_id, snapshot_type, period_start);

-- ============================================================================
-- SECTION 8: Cost Tracking
-- ============================================================================

-- Cost tracking and budgets
CREATE TABLE IF NOT EXISTS public.cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cost details
    model TEXT NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    tokens_total INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL,
    
    -- Context
    request_id UUID REFERENCES public.llm_requests(id) ON DELETE SET NULL,
    project_name TEXT,
    cost_center TEXT,
    
    -- Billing period
    billing_period DATE NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.cost_tracking IS 'Detailed cost tracking for LLM usage';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON public.cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_billing_period ON public.cost_tracking(billing_period DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_model ON public.cost_tracking(model);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_period ON public.cost_tracking(user_id, billing_period DESC);

-- Budget limits
CREATE TABLE IF NOT EXISTS public.budget_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Budget configuration
    name TEXT NOT NULL,
    limit_type TEXT NOT NULL CHECK (limit_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    limit_amount_usd DECIMAL(10, 2) NOT NULL,
    
    -- Scope
    model_filter TEXT,
    project_filter TEXT,
    
    -- Alert thresholds
    warning_threshold_percent INTEGER DEFAULT 80,
    critical_threshold_percent INTEGER DEFAULT 95,
    
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    current_spend_usd DECIMAL(10, 2) DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.budget_limits IS 'Budget limits and cost alerts';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_limits_user_id ON public.budget_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_limits_enabled ON public.budget_limits(enabled) WHERE enabled = TRUE;

-- ============================================================================
-- SECTION 9: Sessions and Conversations
-- ============================================================================

-- Chat sessions for conversation tracking
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session details
    title TEXT,
    description TEXT,
    
    -- Statistics
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    tags TEXT[],
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.chat_sessions IS 'Conversation sessions for tracking multi-turn interactions';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON public.chat_sessions(last_activity_at DESC);

-- ============================================================================
-- SECTION 10: Prompt Templates
-- ============================================================================

-- Prompt templates library
CREATE TABLE IF NOT EXISTS public.prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Template details
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    
    -- Template content
    template TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::JSONB,
    
    -- Configuration
    default_model TEXT,
    default_temperature DECIMAL(3, 2),
    default_max_tokens INTEGER,
    
    -- Usage statistics
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    avg_latency_ms DECIMAL(10, 2),
    avg_quality_score DECIMAL(3, 2),
    
    -- Sharing
    is_public BOOLEAN DEFAULT FALSE,
    shared_with UUID[],
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.prompt_templates IS 'Reusable prompt templates with variables and defaults';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON public.prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON public.prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON public.prompt_templates(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- SECTION 11: Views
-- ============================================================================

-- Aggregated metrics view (last 24 hours)
CREATE OR REPLACE VIEW public.llm_metrics_summary AS
WITH model_stats AS (
    SELECT 
        user_id,
        model,
        COUNT(*) as model_requests,
        ROUND(AVG(latency_ms), 2) as model_avg_latency,
        SUM(cost_usd) as model_total_cost
    FROM public.llm_requests
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY user_id, model
)
SELECT 
    lr.user_id,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE lr.success = TRUE) as successful_requests,
    COUNT(*) FILTER (WHERE lr.success = FALSE) as failed_requests,
    ROUND(AVG(lr.latency_ms), 2) as avg_latency_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lr.latency_ms) as p50_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lr.latency_ms) as p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY lr.latency_ms) as p99_latency_ms,
    SUM(lr.tokens_total) as total_tokens,
    SUM(lr.cost_usd) as total_cost_usd,
    ROUND(AVG(lr.coherence_score), 2) as avg_coherence_score,
    ROUND(AVG(lr.toxicity_score), 2) as avg_toxicity_score,
    ROUND(AVG(lr.hallucination_risk), 2) as avg_hallucination_risk,
    (
        SELECT jsonb_object_agg(
            ms.model,
            jsonb_build_object(
                'requests', ms.model_requests,
                'avg_latency', ms.model_avg_latency,
                'total_cost', ms.model_total_cost
            )
        )
        FROM model_stats ms
        WHERE ms.user_id = lr.user_id
    ) as model_breakdown
FROM public.llm_requests lr
WHERE lr.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY lr.user_id;

COMMENT ON VIEW public.llm_metrics_summary IS 'Pre-aggregated metrics for the last 24 hours';

-- Active alerts view
CREATE OR REPLACE VIEW public.active_alerts AS
SELECT 
    a.*,
    u.email as user_email,
    u.raw_user_meta_data->>'full_name' as user_name,
    dr.name as rule_name
FROM public.alerts a
LEFT JOIN auth.users u ON a.user_id = u.id
LEFT JOIN public.detection_rules dr ON a.detection_rule_id = dr.id
WHERE a.status IN ('active', 'acknowledged')
ORDER BY 
    CASE a.severity 
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
    END,
    a.created_at DESC;

COMMENT ON VIEW public.active_alerts IS 'All currently active and acknowledged alerts with user context';

-- ============================================================================
-- SECTION 12: Functions
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at IS 'Automatically updates the updated_at timestamp';

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile on signup';

-- Function to calculate cost from tokens
CREATE OR REPLACE FUNCTION public.calculate_cost(
    p_model TEXT,
    p_tokens_in INTEGER,
    p_tokens_out INTEGER
)
RETURNS DECIMAL(10, 6) AS $$
DECLARE
    v_cost DECIMAL(10, 6);
    v_input_rate DECIMAL(10, 6);
    v_output_rate DECIMAL(10, 6);
BEGIN
    -- Pricing per 1M tokens (as of December 2025)
    CASE p_model
        WHEN 'gemini-2.5-flash' THEN
            v_input_rate := 0.075;
            v_output_rate := 0.30;
        WHEN 'gemini-2.5-pro' THEN
            v_input_rate := 1.25;
            v_output_rate := 5.00;
        WHEN 'gemini-1.5-flash' THEN
            v_input_rate := 0.075;
            v_output_rate := 0.30;
        WHEN 'gemini-1.5-pro' THEN
            v_input_rate := 1.25;
            v_output_rate := 5.00;
        ELSE
            -- Default to Flash pricing
            v_input_rate := 0.075;
            v_output_rate := 0.30;
    END CASE;
    
    v_cost := ((p_tokens_in::DECIMAL / 1000000) * v_input_rate) + 
              ((p_tokens_out::DECIMAL / 1000000) * v_output_rate);
    
    RETURN v_cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.calculate_cost IS 'Calculates cost in USD based on model and token usage';

-- Function to aggregate hourly metrics
CREATE OR REPLACE FUNCTION public.aggregate_hourly_metrics()
RETURNS void AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    -- Get the last completed hour
    v_period_end := date_trunc('hour', NOW());
    v_period_start := v_period_end - INTERVAL '1 hour';
    
    -- Insert aggregated metrics using CTE to avoid nested aggregates
    INSERT INTO public.metrics_snapshots (
        user_id, snapshot_type, period_start, period_end,
        total_requests, successful_requests, failed_requests,
        avg_latency_ms, p50_latency_ms, p95_latency_ms, p99_latency_ms,
        total_tokens, total_cost_usd,
        avg_coherence_score, avg_toxicity_score, avg_hallucination_risk,
        model_stats
    )
    WITH model_hourly_stats AS (
        SELECT 
            user_id,
            model,
            COUNT(*) as model_requests,
            ROUND(AVG(latency_ms), 2) as model_avg_latency,
            SUM(cost_usd) as model_total_cost
        FROM public.llm_requests
        WHERE created_at >= v_period_start AND created_at < v_period_end
        GROUP BY user_id, model
    )
    SELECT 
        lr.user_id,
        'hourly',
        v_period_start,
        v_period_end,
        COUNT(*),
        COUNT(*) FILTER (WHERE lr.success = TRUE),
        COUNT(*) FILTER (WHERE lr.success = FALSE),
        ROUND(AVG(lr.latency_ms), 2),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lr.latency_ms),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lr.latency_ms),
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY lr.latency_ms),
        SUM(lr.tokens_total),
        SUM(lr.cost_usd),
        ROUND(AVG(lr.coherence_score), 2),
        ROUND(AVG(lr.toxicity_score), 2),
        ROUND(AVG(lr.hallucination_risk), 2),
        (
            SELECT jsonb_object_agg(
                mhs.model,
                jsonb_build_object(
                    'requests', mhs.model_requests,
                    'avg_latency', mhs.model_avg_latency,
                    'total_cost', mhs.model_total_cost
                )
            )
            FROM model_hourly_stats mhs
            WHERE mhs.user_id = lr.user_id
        )
    FROM public.llm_requests lr
    WHERE lr.created_at >= v_period_start AND lr.created_at < v_period_end
    GROUP BY lr.user_id
    ON CONFLICT (user_id, snapshot_type, period_start) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.aggregate_hourly_metrics IS 'Aggregates metrics for the last completed hour';

-- ============================================================================
-- SECTION 13: Triggers
-- ============================================================================

-- Trigger for updated_at on all relevant tables
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_llm_requests_updated_at
    BEFORE UPDATE ON public.llm_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_detection_rules_updated_at
    BEFORE UPDATE ON public.detection_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_budget_limits_updated_at
    BEFORE UPDATE ON public.budget_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_prompt_templates_updated_at
    BEFORE UPDATE ON public.prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for auto-creating user profile
CREATE TRIGGER trigger_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SECTION 14: Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- LLM Requests policies
CREATE POLICY "Users can view own requests"
    ON public.llm_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
    ON public.llm_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Alerts policies
CREATE POLICY "Users can view own alerts"
    ON public.alerts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
    ON public.alerts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
    ON public.alerts FOR UPDATE
    USING (auth.uid() = user_id);

-- Detection Rules policies
CREATE POLICY "Users can view own detection rules"
    ON public.detection_rules FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own detection rules"
    ON public.detection_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own detection rules"
    ON public.detection_rules FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own detection rules"
    ON public.detection_rules FOR DELETE
    USING (auth.uid() = user_id);

-- Logs policies
CREATE POLICY "Users can view own logs"
    ON public.logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
    ON public.logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service Health policies
CREATE POLICY "Users can view own service health"
    ON public.service_health FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own service health"
    ON public.service_health FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Metrics Snapshots policies
CREATE POLICY "Users can view own metrics snapshots"
    ON public.metrics_snapshots FOR SELECT
    USING (auth.uid() = user_id);

-- Cost Tracking policies
CREATE POLICY "Users can view own cost tracking"
    ON public.cost_tracking FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cost tracking"
    ON public.cost_tracking FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Budget Limits policies
CREATE POLICY "Users can view own budget limits"
    ON public.budget_limits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own budget limits"
    ON public.budget_limits FOR ALL
    USING (auth.uid() = user_id);

-- Chat Sessions policies
CREATE POLICY "Users can view own chat sessions"
    ON public.chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat sessions"
    ON public.chat_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Prompt Templates policies
CREATE POLICY "Users can view own and public templates"
    ON public.prompt_templates FOR SELECT
    USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can manage own templates"
    ON public.prompt_templates FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 15: Seed Data - 40 AI/ML Detection Rules
-- ============================================================================

INSERT INTO public.detection_rules (name, description, rule_type, category, condition, severity, enabled, user_id) VALUES
-- Performance Rules
('High Latency Alert', 'Triggers when average response latency exceeds 2000ms over 5 minutes', 'threshold', 'performance', '{"metric": "latency_ms", "operator": ">", "value": 2000, "window": 5}'::jsonb, 'warning', true, NULL),
('P95 Latency Spike', 'Alerts when P95 latency is 2x the baseline', 'anomaly', 'performance', '{"metric": "p95_latency", "operator": "spike", "threshold": 2.0}'::jsonb, 'warning', true, NULL),
('Slow Response Pattern', 'Detects consistent slow responses over 15 minutes', 'pattern', 'performance', '{"metric": "latency_ms", "operator": ">", "value": 1500, "duration": 15}'::jsonb, 'warning', true, NULL),
('Token Processing Slowdown', 'Alerts when tokens/second drops below threshold', 'threshold', 'performance', '{"metric": "tokens_per_second", "operator": "<", "value": 10}'::jsonb, 'warning', true, NULL),

-- Quality Rules
('Low Coherence Score', 'Triggers when response coherence falls below 0.5', 'threshold', 'quality', '{"metric": "coherence_score", "operator": "<", "value": 0.5}'::jsonb, 'warning', true, NULL),
('High Toxicity Detection', 'Alerts on toxic content above 0.7 threshold', 'threshold', 'quality', '{"metric": "toxicity_score", "operator": ">", "value": 0.7}'::jsonb, 'critical', true, NULL),
('Hallucination Risk Alert', 'Detects high probability of hallucinated responses', 'threshold', 'quality', '{"metric": "hallucination_risk", "operator": ">", "value": 0.6}'::jsonb, 'critical', true, NULL),
('Quality Degradation', 'ML model detecting overall quality decline', 'ml', 'quality', '{"model": "quality_detector", "threshold": 0.3}'::jsonb, 'warning', true, NULL),
('Repetitive Response Pattern', 'Identifies when model produces repetitive outputs', 'pattern', 'quality', '{"metric": "response_similarity", "operator": ">", "value": 0.9}'::jsonb, 'info', true, NULL),
('Empty Response Alert', 'Triggers when responses are empty or too short', 'threshold', 'quality', '{"metric": "response_length", "operator": "<", "value": 10}'::jsonb, 'warning', true, NULL),

-- Security Rules
('Prompt Injection Detected', 'Identifies potential prompt injection attacks', 'ml', 'security', '{"model": "injection_detector", "threshold": 0.8}'::jsonb, 'critical', true, NULL),
('Data Exfiltration Attempt', 'Detects attempts to extract sensitive data', 'pattern', 'security', '{"patterns": ["password", "api_key", "token", "secret"]}'::jsonb, 'critical', true, NULL),
('Jailbreak Attempt', 'Identifies attempts to bypass safety constraints', 'ml', 'security', '{"model": "jailbreak_detector", "threshold": 0.75}'::jsonb, 'critical', true, NULL),
('Unusual User Behavior', 'Anomaly detection for abnormal user patterns', 'anomaly', 'security', '{"metric": "request_pattern", "baseline": "user_history"}'::jsonb, 'warning', true, NULL),
('Rate Limit Approaching', 'Warns when user approaches rate limit', 'threshold', 'security', '{"metric": "requests_per_minute", "operator": ">", "value": 50}'::jsonb, 'warning', true, NULL),
('Suspicious Prompt Length', 'Alerts on abnormally long prompts (>10000 chars)', 'threshold', 'security', '{"metric": "prompt_length", "operator": ">", "value": 10000}'::jsonb, 'warning', true, NULL),
('PII Detection in Prompt', 'Identifies personally identifiable information', 'ml', 'security', '{"model": "pii_detector", "types": ["email", "phone", "ssn"]}'::jsonb, 'warning', true, NULL),

-- Cost Rules
('Daily Cost Spike', 'Alerts when daily costs exceed budget by 50%', 'threshold', 'cost', '{"metric": "daily_cost", "operator": ">", "baseline_percent": 150}'::jsonb, 'critical', true, NULL),
('High Token Usage', 'Triggers when token usage spikes unexpectedly', 'anomaly', 'cost', '{"metric": "tokens_total", "operator": "spike", "threshold": 3.0}'::jsonb, 'warning', true, NULL),
('Expensive Model Overuse', 'Warns about excessive use of expensive models', 'threshold', 'cost', '{"metric": "pro_model_ratio", "operator": ">", "value": 0.5}'::jsonb, 'info', true, NULL),
('Budget Threshold 80%', 'Alerts when 80% of monthly budget is consumed', 'threshold', 'cost', '{"metric": "budget_percent", "operator": ">", "value": 80}'::jsonb, 'warning', true, NULL),
('Inefficient Token Usage', 'Detects high token usage with low quality', 'composite', 'cost', '{"conditions": [{"metric": "tokens_total", "operator": ">", "value": 5000}, {"metric": "coherence_score", "operator": "<", "value": 0.6}]}'::jsonb, 'warning', true, NULL),

-- Reliability Rules
('High Error Rate', 'Triggers when error rate exceeds 5% over 10 minutes', 'threshold', 'reliability', '{"metric": "error_rate", "operator": ">", "value": 5, "window": 10}'::jsonb, 'critical', true, NULL),
('Model Timeout Pattern', 'Detects recurring timeout errors', 'pattern', 'reliability', '{"error_code": "timeout", "count": 5, "window": 5}'::jsonb, 'critical', true, NULL),
('Service Degradation', 'Alerts on consecutive failed requests', 'pattern', 'reliability', '{"metric": "consecutive_failures", "operator": ">=", "value": 3}'::jsonb, 'critical', true, NULL),
('API Rate Limit Hit', 'Detects when API rate limits are reached', 'pattern', 'reliability', '{"error_code": "rate_limit", "count": 1}'::jsonb, 'critical', true, NULL),
('Context Window Overflow', 'Alerts when prompts exceed context window', 'threshold', 'reliability', '{"metric": "tokens_total", "operator": ">", "value": 30000}'::jsonb, 'warning', true, NULL),
('Model Availability Drop', 'Detects when model success rate drops below 95%', 'threshold', 'reliability', '{"metric": "success_rate", "operator": "<", "value": 95}'::jsonb, 'critical', true, NULL),

-- Model Drift Rules
('Response Distribution Shift', 'ML detection of output distribution changes', 'ml', 'drift', '{"model": "drift_detector", "metric": "response_distribution"}'::jsonb, 'warning', true, NULL),
('Latency Distribution Change', 'Detects shifts in latency patterns', 'anomaly', 'drift', '{"metric": "latency_distribution", "method": "ks_test"}'::jsonb, 'info', true, NULL),
('Quality Score Drift', 'Identifies gradual quality degradation', 'ml', 'drift', '{"metric": "quality_scores", "window": 24, "threshold": 0.15}'::jsonb, 'warning', true, NULL),
('Model Version Change Impact', 'Detects performance changes after updates', 'anomaly', 'drift', '{"trigger": "model_version_change", "baseline": "previous_version"}'::jsonb, 'info', true, NULL),

-- Compliance Rules
('GDPR Compliance Check', 'Ensures data handling meets GDPR requirements', 'pattern', 'compliance', '{"checks": ["data_retention", "user_consent", "data_deletion"]}'::jsonb, 'critical', true, NULL),
('Content Policy Violation', 'Detects responses violating content policies', 'ml', 'compliance', '{"model": "policy_checker", "policies": ["violence", "hate_speech", "adult"]}'::jsonb, 'critical', true, NULL),
('Data Residency Alert', 'Warns about data crossing regional boundaries', 'pattern', 'compliance', '{"metric": "data_region", "allowed": ["us-east", "eu-west"]}'::jsonb, 'warning', true, NULL),

-- Usage Pattern Rules
('Unusual Request Volume', 'Detects abnormal spike in request count', 'anomaly', 'usage', '{"metric": "request_count", "window": 60, "threshold": 3.0}'::jsonb, 'info', true, NULL),
('Off-Hours Activity', 'Alerts on activity during unusual hours', 'pattern', 'usage', '{"metric": "request_time", "outside": ["22:00", "06:00"]}'::jsonb, 'info', true, NULL),
('New User Behavior', 'Monitors first-time user activity patterns', 'pattern', 'usage', '{"condition": "user_age < 24h", "threshold": 100}'::jsonb, 'info', true, NULL),
('Session Anomaly', 'Detects unusual session lengths or patterns', 'anomaly', 'usage', '{"metric": "session_duration", "baseline": "user_average"}'::jsonb, 'info', true, NULL),
('API Misuse Pattern', 'Identifies potential API abuse or misuse', 'pattern', 'usage', '{"indicators": ["rapid_requests", "unusual_params", "error_probing"]}'::jsonb, 'warning', true, NULL);

-- ============================================================================
-- SECTION 16: Indexes for Common Query Patterns
-- ============================================================================

-- Time-series analysis indexes
-- Note: date_trunc with timestamptz is STABLE not IMMUTABLE, so we use composite indexes instead
CREATE INDEX IF NOT EXISTS idx_llm_requests_hourly_metrics 
    ON public.llm_requests(user_id, created_at, model);

CREATE INDEX IF NOT EXISTS idx_llm_requests_daily_metrics 
    ON public.llm_requests(user_id, created_at);

-- Cost analysis indexes
CREATE INDEX IF NOT EXISTS idx_llm_requests_cost_analysis 
    ON public.llm_requests(user_id, model, cost_usd DESC, created_at DESC);

-- Quality monitoring indexes
CREATE INDEX IF NOT EXISTS idx_llm_requests_quality 
    ON public.llm_requests(user_id, coherence_score, toxicity_score, hallucination_risk)
    WHERE success = TRUE;

-- Session tracking indexes
CREATE INDEX IF NOT EXISTS idx_llm_requests_session 
    ON public.llm_requests(session_id, created_at) 
    WHERE session_id IS NOT NULL;

-- ============================================================================
-- SECTION 17: Materialized Views for Performance
-- ============================================================================

-- Daily metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_metrics AS
WITH model_daily_stats AS (
    SELECT 
        user_id,
        date_trunc('day', created_at)::date as metric_date,
        model,
        COUNT(*) as model_requests,
        SUM(cost_usd) as model_cost
    FROM public.llm_requests
    GROUP BY user_id, date_trunc('day', created_at), model
),
daily_aggregates AS (
    SELECT 
        user_id,
        date_trunc('day', created_at)::date as metric_date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE success = TRUE) as successful_requests,
        COUNT(*) FILTER (WHERE success = FALSE) as failed_requests,
        ROUND(AVG(latency_ms), 2) as avg_latency_ms,
        SUM(tokens_total) as total_tokens,
        SUM(cost_usd) as total_cost_usd
    FROM public.llm_requests
    GROUP BY user_id, date_trunc('day', created_at)
)
SELECT 
    da.user_id,
    da.metric_date,
    da.total_requests,
    da.successful_requests,
    da.failed_requests,
    da.avg_latency_ms,
    da.total_tokens,
    da.total_cost_usd,
    (
        SELECT jsonb_object_agg(
            mds.model,
            jsonb_build_object(
                'requests', mds.model_requests,
                'cost', mds.model_cost
            )
        )
        FROM model_daily_stats mds
        WHERE mds.user_id = da.user_id 
          AND mds.metric_date = da.metric_date
    ) as model_stats
FROM daily_aggregates da;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_user_date 
    ON public.daily_metrics(user_id, metric_date);

COMMENT ON MATERIALIZED VIEW public.daily_metrics IS 'Daily aggregated metrics for fast dashboard queries - refresh daily';

-- ============================================================================
-- SECTION 18: Grant Permissions
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- SECTION 19: Database Maintenance
-- ============================================================================

-- Refresh materialized view (run daily via cron job)
-- SELECT refresh_daily_metrics();

CREATE OR REPLACE FUNCTION public.refresh_daily_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_metrics;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.refresh_daily_metrics IS 'Refresh daily metrics materialized view - run via cron';

-- Cleanup old logs (run weekly)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS void AS $$
BEGIN
    DELETE FROM public.logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.cleanup_old_logs IS 'Delete logs older than specified days (default 90)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Insert migration record
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.schema_migrations (version, description) 
VALUES ('001', 'Initial schema - Complete ObservAI Hub database') 
ON CONFLICT (version) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ ObservAI Hub Database Schema Migration Completed Successfully!';
    RAISE NOTICE '📊 Created: 11 tables, 2 views, 1 materialized view';
    RAISE NOTICE '🔐 Configured: Row Level Security on all tables';
    RAISE NOTICE '🎯 Seeded: 40 AI/ML detection rules';
    RAISE NOTICE '⚡ Optimized: 50+ indexes for query performance';
END $$;
