-- =====================================================
-- ObservAI Hub - Metrics Tables Migration
-- Version: 00002
-- Description: Time-series metrics storage with aggregation support
-- =====================================================

-- =====================================================
-- ENUM TYPES FOR METRICS
-- =====================================================

CREATE TYPE public.metric_type AS ENUM ('counter', 'gauge', 'histogram', 'summary');
CREATE TYPE public.aggregation_period AS ENUM ('1m', '5m', '15m', '1h', '6h', '1d');

-- =====================================================
-- METRICS DEFINITIONS TABLE
-- =====================================================

CREATE TABLE public.metric_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Metric identity
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    unit VARCHAR(50), -- e.g., 'ms', 'bytes', 'count', '%'
    
    -- Metric configuration
    metric_type public.metric_type NOT NULL DEFAULT 'gauge',
    
    -- Aggregation settings
    aggregation_methods TEXT[] NOT NULL DEFAULT ARRAY['avg', 'min', 'max', 'count'],
    
    -- Alerting thresholds
    warning_threshold DOUBLE PRECISION,
    critical_threshold DOUBLE PRECISION,
    threshold_direction VARCHAR(10) DEFAULT 'above', -- 'above' or 'below'
    
    -- Tags/dimensions schema
    tag_schema JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT metric_definitions_name_unique UNIQUE (organization_id, project_id, name)
);

-- =====================================================
-- RAW METRICS TABLE (Hypertable candidate)
-- =====================================================

CREATE TABLE public.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Metric identity
    metric_name VARCHAR(255) NOT NULL,
    metric_type public.metric_type NOT NULL DEFAULT 'gauge',
    
    -- Value
    value DOUBLE PRECISION NOT NULL,
    
    -- Dimensions/Tags
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    model_name VARCHAR(255),
    endpoint VARCHAR(255),
    tags JSONB NOT NULL DEFAULT '{}',
    
    -- Request context
    trace_id UUID,
    span_id UUID,
    
    -- Timestamp (primary time dimension)
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ingestion metadata
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (timestamp);

-- Create initial partitions (current month + next month)
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..2 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'metrics_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.metrics 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

-- Create default partition for overflow
CREATE TABLE IF NOT EXISTS public.metrics_default PARTITION OF public.metrics DEFAULT;

-- =====================================================
-- AGGREGATED METRICS TABLE
-- =====================================================

CREATE TABLE public.metrics_aggregated (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Metric identity
    metric_name VARCHAR(255) NOT NULL,
    
    -- Aggregation period
    period public.aggregation_period NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Aggregated values
    count BIGINT NOT NULL DEFAULT 0,
    sum DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg DOUBLE PRECISION NOT NULL DEFAULT 0,
    min DOUBLE PRECISION,
    max DOUBLE PRECISION,
    
    -- Percentiles (stored as JSONB for flexibility)
    percentiles JSONB NOT NULL DEFAULT '{
        "p50": null,
        "p75": null,
        "p90": null,
        "p95": null,
        "p99": null
    }',
    
    -- Dimensions
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    model_name VARCHAR(255),
    tags JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT metrics_aggregated_unique UNIQUE (
        organization_id, project_id, metric_name, period, period_start, environment, model_name
    )
);

-- =====================================================
-- LLM-SPECIFIC METRICS TABLE
-- =====================================================

CREATE TABLE public.llm_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Request identification
    request_id UUID NOT NULL,
    trace_id UUID,
    
    -- Model information
    model_name VARCHAR(255) NOT NULL,
    model_provider VARCHAR(100) NOT NULL, -- 'openai', 'anthropic', 'google', 'azure', etc.
    model_version VARCHAR(50),
    
    -- Request details
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    endpoint VARCHAR(255),
    
    -- Token metrics
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Timing metrics (in milliseconds)
    latency_ms INTEGER NOT NULL,
    time_to_first_token_ms INTEGER,
    tokens_per_second DOUBLE PRECISION,
    
    -- Quality metrics
    confidence_score DOUBLE PRECISION,
    toxicity_score DOUBLE PRECISION,
    coherence_score DOUBLE PRECISION,
    
    -- Cost tracking (in cents)
    estimated_cost_cents DOUBLE PRECISION,
    
    -- Request/Response metadata
    temperature DOUBLE PRECISION,
    max_tokens INTEGER,
    top_p DOUBLE PRECISION,
    
    -- Error tracking
    is_error BOOLEAN NOT NULL DEFAULT false,
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Streaming
    is_streaming BOOLEAN NOT NULL DEFAULT false,
    
    -- Custom tags
    tags JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (timestamp);

