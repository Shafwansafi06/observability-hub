-- =====================================================
-- ObservAI Hub - Logs Tables Migration
-- Version: 00003
-- Description: Structured logging with full-text search and correlation
-- =====================================================

-- =====================================================
-- ENUM TYPES FOR LOGS
-- =====================================================

CREATE TYPE public.log_level AS ENUM ('trace', 'debug', 'info', 'warn', 'error', 'fatal');
CREATE TYPE public.log_source AS ENUM ('application', 'llm', 'infrastructure', 'security', 'system');

-- =====================================================
-- LOGS TABLE
-- =====================================================

CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Log identity
    level public.log_level NOT NULL DEFAULT 'info',
    source public.log_source NOT NULL DEFAULT 'application',
    
    -- Content
    message TEXT NOT NULL,
    message_template TEXT, -- Original template before parameter substitution
    
    -- Structured data
    attributes JSONB NOT NULL DEFAULT '{}',
    
    -- Context
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    service_name VARCHAR(255),
    service_version VARCHAR(50),
    host_name VARCHAR(255),
    
    -- Correlation
    trace_id UUID,
    span_id UUID,
    parent_span_id UUID,
    request_id UUID,
    user_id UUID,
    session_id UUID,
    
    -- LLM-specific context
    model_name VARCHAR(255),
    prompt_hash VARCHAR(64), -- For grouping similar prompts
    
    -- Error details (if level = error or fatal)
    error_type VARCHAR(255),
    error_message TEXT,
    error_stack TEXT,
    
    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Full-text search vector
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(message, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(service_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(error_message, '')), 'B')
    ) STORED
) PARTITION BY RANGE (timestamp);

-- Create partitions for logs
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..2 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'logs_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.logs 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.logs_default PARTITION OF public.logs DEFAULT;

-- =====================================================
-- TRACES TABLE
-- =====================================================

CREATE TABLE public.traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id UUID NOT NULL UNIQUE,
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Trace metadata
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    service_name VARCHAR(255),
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'unset', -- 'unset', 'ok', 'error'
    status_message TEXT,
    
    -- Counts
    span_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- Root span info
    root_span_id UUID,
    root_span_name VARCHAR(255),
    
    -- User context
    user_id UUID,
    session_id UUID,
    
    -- Custom attributes
    attributes JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SPANS TABLE
-- =====================================================

CREATE TABLE public.spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    span_id UUID NOT NULL,
    trace_id UUID NOT NULL REFERENCES public.traces(trace_id) ON DELETE CASCADE,
    parent_span_id UUID,
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Span identity
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'internal', -- 'internal', 'server', 'client', 'producer', 'consumer'
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'unset',
    status_message TEXT,
    
    -- Service context
    service_name VARCHAR(255),
    service_version VARCHAR(50),
    
    -- LLM-specific fields
    is_llm_span BOOLEAN NOT NULL DEFAULT false,
    model_name VARCHAR(255),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    
    -- Attributes
    attributes JSONB NOT NULL DEFAULT '{}',
    
    -- Events within span
    events JSONB NOT NULL DEFAULT '[]',
    
    -- Links to other traces
    links JSONB NOT NULL DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT spans_span_trace_unique UNIQUE (span_id, trace_id)
);

-- =====================================================
-- LOG PATTERNS TABLE (for grouping similar logs)
-- =====================================================

CREATE TABLE public.log_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Pattern identity
    pattern_hash VARCHAR(64) NOT NULL,
    pattern_template TEXT NOT NULL,
    
    -- Statistics
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrence_count BIGINT NOT NULL DEFAULT 1,
    
    -- Categorization
    level public.log_level,
    source public.log_source,
    service_name VARCHAR(255),
    
    -- Analysis
    is_error BOOLEAN NOT NULL DEFAULT false,
    is_anomaly BOOLEAN NOT NULL DEFAULT false,
    
    -- User annotations
    title VARCHAR(255),
    description TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_muted BOOLEAN NOT NULL DEFAULT false,
    muted_until TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT log_patterns_hash_unique UNIQUE (organization_id, project_id, pattern_hash)
);

