-- Fix rule_id column type issue
-- The rule_id column might be UUID type, but we need TEXT for detection rule IDs like "LLM-001"

-- First, check if rule_id is UUID and change it to TEXT if needed
DO $$ 
BEGIN
    -- Check if rule_id column exists and is UUID type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'alerts' 
        AND column_name = 'rule_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Change rule_id to TEXT type
        ALTER TABLE public.alerts ALTER COLUMN rule_id TYPE TEXT;
        RAISE NOTICE 'Changed rule_id column from UUID to TEXT';
    END IF;
END $$;

-- Ensure detection_rule_id column exists and is TEXT
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS detection_rule_id TEXT;

-- Add other detection columns if they don't exist
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS current_value NUMERIC,
ADD COLUMN IF NOT EXISTS recommendation TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for detection_rule_id
CREATE INDEX IF NOT EXISTS idx_alerts_detection_rule_id 
ON public.alerts(detection_rule_id);

-- Add comments
COMMENT ON COLUMN public.alerts.rule_id IS 'Legacy rule ID (now TEXT to support detection rule IDs like LLM-001)';
COMMENT ON COLUMN public.alerts.detection_rule_id IS 'Detection rule ID (e.g., LLM-001, SEC-002)';
COMMENT ON COLUMN public.alerts.current_value IS 'The actual value that triggered the alert';
COMMENT ON COLUMN public.alerts.recommendation IS 'Recommended action to resolve the alert';
COMMENT ON COLUMN public.alerts.metadata IS 'Additional context and metadata (JSONB)';
