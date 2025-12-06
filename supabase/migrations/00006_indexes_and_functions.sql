-- =====================================================
-- ObservAI Hub - Indexes, Functions, and Performance Optimizations
-- Version: 00006
-- Description: Additional indexes, materialized views, and utility functions
-- =====================================================

-- =====================================================
-- MATERIALIZED VIEWS FOR DASHBOARDS
-- =====================================================

-- Daily metrics summary (refreshed hourly)
CREATE MATERIALIZED VIEW public.mv_daily_metrics_summary AS
SELECT
    organization_id,
    project_id,
    metric_name,
    environment,
    model_name,
    date_trunc('day', timestamp) AS day,
    COUNT(*) AS data_points,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY value) AS p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY value) AS p99
FROM public.metrics
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 
    organization_id,
    project_id,
    metric_name,
    environment,
    model_name,
    date_trunc('day', timestamp);

CREATE UNIQUE INDEX idx_mv_daily_metrics ON public.mv_daily_metrics_summary(
    organization_id, project_id, metric_name, day, environment, model_name
);

-- Hourly LLM metrics summary
CREATE MATERIALIZED VIEW public.mv_hourly_llm_summary AS
SELECT
    organization_id,
    project_id,
    model_name,
    model_provider,
    environment,
    date_trunc('hour', timestamp) AS hour,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN is_error THEN 1 ELSE 0 END) AS error_count,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    SUM(total_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
    AVG(confidence_score) AS avg_confidence,
    SUM(estimated_cost_cents) AS total_cost_cents,
    AVG(tokens_per_second) AS avg_tokens_per_second
FROM public.llm_metrics
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 
    organization_id,
    project_id,
    model_name,
    model_provider,
    environment,
    date_trunc('hour', timestamp);

CREATE UNIQUE INDEX idx_mv_hourly_llm ON public.mv_hourly_llm_summary(
    organization_id, project_id, model_name, hour, environment
);

-- Active alerts count by organization
CREATE MATERIALIZED VIEW public.mv_active_alerts_count AS
SELECT
    organization_id,
    COUNT(*) FILTER (WHERE status = 'firing') AS firing_count,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_count,
    COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'warning') AS warning_count,
    COUNT(*) FILTER (WHERE severity = 'info') AS info_count
FROM public.alerts
WHERE status NOT IN ('resolved', 'silenced')
GROUP BY organization_id;

CREATE UNIQUE INDEX idx_mv_active_alerts ON public.mv_active_alerts_count(organization_id);

-- Log level distribution by hour
CREATE MATERIALIZED VIEW public.mv_log_level_distribution AS
SELECT
    organization_id,
    project_id,
    service_name,
    date_trunc('hour', timestamp) AS hour,
    level,
    COUNT(*) AS log_count
FROM public.logs
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 
    organization_id,
    project_id,
    service_name,
    date_trunc('hour', timestamp),
    level;

CREATE UNIQUE INDEX idx_mv_log_levels ON public.mv_log_level_distribution(
    organization_id, project_id, hour, level
);

