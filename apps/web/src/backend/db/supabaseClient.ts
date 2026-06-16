import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('[studio-os] Supabase env missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env.local');
}

/**
 * The Supabase client. Sessions persist and auto-refresh, so a signed-in user
 * stays signed in until they explicitly log out (per the auth requirement).
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
