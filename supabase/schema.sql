-- ObservAI Hub Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (automatically created by Supabase Auth, we'll extend it)
-- Create a public users table for additional profile info
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- LLM Requests table - stores all LLM API calls
CREATE TABLE IF NOT EXISTS public.llm_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request details
  model TEXT NOT NULL,
  prompt TEXT,
  response TEXT,
  prompt_category TEXT,
  
  -- Performance metrics
  latency_ms INTEGER NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  tokens_total INTEGER,
  
  -- Cost tracking
  cost_usd NUMERIC(10, 6),
  
  -- Quality metrics
  coherence_score NUMERIC(3, 2),
  toxicity_score NUMERIC(3, 2),
  hallucination_risk NUMERIC(3, 2),
  
  -- Request metadata
  temperature NUMERIC(3, 2),
  max_tokens INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_llm_requests_user_id (user_id),
  INDEX idx_llm_requests_created_at (created_at),
  INDEX idx_llm_requests_model (model),
  INDEX idx_llm_requests_success (success)
);

-- Enable RLS
ALTER TABLE public.llm_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON public.llm_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON public.llm_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Alerts table - stores system alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Alert details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  
  -- Alert data
  rule_id TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  
  -- Detection engine columns
  detection_rule_id TEXT,
  current_value NUMERIC,
  recommendation TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Indexes
  INDEX idx_alerts_user_id (user_id),
  INDEX idx_alerts_status (status),
  INDEX idx_alerts_severity (severity),
  INDEX idx_alerts_created_at (created_at),
  INDEX idx_alerts_detection_rule_id (detection_rule_id)
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own alerts
CREATE POLICY "Users can insert own alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own alerts
CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Logs table - stores application logs
CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Log details
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_logs_user_id (user_id),
  INDEX idx_logs_level (level),
  INDEX idx_logs_service (service),
  INDEX idx_logs_created_at (created_at)
);

-- Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own logs
CREATE POLICY "Users can view own logs"
  ON public.logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own logs
CREATE POLICY "Users can insert own logs"
  ON public.logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service Health table - stores health check results
CREATE TABLE IF NOT EXISTS public.service_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Service details
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'down')),
  latency_ms INTEGER,
  error_rate NUMERIC(5, 2),
  
  -- Timestamps
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_service_health_name (name),
  INDEX idx_service_health_checked_at (checked_at)
);

-- Enable RLS (allow all authenticated users to read service health)
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service health"
  ON public.service_health FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create views for analytics
CREATE OR REPLACE VIEW public.llm_metrics_summary AS
SELECT
  user_id,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency,
  SUM(tokens_total) as total_tokens,
  SUM(cost_usd) as total_cost,
  AVG(coherence_score) as avg_coherence,
  AVG(toxicity_score) as avg_toxicity,
  AVG(hallucination_risk) as avg_hallucination_risk
FROM public.llm_requests
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id;

-- Grant select on views
GRANT SELECT ON public.llm_metrics_summary TO authenticated;

-- Add some sample detection rules (optional)
CREATE TABLE IF NOT EXISTS public.detection_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  threshold_value NUMERIC,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.detection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view detection rules"
  ON public.detection_rules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert the 40 AI/ML detection rules
INSERT INTO public.detection_rules (rule_id, name, category, description, threshold_value, enabled) VALUES
-- Data Quality (6 rules)
('DQ-001', 'Missing Data Spike', 'Data Quality', 'Sudden increase in null values', 20, true),
('DQ-002', 'Schema Drift Detected', 'Data Quality', 'Changes in data schema', 0, true),
('DQ-003', 'Data Distribution Shift', 'Data Quality', 'Input data diverging from baseline', 2, true),
('DQ-004', 'Record Count Drop', 'Data Quality', 'Pipeline failures or data source issues', 50, true),
('DQ-005', 'Duplicate Records', 'Data Quality', 'Data quality degradation', 10, true),
('DQ-006', 'Outlier Flood', 'Data Quality', 'Anomalous data patterns', 30, true),

-- Feature Store (3 rules)
('FS-001', 'Feature Freshness', 'Feature Store', 'Outdated feature values', 24, true),
('FS-002', 'Embedding Drift', 'Feature Store', 'Vector representation shifts', 0.7, true),
('FS-003', 'Feature Store Latency', 'Feature Store', 'Slow feature retrieval', 500, true),

-- Model Performance (7 rules)
('MP-001', 'Model Drift', 'Model Performance', 'Prediction distribution changes', 0.2, true),
('MP-002', 'Accuracy Degradation', 'Model Performance', 'Model performance decline', 90, true),
('MP-003', 'Prediction Latency', 'Model Performance', 'Slow inference', 1000, true),
('MP-004', 'Confidence Drop', 'Model Performance', 'Uncertain predictions', 0.7, true),
('MP-005', 'Class Imbalance', 'Model Performance', 'Biased outputs', 80, true),
('MP-006', 'Model Staleness', 'Model Performance', 'Outdated model version', 7, true),
('MP-007', 'Batch Prediction Failure', 'Model Performance', 'Batch inference issues', 5, true),

-- LLM-Specific (7 rules)
('LLM-001', 'Hallucination Detection', 'LLM', 'Fabricated information', 0.5, true),
('LLM-002', 'Prompt Injection', 'LLM', 'Security exploitation attempts', 0, true),
('LLM-003', 'Context Length Exceeded', 'LLM', 'Input truncation risks', 90, true),
('LLM-004', 'Response Truncation', 'LLM', 'Incomplete outputs', 0, true),
('LLM-005', 'Repetition Loop', 'LLM', 'Generation stuck in loop', 3, true),
('LLM-006', 'Refusal Rate Spike', 'LLM', 'Overly cautious filtering', 20, true),
('LLM-007', 'Response Latency', 'LLM', 'Slow generation', 5000, true),

-- API & Infrastructure (5 rules)
('API-001', 'Rate Limit Approaching', 'API', 'API throttling risk', 80, true),
('API-002', 'Error Rate Spike', 'API', 'Service degradation', 5, true),
('API-003', 'Timeout Increase', 'API', 'Network or backend issues', 10000, true),
('API-004', 'Quota Exhaustion', 'API', 'Budget limits reached', 95, true),
('API-005', 'Cold Start Penalty', 'API', 'Initialization delays', 3000, true),

-- Security (5 rules)
('SEC-001', 'Data Exfiltration', 'Security', 'Sensitive data leakage', 0, true),
('SEC-002', 'Toxicity Spike', 'Security', 'Harmful content', 0.3, true),
('SEC-003', 'PII Leakage', 'Security', 'Personal info exposure', 0, true),
('SEC-004', 'Abuse Detection', 'Security', 'System abuse', 10, true),
('SEC-005', 'Jailbreak Attempt', 'Security', 'Safety filter circumvention', 0, true),

-- Cost (4 rules)
('COST-001', 'Cost Spike', 'Cost', 'Unexpected spending', 200, true),
('COST-002', 'Token Waste', 'Cost', 'Inefficient prompts', 2000, true),
('COST-003', 'Model Overuse', 'Cost', 'Wrong model selection', 0, true),
('COST-004', 'Batch Inefficiency', 'Cost', 'Underutilized batching', 80, true),

-- HITL (3 rules)
('HITL-001', 'Low Feedback Rate', 'HITL', 'Lack of user feedback', 5, true),
('HITL-002', 'Negative Feedback Spike', 'HITL', 'Quality issues', 30, true),
('HITL-003', 'A/B Test Significance', 'HITL', 'Inconclusive experiments', 0.05, true)

ON CONFLICT (rule_id) DO NOTHING;
