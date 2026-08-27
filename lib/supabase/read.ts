import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { getAdminClient } from './admin';
import type { Database } from './database.types';
import { noStoreFetch } from './no-store-fetch';

let cached: SupabaseClient<Database> | null = null;

/**
 * Least-privilege server client for public reads (the `hours` table is
 * world-readable under RLS). Falls back to the service-role client when only
 * the service key is configured.
 */
export function getReadClient(): SupabaseClient<Database> | null {
  if (cached) return cached;

  if (env.supabaseUrl && env.supabaseAnonKey) {
    cached = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    });
    return cached;
  }
  return getAdminClient();
}
