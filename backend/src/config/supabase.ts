/**
 * Circle for Life — Supabase Client Configuration
 *
 * Single shared client instance used by all database operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_KEY; // Use service role key for backend
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    }
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}
