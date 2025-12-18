-- Add detection engine columns to alerts table
-- This migration adds support for detection rule metadata

ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS detection_rule_id TEXT,
ADD COLUMN IF NOT EXISTS current_value NUMERIC,
ADD COLUMN IF NOT EXISTS recommendation TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for detection_rule_id for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_detection_rule_id ON public.alerts(detection_rule_id);

-- Add comment to document the columns
COMMENT ON COLUMN public.alerts.detection_rule_id IS 'ID of the detection rule that triggered this alert (e.g., LLM-001, SEC-002)';
COMMENT ON COLUMN public.alerts.current_value IS 'The actual value that triggered the alert';
COMMENT ON COLUMN public.alerts.threshold_value IS 'The threshold value that was exceeded';
COMMENT ON COLUMN public.alerts.recommendation IS 'Recommended action to resolve the alert';
COMMENT ON COLUMN public.alerts.metadata IS 'Additional context and metadata about the alert';
