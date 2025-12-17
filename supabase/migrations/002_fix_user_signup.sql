-- ============================================================================
-- Fix User Signup - Add Missing INSERT Policy
-- Date: December 17, 2025
-- Description: Allows the handle_new_user() trigger to insert user profiles
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Recreate policies with INSERT support
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- ⚠️ CRITICAL: Allow INSERT for new user signup
-- The trigger runs with SECURITY DEFINER, so it bypasses RLS
-- But we also need a policy for manual inserts (if any)
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Alternative: Make the trigger function bypass RLS
-- ============================================================================

-- Update the handle_new_user function to use SECURITY DEFINER
-- This ensures the trigger can insert regardless of RLS policies
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- This is critical - runs as the function owner (superuser)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert user profile with data from auth.users metadata
    INSERT INTO public.user_profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't block user creation
        RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile on signup (with error handling)';