-- =====================================================
-- SAVED SEARCHES TABLE
-- =====================================================

CREATE TABLE public.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Search definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}',
    
    -- Display settings
    columns TEXT[] NOT NULL DEFAULT ARRAY['timestamp', 'level', 'message'],
    sort_by VARCHAR(100) NOT NULL DEFAULT 'timestamp',
    sort_order VARCHAR(4) NOT NULL DEFAULT 'desc',
    
    -- Sharing
    is_shared BOOLEAN NOT NULL DEFAULT false,
    shared_with_org BOOLEAN NOT NULL DEFAULT false,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR LOGS
-- =====================================================

-- Logs table indexes
CREATE INDEX idx_logs_org_project_time ON public.logs(organization_id, project_id, timestamp DESC);
CREATE INDEX idx_logs_level ON public.logs(organization_id, level, timestamp DESC);
CREATE INDEX idx_logs_source ON public.logs(organization_id, source, timestamp DESC);
CREATE INDEX idx_logs_trace ON public.logs(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_logs_request ON public.logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_logs_service ON public.logs(organization_id, service_name, timestamp DESC);
CREATE INDEX idx_logs_error ON public.logs(organization_id, timestamp DESC) WHERE level IN ('error', 'fatal');
CREATE INDEX idx_logs_model ON public.logs(model_name, timestamp DESC) WHERE model_name IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_logs_search ON public.logs USING GIN(search_vector);

-- JSONB indexes for attributes
CREATE INDEX idx_logs_attributes ON public.logs USING GIN(attributes jsonb_path_ops);

-- Traces indexes
CREATE INDEX idx_traces_org_time ON public.traces(organization_id, project_id, start_time DESC);
CREATE INDEX idx_traces_trace_id ON public.traces(trace_id);
CREATE INDEX idx_traces_service ON public.traces(service_name, start_time DESC);
CREATE INDEX idx_traces_user ON public.traces(user_id, start_time DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_traces_errors ON public.traces(organization_id, start_time DESC) WHERE status = 'error';

-- Spans indexes
CREATE INDEX idx_spans_trace ON public.spans(trace_id);
CREATE INDEX idx_spans_parent ON public.spans(parent_span_id) WHERE parent_span_id IS NOT NULL;
CREATE INDEX idx_spans_service ON public.spans(service_name, start_time DESC);
CREATE INDEX idx_spans_llm ON public.spans(organization_id, start_time DESC) WHERE is_llm_span = true;

-- Log patterns indexes
CREATE INDEX idx_log_patterns_org ON public.log_patterns(organization_id, last_seen_at DESC);
CREATE INDEX idx_log_patterns_hash ON public.log_patterns(pattern_hash);

-- Saved searches indexes
CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id);
CREATE INDEX idx_saved_searches_org ON public.saved_searches(organization_id) WHERE is_shared = true;

-- =====================================================
-- FUNCTIONS FOR LOGS
-- =====================================================

-- Function to search logs
CREATE OR REPLACE FUNCTION public.search_logs(
    p_org_id UUID,
    p_project_id UUID,
    p_query TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_levels public.log_level[] DEFAULT NULL,
    p_sources public.log_source[] DEFAULT NULL,
    p_service_name VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    level public.log_level,
    source public.log_source,
    message TEXT,
    service_name VARCHAR,
    trace_id UUID,
    attributes JSONB,
    timestamp TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.level,
        l.source,
        l.message,
        l.service_name,
        l.trace_id,
        l.attributes,
        l.timestamp,
        ts_rank(l.search_vector, websearch_to_tsquery('english', p_query)) AS rank
    FROM public.logs l
    WHERE l.organization_id = p_org_id
      AND l.project_id = p_project_id
      AND l.timestamp >= p_start_time
      AND l.timestamp < p_end_time
      AND (p_query IS NULL OR p_query = '' OR l.search_vector @@ websearch_to_tsquery('english', p_query))
      AND (p_levels IS NULL OR l.level = ANY(p_levels))
      AND (p_sources IS NULL OR l.source = ANY(p_sources))
      AND (p_service_name IS NULL OR l.service_name = p_service_name)
    ORDER BY 
        CASE WHEN p_query IS NOT NULL AND p_query != '' 
             THEN ts_rank(l.search_vector, websearch_to_tsquery('english', p_query)) 
             ELSE 0 
        END DESC,
        l.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get log statistics
CREATE OR REPLACE FUNCTION public.get_log_stats(
    p_org_id UUID,
    p_project_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    level public.log_level,
    count BIGINT,
    percentage DOUBLE PRECISION
) AS $$
DECLARE
    total_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM public.logs
    WHERE organization_id = p_org_id
      AND project_id = p_project_id
      AND timestamp >= p_start_time
      AND timestamp < p_end_time;
    
    RETURN QUERY
    SELECT
        l.level,
        COUNT(*)::BIGINT,
        (COUNT(*)::DOUBLE PRECISION / NULLIF(total_count, 0) * 100)
    FROM public.logs l
    WHERE l.organization_id = p_org_id
      AND l.project_id = p_project_id
      AND l.timestamp >= p_start_time
      AND l.timestamp < p_end_time
    GROUP BY l.level
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get trace with spans
CREATE OR REPLACE FUNCTION public.get_trace_with_spans(p_trace_id UUID)
RETURNS TABLE (
    trace_data JSONB,
    spans_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_jsonb(t.*) AS trace_data,
        COALESCE(
            jsonb_agg(
                to_jsonb(s.*) ORDER BY s.start_time
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'::jsonb
        ) AS spans_data
    FROM public.traces t
    LEFT JOIN public.spans s ON s.trace_id = t.trace_id
    WHERE t.trace_id = p_trace_id
    GROUP BY t.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to extract and store log pattern
CREATE OR REPLACE FUNCTION public.extract_log_pattern(
    p_org_id UUID,
    p_project_id UUID,
    p_message TEXT,
    p_level public.log_level,
    p_source public.log_source,
    p_service_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_pattern_template TEXT;
    v_pattern_hash VARCHAR(64);
    v_pattern_id UUID;
BEGIN
    -- Simple pattern extraction: replace numbers, UUIDs, and quoted strings
    v_pattern_template := regexp_replace(p_message, '\d+', '<NUM>', 'g');
    v_pattern_template := regexp_replace(v_pattern_template, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<UUID>', 'gi');
    v_pattern_template := regexp_replace(v_pattern_template, '''[^'']*''', '<STR>', 'g');
    v_pattern_template := regexp_replace(v_pattern_template, '"[^"]*"', '<STR>', 'g');
    
    v_pattern_hash := encode(digest(v_pattern_template || p_service_name, 'sha256'), 'hex');
    
    INSERT INTO public.log_patterns (
        organization_id,
        project_id,
        pattern_hash,
        pattern_template,
        level,
        source,
        service_name,
        is_error
    )
    VALUES (
        p_org_id,
        p_project_id,
        v_pattern_hash,
        v_pattern_template,
        p_level,
        p_source,
        p_service_name,
        p_level IN ('error', 'fatal')
    )
    ON CONFLICT (organization_id, project_id, pattern_hash)
    DO UPDATE SET
        last_seen_at = now(),
        occurrence_count = public.log_patterns.occurrence_count + 1
    RETURNING id INTO v_pattern_id;
    
    RETURN v_pattern_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_traces_updated_at
    BEFORE UPDATE ON public.traces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_log_patterns_updated_at
    BEFORE UPDATE ON public.log_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at
    BEFORE UPDATE ON public.saved_searches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.logs IS 'Structured log entries with full-text search support';
COMMENT ON TABLE public.traces IS 'Distributed traces for request tracking';
COMMENT ON TABLE public.spans IS 'Individual spans within traces';
COMMENT ON TABLE public.log_patterns IS 'Extracted log patterns for grouping and analysis';
COMMENT ON TABLE public.saved_searches IS 'User-saved log search queries';