-- Create partitions for LLM metrics
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..2 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'llm_metrics_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.llm_metrics 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.llm_metrics_default PARTITION OF public.llm_metrics DEFAULT;

-- =====================================================
-- INDEXES FOR METRICS
-- =====================================================

-- Raw metrics indexes
CREATE INDEX idx_metrics_org_project_time ON public.metrics(organization_id, project_id, timestamp DESC);
CREATE INDEX idx_metrics_name_time ON public.metrics(metric_name, timestamp DESC);
CREATE INDEX idx_metrics_trace ON public.metrics(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_metrics_environment ON public.metrics(organization_id, environment, timestamp DESC);
CREATE INDEX idx_metrics_model ON public.metrics(model_name, timestamp DESC) WHERE model_name IS NOT NULL;

-- Aggregated metrics indexes
CREATE INDEX idx_metrics_agg_lookup ON public.metrics_aggregated(
    organization_id, project_id, metric_name, period, period_start DESC
);
CREATE INDEX idx_metrics_agg_period ON public.metrics_aggregated(period, period_start DESC);

-- LLM metrics indexes
CREATE INDEX idx_llm_metrics_org_time ON public.llm_metrics(organization_id, project_id, timestamp DESC);
CREATE INDEX idx_llm_metrics_model ON public.llm_metrics(model_name, timestamp DESC);
CREATE INDEX idx_llm_metrics_request ON public.llm_metrics(request_id);
CREATE INDEX idx_llm_metrics_trace ON public.llm_metrics(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_llm_metrics_errors ON public.llm_metrics(organization_id, timestamp DESC) WHERE is_error = true;
CREATE INDEX idx_llm_metrics_latency ON public.llm_metrics(organization_id, latency_ms, timestamp DESC);

-- Metric definitions
CREATE INDEX idx_metric_definitions_org ON public.metric_definitions(organization_id);
CREATE INDEX idx_metric_definitions_project ON public.metric_definitions(project_id);

-- =====================================================
-- AGGREGATION FUNCTIONS
-- =====================================================

-- Function to aggregate metrics for a specific period
CREATE OR REPLACE FUNCTION public.aggregate_metrics(
    p_period public.aggregation_period,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS INTEGER AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO public.metrics_aggregated (
        organization_id,
        project_id,
        metric_name,
        period,
        period_start,
        period_end,
        count,
        sum,
        avg,
        min,
        max,
        percentiles,
        environment,
        model_name,
        tags
    )
    SELECT
        m.organization_id,
        m.project_id,
        m.metric_name,
        p_period,
        date_trunc(
            CASE p_period
                WHEN '1m' THEN 'minute'
                WHEN '5m' THEN 'minute'
                WHEN '15m' THEN 'minute'
                WHEN '1h' THEN 'hour'
                WHEN '6h' THEN 'hour'
                WHEN '1d' THEN 'day'
            END,
            m.timestamp
        ) AS period_start,
        date_trunc(
            CASE p_period
                WHEN '1m' THEN 'minute'
                WHEN '5m' THEN 'minute'
                WHEN '15m' THEN 'minute'
                WHEN '1h' THEN 'hour'
                WHEN '6h' THEN 'hour'
                WHEN '1d' THEN 'day'
            END,
            m.timestamp
        ) + (
            CASE p_period
                WHEN '1m' THEN INTERVAL '1 minute'
                WHEN '5m' THEN INTERVAL '5 minutes'
                WHEN '15m' THEN INTERVAL '15 minutes'
                WHEN '1h' THEN INTERVAL '1 hour'
                WHEN '6h' THEN INTERVAL '6 hours'
                WHEN '1d' THEN INTERVAL '1 day'
            END
        ) AS period_end,
        COUNT(*),
        SUM(m.value),
        AVG(m.value),
        MIN(m.value),
        MAX(m.value),
        jsonb_build_object(
            'p50', percentile_cont(0.50) WITHIN GROUP (ORDER BY m.value),
            'p75', percentile_cont(0.75) WITHIN GROUP (ORDER BY m.value),
            'p90', percentile_cont(0.90) WITHIN GROUP (ORDER BY m.value),
            'p95', percentile_cont(0.95) WITHIN GROUP (ORDER BY m.value),
            'p99', percentile_cont(0.99) WITHIN GROUP (ORDER BY m.value)
        ),
        m.environment,
        m.model_name,
        m.tags
    FROM public.metrics m
    WHERE m.timestamp >= p_start_time
      AND m.timestamp < p_end_time
    GROUP BY
        m.organization_id,
        m.project_id,
        m.metric_name,
        period_start,
        m.environment,
        m.model_name,
        m.tags
    ON CONFLICT (organization_id, project_id, metric_name, period, period_start, environment, model_name)
    DO UPDATE SET
        count = EXCLUDED.count,
        sum = EXCLUDED.sum,
        avg = EXCLUDED.avg,
        min = EXCLUDED.min,
        max = EXCLUDED.max,
        percentiles = EXCLUDED.percentiles;
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- Function to get metric statistics
CREATE OR REPLACE FUNCTION public.get_metric_stats(
    p_org_id UUID,
    p_project_id UUID,
    p_metric_name VARCHAR,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_environment VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    count BIGINT,
    avg_value DOUBLE PRECISION,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    p50 DOUBLE PRECISION,
    p95 DOUBLE PRECISION,
    p99 DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        AVG(m.value),
        MIN(m.value),
        MAX(m.value),
        percentile_cont(0.50) WITHIN GROUP (ORDER BY m.value),
        percentile_cont(0.95) WITHIN GROUP (ORDER BY m.value),
        percentile_cont(0.99) WITHIN GROUP (ORDER BY m.value)
    FROM public.metrics m
    WHERE m.organization_id = p_org_id
      AND m.project_id = p_project_id
      AND m.metric_name = p_metric_name
      AND m.timestamp >= p_start_time
      AND m.timestamp < p_end_time
      AND (p_environment IS NULL OR m.environment = p_environment);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get LLM metrics summary
CREATE OR REPLACE FUNCTION public.get_llm_metrics_summary(
    p_org_id UUID,
    p_project_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    model_name VARCHAR,
    total_requests BIGINT,
    total_tokens BIGINT,
    avg_latency_ms DOUBLE PRECISION,
    p95_latency_ms DOUBLE PRECISION,
    error_rate DOUBLE PRECISION,
    total_cost_cents DOUBLE PRECISION,
    avg_confidence DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lm.model_name,
        COUNT(*)::BIGINT AS total_requests,
        SUM(lm.total_tokens)::BIGINT AS total_tokens,
        AVG(lm.latency_ms) AS avg_latency_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY lm.latency_ms) AS p95_latency_ms,
        (COUNT(*) FILTER (WHERE lm.is_error))::DOUBLE PRECISION / NULLIF(COUNT(*), 0) AS error_rate,
        SUM(lm.estimated_cost_cents) AS total_cost_cents,
        AVG(lm.confidence_score) AS avg_confidence
    FROM public.llm_metrics lm
    WHERE lm.organization_id = p_org_id
      AND lm.project_id = p_project_id
      AND lm.timestamp >= p_start_time
      AND lm.timestamp < p_end_time
    GROUP BY lm.model_name
    ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_metric_definitions_updated_at
    BEFORE UPDATE ON public.metric_definitions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.metric_definitions IS 'Metric definitions and schemas for custom metrics';
COMMENT ON TABLE public.metrics IS 'Raw time-series metrics data, partitioned by timestamp';
COMMENT ON TABLE public.metrics_aggregated IS 'Pre-aggregated metrics for efficient querying';
COMMENT ON TABLE public.llm_metrics IS 'LLM-specific metrics including tokens, latency, and quality scores';
