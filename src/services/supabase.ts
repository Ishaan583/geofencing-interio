import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to determine if we should sync to Cloud
console.log(
  isSupabaseConfigured 
    ? '☁️ Supabase Cloud database connection active.' 
    : '📦 Supabase env vars missing. Falling back to local browser IndexedDB.'
);
