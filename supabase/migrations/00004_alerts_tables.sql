-- =====================================================
-- ObservAI Hub - Alerts Tables Migration
-- Version: 00004
-- Description: Alert rules, incidents, and notification system
-- =====================================================

-- =====================================================
-- ENUM TYPES FOR ALERTS
-- =====================================================

CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.alert_status AS ENUM ('pending', 'firing', 'resolved', 'acknowledged', 'silenced');
CREATE TYPE public.alert_condition_type AS ENUM ('threshold', 'anomaly', 'absence', 'rate_change', 'pattern');
CREATE TYPE public.notification_channel AS ENUM ('email', 'slack', 'pagerduty', 'webhook', 'sms', 'teams');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- =====================================================
-- ALERT RULES TABLE
-- =====================================================

CREATE TABLE public.alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Rule identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule configuration
    enabled BOOLEAN NOT NULL DEFAULT true,
    severity public.alert_severity NOT NULL DEFAULT 'warning',
    
    -- Condition
    condition_type public.alert_condition_type NOT NULL DEFAULT 'threshold',
    condition_config JSONB NOT NULL DEFAULT '{
        "metric": "",
        "operator": "gt",
        "threshold": 0,
        "for_duration": "5m"
    }',
    
    -- Query for the metric/log
    query TEXT NOT NULL,
    
    -- Evaluation settings
    evaluation_interval_seconds INTEGER NOT NULL DEFAULT 60,
    pending_period_seconds INTEGER NOT NULL DEFAULT 300,
    
    -- Grouping and labels
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    group_by TEXT[] NOT NULL DEFAULT '{}',
    
    -- Notifications
    notification_channels UUID[] NOT NULL DEFAULT '{}',
    
    -- Auto-resolve
    auto_resolve BOOLEAN NOT NULL DEFAULT true,
    resolve_after_seconds INTEGER NOT NULL DEFAULT 300,
    
    -- Silencing
    is_silenced BOOLEAN NOT NULL DEFAULT false,
    silenced_until TIMESTAMPTZ,
    silenced_by UUID REFERENCES auth.users(id),
    silence_reason TEXT,
    
    -- Statistics
    last_evaluation_at TIMESTAMPTZ,
    last_fired_at TIMESTAMPTZ,
    fire_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ALERTS TABLE (Alert Instances)
-- =====================================================

CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID,
    alert_rule_id UUID NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
    
    -- Alert identity
    fingerprint VARCHAR(64) NOT NULL, -- Hash for deduplication
    
    -- Status
    status public.alert_status NOT NULL DEFAULT 'pending',
    severity public.alert_severity NOT NULL,
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Context
    labels JSONB NOT NULL DEFAULT '{}',
    annotations JSONB NOT NULL DEFAULT '{}',
    
    -- Values at the time of alert
    current_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    
    -- Source
    source VARCHAR(255),
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    model_name VARCHAR(255),
    
    -- Correlation
    trace_id UUID,
    related_alerts UUID[] NOT NULL DEFAULT '{}',
    
    -- Timeline
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Resolution details
    resolution_type VARCHAR(50), -- 'manual', 'auto', 'timeout'
    resolution_note TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATION CHANNELS TABLE
-- =====================================================

CREATE TABLE public.notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Channel identity
    name VARCHAR(255) NOT NULL,
    channel_type public.notification_channel NOT NULL,
    
    -- Configuration (encrypted in application layer)
    config JSONB NOT NULL DEFAULT '{}',
    
    -- Email specific
    -- config: { "to": ["email@example.com"], "cc": [], "subject_template": "" }
    
    -- Slack specific
    -- config: { "webhook_url": "", "channel": "", "username": "" }
    
    -- PagerDuty specific
    -- config: { "routing_key": "", "severity_map": {} }
    
    -- Webhook specific
    -- config: { "url": "", "method": "POST", "headers": {}, "body_template": "" }
    
    -- Testing
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(50),
    
    -- Rate limiting
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
    
    -- Statistics
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATION HISTORY TABLE
-- =====================================================

CREATE TABLE public.notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES public.notification_channels(id) ON DELETE SET NULL,
    
    -- Notification details
    channel_type public.notification_channel NOT NULL,
    status public.notification_status NOT NULL DEFAULT 'pending',
    
    -- Content
    subject TEXT,
    body TEXT,
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    -- Response from provider
    provider_response JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create partitions
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..2 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'notification_history_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.notification_history 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_history_default PARTITION OF public.notification_history DEFAULT;

-- =====================================================
-- ANOMALIES TABLE
-- =====================================================

