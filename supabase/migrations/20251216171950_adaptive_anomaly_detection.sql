-- User Baselines Table (stores learned normal behavior)
CREATE TABLE IF NOT EXISTS user_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    mean DOUBLE PRECISION NOT NULL,
    stddev DOUBLE PRECISION NOT NULL,
    p50 DOUBLE PRECISION NOT NULL,
    p95 DOUBLE PRECISION NOT NULL,
    p99 DOUBLE PRECISION NOT NULL,
    sample_size INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, metric_name)
);

-- Anomalies Table (stores detected anomalies)
CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    request_id UUID REFERENCES llm_requests(id) ON DELETE CASCADE,
    anomaly_type TEXT NOT NULL,
    detection_method TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metric_name TEXT NOT NULL,
    actual_value DOUBLE PRECISION NOT NULL,
    expected_value DOUBLE PRECISION NOT NULL,
    z_score DOUBLE PRECISION,
    baseline_mean DOUBLE PRECISION,
    baseline_stddev DOUBLE PRECISION,
    deviation_percentage TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_baselines_user_id ON user_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_user_baselines_metric ON user_baselines(metric_name);
CREATE INDEX IF NOT EXISTS idx_user_baselines_computed ON user_baselines(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_request_id ON anomalies(request_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_created ON anomalies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(resolved);

-- Row Level Security
ALTER TABLE user_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own baselines"
    ON user_baselines FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own anomalies"
    ON anomalies FOR SELECT
    USING (auth.uid()::text = user_id);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_baselines_updated_at BEFORE UPDATE ON user_baselines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anomalies_updated_at BEFORE UPDATE ON anomalies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schedule automatic anomaly detection (every 5 minutes)
-- Note: Requires pg_cron extension
-- SELECT cron.schedule('adaptive-anomaly-detection', '*/5 * * * *', 
--   $$ SELECT net.http_post(
--        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/adaptive-anomaly-detection',
--        headers:='{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
--      ) $$
-- );
