-- Migration to add Audit Logs and support Global Cost Fairness
-- Target: Supabase / PostgreSQL

-- 1. Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_region TEXT NOT NULL,
    language TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    response_hash TEXT NOT NULL,
    hallucination_risk DECIMAL(3, 2) DEFAULT 0,
    toxicity_score DECIMAL(3, 2) DEFAULT 0,
    cost_usd DECIMAL(12, 6) DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    decision_status TEXT CHECK (decision_status IN ('safe', 'flagged', 'blocked')) DEFAULT 'safe',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Indexes for performance and fairness dashboard
CREATE INDEX IF NOT EXISTS idx_audit_logs_region_lang ON public.audit_logs(user_region, language);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- 3. Mock Data Insertion Function (for Hackathon Demo)
-- Note: Requires pgcrypto for digest() if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_mock_audit_data(target_user_id UUID)
RETURNS void AS $$
DECLARE
    regions TEXT[] := ARRAY['us-east-1', 'eu-central-1', 'ap-southeast-1', 'sa-east-1', 'af-south-1'];
    langs TEXT[] := ARRAY['en', 'de', 'ja', 'pt', 'zu'];
    models TEXT[] := ARRAY['gpt-4o', 'gemini-1.5-pro', 'claude-3-5-sonnet'];
    r TEXT;
    l TEXT;
    m TEXT;
    cost_mult FLOAT;
    lat_mult FLOAT;
BEGIN
    FOR i IN 1..100 LOOP
        r := regions[1 + floor(random() * 5)];
        l := langs[1 + floor(random() * 5)];
        m := models[1 + floor(random() * 3)];
        
        -- Artificial bias logic for Fairness Dashboard
        -- Africa and Southeast Asia pay more and have higher latency in this mock data
        IF r = 'af-south-1' OR r = 'ap-southeast-1' THEN
            cost_mult := 1.5 + (random() * 0.5);
            lat_mult := 2.0 + (random() * 1.5);
        ELSE
            cost_mult := 1.0;
            lat_mult := 1.0;
        END IF;

        INSERT INTO public.audit_logs (
            user_id,
            request_id,
            user_region,
            language,
            model,
            prompt_hash,
            response_hash,
            hallucination_risk,
            toxicity_score,
            cost_usd,
            latency_ms,
            decision_status
        ) VALUES (
            target_user_id,
            uuid_generate_v4(),
            r,
            l,
            m,
            encode(digest(random()::text, 'sha256'), 'hex'),
            encode(digest(random()::text, 'sha256'), 'hex'),
            random(),
            random(),
            (0.01 + (random() * 0.05)) * cost_mult,
            (200 + (random() * 800)) * lat_mult,
            CASE 
                WHEN random() > 0.95 THEN 'blocked'
                WHEN random() > 0.85 THEN 'flagged'
                ELSE 'safe'
            END
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