CREATE TABLE public.anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    project_id UUID NOT NULL,
    
    -- Anomaly identity
    anomaly_type VARCHAR(100) NOT NULL, -- 'latency_spike', 'error_burst', 'token_anomaly', 'confidence_drop'
    
    -- Detection
    detection_method VARCHAR(50) NOT NULL, -- 'zscore', 'mad', 'iqr', 'ml'
    
    -- Severity
    severity public.alert_severity NOT NULL DEFAULT 'warning',
    confidence_score DOUBLE PRECISION NOT NULL, -- 0-1
    
    -- Context
    metric_name VARCHAR(255),
    model_name VARCHAR(255),
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    
    -- Values
    observed_value DOUBLE PRECISION NOT NULL,
    expected_value DOUBLE PRECISION NOT NULL,
    baseline_mean DOUBLE PRECISION,
    baseline_stddev DOUBLE PRECISION,
    deviation_score DOUBLE PRECISION NOT NULL, -- Number of std deviations
    
    -- Impact
    affected_requests INTEGER,
    affected_users INTEGER,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'new', -- 'new', 'investigating', 'confirmed', 'false_positive', 'resolved'
    
    -- Correlation
    related_alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
    related_trace_ids UUID[] NOT NULL DEFAULT '{}',
    
    -- Investigation
    investigated_by UUID REFERENCES auth.users(id),
    investigation_notes TEXT,
    
    -- Timeline
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ON-CALL SCHEDULES TABLE
-- =====================================================

CREATE TABLE public.oncall_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Schedule identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    
    -- Rotation configuration
    rotation_type VARCHAR(50) NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'custom'
    rotation_config JSONB NOT NULL DEFAULT '{
        "start_day": 1,
        "start_hour": 9,
        "handoff_hour": 9
    }',
    
    -- Members
    members UUID[] NOT NULL DEFAULT '{}',
    current_oncall_user_id UUID REFERENCES auth.users(id),
    current_rotation_start TIMESTAMPTZ,
    current_rotation_end TIMESTAMPTZ,
    
    -- Escalation
    escalation_timeout_minutes INTEGER NOT NULL DEFAULT 30,
    escalation_levels JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ALERT COMMENTS TABLE
-- =====================================================

CREATE TABLE public.alert_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR ALERTS
-- =====================================================

-- Alert rules
CREATE INDEX idx_alert_rules_org ON public.alert_rules(organization_id) WHERE enabled = true;
CREATE INDEX idx_alert_rules_project ON public.alert_rules(project_id) WHERE enabled = true;
CREATE INDEX idx_alert_rules_evaluation ON public.alert_rules(last_evaluation_at) WHERE enabled = true;

-- Alerts
CREATE INDEX idx_alerts_org_status ON public.alerts(organization_id, status, started_at DESC);
CREATE INDEX idx_alerts_rule ON public.alerts(alert_rule_id, started_at DESC);
CREATE INDEX idx_alerts_fingerprint ON public.alerts(fingerprint, started_at DESC);
CREATE INDEX idx_alerts_severity ON public.alerts(organization_id, severity, status);
CREATE INDEX idx_alerts_active ON public.alerts(organization_id, started_at DESC) 
    WHERE status IN ('pending', 'firing');

-- Notification channels
CREATE INDEX idx_notification_channels_org ON public.notification_channels(organization_id) WHERE enabled = true;

-- Notification history
CREATE INDEX idx_notification_history_alert ON public.notification_history(alert_id, created_at DESC);
CREATE INDEX idx_notification_history_status ON public.notification_history(status, created_at DESC);

-- Anomalies
CREATE INDEX idx_anomalies_org_time ON public.anomalies(organization_id, project_id, detected_at DESC);
CREATE INDEX idx_anomalies_type ON public.anomalies(anomaly_type, detected_at DESC);
CREATE INDEX idx_anomalies_status ON public.anomalies(organization_id, status, detected_at DESC);
CREATE INDEX idx_anomalies_severity ON public.anomalies(severity, detected_at DESC);

-- On-call schedules
CREATE INDEX idx_oncall_schedules_org ON public.oncall_schedules(organization_id) WHERE enabled = true;
CREATE INDEX idx_oncall_current ON public.oncall_schedules(current_oncall_user_id) WHERE enabled = true;

-- Alert comments
CREATE INDEX idx_alert_comments_alert ON public.alert_comments(alert_id, created_at DESC);

-- =====================================================
-- FUNCTIONS FOR ALERTS
-- =====================================================