-- =====================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_metrics_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hourly_llm_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_active_alerts_count;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_log_level_distribution;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_metrics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_metrics_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hourly_llm_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTITION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create future partitions
CREATE OR REPLACE FUNCTION public.create_future_partitions(
    p_table_name TEXT,
    p_months_ahead INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_partition_name TEXT;
    v_created_count INTEGER := 0;
BEGIN
    FOR i IN 0..p_months_ahead LOOP
        v_start_date := date_trunc('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        v_end_date := v_start_date + INTERVAL '1 month';
        v_partition_name := p_table_name || '_' || to_char(v_start_date, 'YYYY_MM');
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class 
            WHERE relname = v_partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I 
                 FOR VALUES FROM (%L) TO (%L)',
                v_partition_name, p_table_name, v_start_date, v_end_date
            );
            v_created_count := v_created_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (retention)
CREATE OR REPLACE FUNCTION public.drop_old_partitions(
    p_table_name TEXT,
    p_retention_months INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date DATE;
    v_partition RECORD;
    v_dropped_count INTEGER := 0;
BEGIN
    v_cutoff_date := date_trunc('month', CURRENT_DATE - (p_retention_months || ' months')::INTERVAL);
    
    FOR v_partition IN
        SELECT c.relname AS partition_name
        FROM pg_inherits i
        JOIN pg_class c ON i.inhrelid = c.oid
        JOIN pg_class p ON i.inhparent = p.oid
        WHERE p.relname = p_table_name
          AND c.relname ~ (p_table_name || '_\d{4}_\d{2}$')
    LOOP
        -- Extract date from partition name and check if it's old
        IF substring(v_partition.partition_name from '\d{4}_\d{2}$')::DATE < v_cutoff_date THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I', v_partition.partition_name);
            v_dropped_count := v_dropped_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_dropped_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATA RETENTION FUNCTIONS
-- =====================================================

-- Function to apply retention policy
CREATE OR REPLACE FUNCTION public.apply_retention_policy(p_org_id UUID)
RETURNS TABLE (
    table_name TEXT,
    deleted_count BIGINT
) AS $$
DECLARE
    v_settings JSONB;
    v_logs_days INTEGER;
    v_metrics_days INTEGER;
    v_traces_days INTEGER;
BEGIN
    -- Get retention settings from organization
    SELECT settings->'data_retention' INTO v_settings
    FROM public.organizations
    WHERE id = p_org_id;
    
    v_logs_days := COALESCE((v_settings->>'logs_days')::INTEGER, 30);
    v_metrics_days := COALESCE((v_settings->>'metrics_days')::INTEGER, 90);
    v_traces_days := COALESCE((v_settings->>'traces_days')::INTEGER, 14);
    
    -- Delete old logs
    DELETE FROM public.logs
    WHERE organization_id = p_org_id
      AND timestamp < now() - (v_logs_days || ' days')::INTERVAL;
    
    table_name := 'logs';
    deleted_count := ROW_COUNT;
    RETURN NEXT;
    
    -- Delete old metrics
    DELETE FROM public.metrics
    WHERE organization_id = p_org_id
      AND timestamp < now() - (v_metrics_days || ' days')::INTERVAL;
    
    table_name := 'metrics';
    deleted_count := ROW_COUNT;
    RETURN NEXT;
    
    -- Delete old LLM metrics
    DELETE FROM public.llm_metrics
    WHERE organization_id = p_org_id
      AND timestamp < now() - (v_metrics_days || ' days')::INTERVAL;
    
    table_name := 'llm_metrics';
    deleted_count := ROW_COUNT;
    RETURN NEXT;
    
    -- Delete old traces
    DELETE FROM public.traces
    WHERE organization_id = p_org_id
      AND start_time < now() - (v_traces_days || ' days')::INTERVAL;
    
    table_name := 'traces';
    deleted_count := ROW_COUNT;
    RETURN NEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =====================================================

-- Function to export user data (DSAR)
CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_profile', (
            SELECT to_jsonb(up.*)
            FROM public.user_profiles up
            WHERE up.id = p_user_id
        ),
        'organization_memberships', (
            SELECT jsonb_agg(to_jsonb(om.*))
            FROM public.organization_members om
            WHERE om.user_id = p_user_id
        ),
        'saved_searches', (
            SELECT jsonb_agg(to_jsonb(ss.*))
            FROM public.saved_searches ss
            WHERE ss.user_id = p_user_id
        ),
        'alert_comments', (
            SELECT jsonb_agg(to_jsonb(ac.*))
            FROM public.alert_comments ac
            WHERE ac.user_id = p_user_id
        ),
        'audit_logs', (
            SELECT jsonb_agg(to_jsonb(al.*))
            FROM public.audit_logs al
            WHERE al.user_id = p_user_id
        ),
        'export_timestamp', now()
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete user data (Right to be forgotten)
CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_count INTEGER;
BEGIN
    -- Delete alert comments
    DELETE FROM public.alert_comments WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('alert_comments_deleted', v_count);
    
    -- Delete saved searches
    DELETE FROM public.saved_searches WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('saved_searches_deleted', v_count);
    
    -- Anonymize audit logs (keep for compliance but remove PII)
    UPDATE public.audit_logs
    SET user_id = NULL,
        ip_address = NULL,
        metadata = metadata - 'user_email'
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('audit_logs_anonymized', v_count);
    
    -- Remove from organizations (except if sole owner)
    DELETE FROM public.organization_members
    WHERE user_id = p_user_id
      AND NOT (
          role = 'owner'
          AND NOT EXISTS (
              SELECT 1 FROM public.organization_members om2
              WHERE om2.organization_id = organization_members.organization_id
                AND om2.user_id != p_user_id
                AND om2.role = 'owner'
          )
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('memberships_removed', v_count);
    
    -- Delete user profile
    DELETE FROM public.user_profiles WHERE id = p_user_id;
    v_result := v_result || jsonb_build_object('profile_deleted', true);
    
    -- Note: The auth.users record should be deleted separately via Supabase Auth
    v_result := v_result || jsonb_build_object('deletion_timestamp', now());
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ANALYTICS FUNCTIONS
-- =====================================================

-- Function to get dashboard overview
CREATE OR REPLACE FUNCTION public.get_dashboard_overview(
    p_org_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_hours INTEGER DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_start_time TIMESTAMPTZ := now() - (p_hours || ' hours')::INTERVAL;
    v_prev_start_time TIMESTAMPTZ := v_start_time - (p_hours || ' hours')::INTERVAL;
BEGIN
    WITH current_period AS (
        SELECT
            COUNT(*) AS total_requests,
            AVG(latency_ms) AS avg_latency,
            SUM(total_tokens) AS total_tokens,
            SUM(CASE WHEN is_error THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 AS error_rate
        FROM public.llm_metrics
        WHERE organization_id = p_org_id
          AND (p_project_id IS NULL OR project_id = p_project_id)
          AND timestamp >= v_start_time
    ),
    previous_period AS (
        SELECT
            COUNT(*) AS total_requests,
            AVG(latency_ms) AS avg_latency,
            SUM(total_tokens) AS total_tokens
        FROM public.llm_metrics
        WHERE organization_id = p_org_id
          AND (p_project_id IS NULL OR project_id = p_project_id)
          AND timestamp >= v_prev_start_time
          AND timestamp < v_start_time
    ),
    active_alerts AS (
        SELECT COUNT(*) AS count
        FROM public.alerts
        WHERE organization_id = p_org_id
          AND status IN ('firing', 'pending')
    )
    SELECT jsonb_build_object(
        'current_period', to_jsonb(cp.*),
        'previous_period', to_jsonb(pp.*),
        'active_alerts', aa.count,
        'changes', jsonb_build_object(
            'requests_change', 
                CASE WHEN pp.total_requests > 0 
                     THEN ((cp.total_requests - pp.total_requests)::FLOAT / pp.total_requests * 100)
                     ELSE 0 
                END,
            'latency_change',
                CASE WHEN pp.avg_latency > 0
                     THEN ((cp.avg_latency - pp.avg_latency) / pp.avg_latency * 100)
                     ELSE 0
                END,
            'tokens_change',
                CASE WHEN pp.total_tokens > 0
                     THEN ((cp.total_tokens - pp.total_tokens)::FLOAT / pp.total_tokens * 100)
                     ELSE 0
                END
        ),
        'time_range', jsonb_build_object(
            'start', v_start_time,
            'end', now()
        )
    ) INTO v_result
    FROM current_period cp
    CROSS JOIN previous_period pp
    CROSS JOIN active_alerts aa;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get time series data
CREATE OR REPLACE FUNCTION public.get_time_series(
    p_org_id UUID,
    p_project_id UUID,
    p_metric_name VARCHAR,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_granularity VARCHAR DEFAULT '1h'
)
RETURNS TABLE (
    bucket TIMESTAMPTZ,
    avg_value DOUBLE PRECISION,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    count BIGINT
) AS $$
DECLARE
    v_interval INTERVAL;
BEGIN
    v_interval := CASE p_granularity
        WHEN '1m' THEN '1 minute'::INTERVAL
        WHEN '5m' THEN '5 minutes'::INTERVAL
        WHEN '15m' THEN '15 minutes'::INTERVAL
        WHEN '1h' THEN '1 hour'::INTERVAL
        WHEN '6h' THEN '6 hours'::INTERVAL
        WHEN '1d' THEN '1 day'::INTERVAL
        ELSE '1 hour'::INTERVAL
    END;
    
    RETURN QUERY
    SELECT
        date_trunc(
            CASE p_granularity
                WHEN '1m' THEN 'minute'
                WHEN '5m' THEN 'minute'
                WHEN '15m' THEN 'minute'
                WHEN '1h' THEN 'hour'
                WHEN '6h' THEN 'hour'
                WHEN '1d' THEN 'day'
                ELSE 'hour'
            END,
            m.timestamp
        ) AS bucket,
        AVG(m.value) AS avg_value,
        MIN(m.value) AS min_value,
        MAX(m.value) AS max_value,
        COUNT(*)::BIGINT AS count
    FROM public.metrics m
    WHERE m.organization_id = p_org_id
      AND m.project_id = p_project_id
      AND m.metric_name = p_metric_name
      AND m.timestamp >= p_start_time
      AND m.timestamp < p_end_time
    GROUP BY bucket
    ORDER BY bucket;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- REAL-TIME NOTIFICATION TRIGGER
-- =====================================================

-- Function to notify on new alerts
CREATE OR REPLACE FUNCTION public.notify_new_alert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'new_alert',
        json_build_object(
            'id', NEW.id,
            'organization_id', NEW.organization_id,
            'severity', NEW.severity,
            'status', NEW.status,
            'title', NEW.title
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_alert
    AFTER INSERT ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_alert();

-- Function to notify on alert status changes
CREATE OR REPLACE FUNCTION public.notify_alert_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM pg_notify(
            'alert_status_change',
            json_build_object(
                'id', NEW.id,
                'organization_id', NEW.organization_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'title', NEW.title
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_alert_status_change
    AFTER UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_alert_status_change();

-- =====================================================
-- VACUUM AND ANALYZE RECOMMENDATIONS
-- =====================================================

-- Create a function to get vacuum recommendations
CREATE OR REPLACE FUNCTION public.get_vacuum_recommendations()
RETURNS TABLE (
    table_name TEXT,
    dead_tuples BIGINT,
    live_tuples BIGINT,
    dead_ratio NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname || '.' || relname AS table_name,
        n_dead_tup,
        n_live_tup,
        ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_ratio,
        CASE
            WHEN n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) > 0.2 
            THEN 'VACUUM ANALYZE recommended'
            WHEN n_dead_tup > 10000 
            THEN 'Consider VACUUM'
            ELSE 'OK'
        END AS recommendation
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY dead_ratio DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON MATERIALIZED VIEW public.mv_daily_metrics_summary IS 'Pre-aggregated daily metrics for fast dashboard queries';
COMMENT ON MATERIALIZED VIEW public.mv_hourly_llm_summary IS 'Hourly LLM metrics rollup for trend analysis';
COMMENT ON MATERIALIZED VIEW public.mv_active_alerts_count IS 'Quick access to active alert counts per organization';
COMMENT ON FUNCTION public.refresh_all_materialized_views IS 'Refreshes all materialized views, called by cron';
COMMENT ON FUNCTION public.apply_retention_policy IS 'Applies data retention policy for an organization';
COMMENT ON FUNCTION public.export_user_data IS 'GDPR DSAR - exports all user data';
COMMENT ON FUNCTION public.delete_user_data IS 'GDPR Right to be forgotten - deletes/anonymizes user data';
