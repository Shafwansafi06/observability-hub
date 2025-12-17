-- =====================================================
-- FIX ALL DATABASE ISSUES
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create user_settings table (for Settings page)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

-- Create policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Create health_check table (for health monitoring)
CREATE TABLE IF NOT EXISTS health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'healthy',
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on health_check
ALTER TABLE health_check ENABLE ROW LEVEL SECURITY;

-- Allow public read access to health_check
DROP POLICY IF EXISTS "Public can read health checks" ON health_check;
CREATE POLICY "Public can read health checks"
  ON health_check FOR SELECT
  TO public
  USING (true);

-- Insert initial health check record
INSERT INTO health_check (service, status, metadata)
VALUES ('observai-hub', 'healthy', '{"version": "1.0.0"}')
ON CONFLICT DO NOTHING;

-- 3. Fix user_profiles RLS policies (for user signup)
-- Make sure INSERT is allowed by the trigger
DROP POLICY IF EXISTS "Service role can insert profiles" ON user_profiles;
CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Verify handle_new_user trigger exists
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON health_check TO anon, authenticated;
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_health_check_service ON health_check(service);
CREATE INDEX IF NOT EXISTS idx_health_check_last_check ON health_check(last_check DESC);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All database fixes applied successfully!';
  RAISE NOTICE '📋 Created tables: user_settings, health_check';
  RAISE NOTICE '🔒 Applied RLS policies';
  RAISE NOTICE '⚡ Created indexes';
  RAISE NOTICE '🔧 Fixed user signup trigger';
END $$;