-- Function to create alert fingerprint
CREATE OR REPLACE FUNCTION public.generate_alert_fingerprint(
    p_rule_id UUID,
    p_labels JSONB
)
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(
        digest(
            p_rule_id::text || COALESCE(p_labels::text, ''),
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to fire an alert
CREATE OR REPLACE FUNCTION public.fire_alert(
    p_rule_id UUID,
    p_current_value DOUBLE PRECISION,
    p_labels JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_rule RECORD;
    v_fingerprint VARCHAR(64);
    v_existing_alert_id UUID;
    v_alert_id UUID;
BEGIN
    -- Get the rule
    SELECT * INTO v_rule FROM public.alert_rules WHERE id = p_rule_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Alert rule not found: %', p_rule_id;
    END IF;
    
    -- Generate fingerprint
    v_fingerprint := public.generate_alert_fingerprint(p_rule_id, p_labels);
    
    -- Check for existing active alert
    SELECT id INTO v_existing_alert_id
    FROM public.alerts
    WHERE fingerprint = v_fingerprint
      AND status IN ('pending', 'firing')
    LIMIT 1;
    
    IF v_existing_alert_id IS NOT NULL THEN
        -- Update existing alert
        UPDATE public.alerts
        SET current_value = p_current_value,
            updated_at = now()
        WHERE id = v_existing_alert_id;
        
        RETURN v_existing_alert_id;
    END IF;
    
    -- Create new alert
    INSERT INTO public.alerts (
        organization_id,
        project_id,
        alert_rule_id,
        fingerprint,
        status,
        severity,
        title,
        description,
        labels,
        annotations,
        current_value,
        threshold_value
    )
    VALUES (
        v_rule.organization_id,
        v_rule.project_id,
        p_rule_id,
        v_fingerprint,
        'firing',
        v_rule.severity,
        v_rule.name,
        v_rule.description,
        p_labels,
        v_rule.annotations,
        p_current_value,
        (v_rule.condition_config->>'threshold')::DOUBLE PRECISION
    )
    RETURNING id INTO v_alert_id;
    
    -- Update rule statistics
    UPDATE public.alert_rules
    SET last_fired_at = now(),
        fire_count = fire_count + 1
    WHERE id = p_rule_id;
    
    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve alert
CREATE OR REPLACE FUNCTION public.resolve_alert(
    p_alert_id UUID,
    p_resolved_by UUID DEFAULT NULL,
    p_resolution_type VARCHAR DEFAULT 'auto',
    p_resolution_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.alerts
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = p_resolved_by,
        resolution_type = p_resolution_type,
        resolution_note = p_resolution_note,
        updated_at = now()
    WHERE id = p_alert_id
      AND status NOT IN ('resolved');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to acknowledge alert
CREATE OR REPLACE FUNCTION public.acknowledge_alert(
    p_alert_id UUID,
    p_acknowledged_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.alerts
    SET status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = p_acknowledged_by,
        updated_at = now()
    WHERE id = p_alert_id
      AND status IN ('pending', 'firing');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomaly
CREATE OR REPLACE FUNCTION public.detect_anomaly_zscore(
    p_org_id UUID,
    p_project_id UUID,
    p_metric_name VARCHAR,
    p_current_value DOUBLE PRECISION,
    p_lookback_hours INTEGER DEFAULT 24,
    p_threshold_stddev DOUBLE PRECISION DEFAULT 3.0
)
RETURNS TABLE (
    is_anomaly BOOLEAN,
    z_score DOUBLE PRECISION,
    baseline_mean DOUBLE PRECISION,
    baseline_stddev DOUBLE PRECISION,
    confidence DOUBLE PRECISION
) AS $$
DECLARE
    v_mean DOUBLE PRECISION;
    v_stddev DOUBLE PRECISION;
    v_z_score DOUBLE PRECISION;
BEGIN
    -- Calculate baseline statistics
    SELECT 
        AVG(m.value),
        STDDEV(m.value)
    INTO v_mean, v_stddev
    FROM public.metrics m
    WHERE m.organization_id = p_org_id
      AND m.project_id = p_project_id
      AND m.metric_name = p_metric_name
      AND m.timestamp >= now() - (p_lookback_hours || ' hours')::INTERVAL;
    
    -- Calculate z-score
    IF v_stddev IS NOT NULL AND v_stddev > 0 THEN
        v_z_score := ABS(p_current_value - v_mean) / v_stddev;
    ELSE
        v_z_score := 0;
    END IF;
    
    RETURN QUERY SELECT
        v_z_score > p_threshold_stddev,
        v_z_score,
        v_mean,
        v_stddev,
        CASE 
            WHEN v_z_score > p_threshold_stddev THEN LEAST(v_z_score / 5.0, 1.0)
            ELSE 0.0
        END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get active alerts summary
CREATE OR REPLACE FUNCTION public.get_alerts_summary(p_org_id UUID)
RETURNS TABLE (
    total_active INTEGER,
    critical_count INTEGER,
    warning_count INTEGER,
    info_count INTEGER,
    pending_count INTEGER,
    firing_count INTEGER,
    acknowledged_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_active,
        COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER,
        COUNT(*) FILTER (WHERE severity = 'info')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'firing')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'acknowledged')::INTEGER
    FROM public.alerts
    WHERE organization_id = p_org_id
      AND status NOT IN ('resolved', 'silenced');
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON public.alert_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_channels_updated_at
    BEFORE UPDATE ON public.notification_channels
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_anomalies_updated_at
    BEFORE UPDATE ON public.anomalies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oncall_schedules_updated_at
    BEFORE UPDATE ON public.oncall_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_comments_updated_at
    BEFORE UPDATE ON public.alert_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.alert_rules IS 'Configurable alert rules with conditions and notification settings';
COMMENT ON TABLE public.alerts IS 'Active and historical alert instances';
COMMENT ON TABLE public.notification_channels IS 'Configured notification delivery channels';
COMMENT ON TABLE public.notification_history IS 'History of all sent notifications';
COMMENT ON TABLE public.anomalies IS 'Detected anomalies with statistical context';
COMMENT ON TABLE public.oncall_schedules IS 'On-call rotation schedules for alert escalation';
COMMENT ON TABLE public.alert_comments IS 'Comments and notes on alerts for collaboration';
