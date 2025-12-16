import { createClient } from '@supabase/supabase-js';

// Read environment variables. In production you should set these in your hosting provider
// (for Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Project Settings → Environment Variables).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Don't throw here — throwing during module init causes the whole app to crash (blank page).
  // Instead, fallback to a harmless placeholder client and warn in the console so the app can
  // continue in demo/mock mode. Replace these with real values in your production env.
  console.warn('⚠️ Supabase environment variables are not configured. The app will run in demo mode.');
}

// Provide a safe fallback so other modules can import `supabase` without causing an immediate crash.
// Using placeholder values here keeps the client API shape while preventing a hard crash.
const SAFE_SUPABASE_URL = supabaseUrl || 'https://example.supabase.co';
const SAFE_SUPABASE_ANON_KEY = supabaseAnonKey || 'public-anon-placeholder-key';

export const supabase = createClient(SAFE_SUPABASE_URL, SAFE_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
