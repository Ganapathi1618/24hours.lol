import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from './database.types';
import { noStoreFetch } from './no-store-fetch';

let cached: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Server only — it bypasses RLS, so it must never be
 * imported from a client component.
 *
 * Returns null (rather than throwing) when unconfigured so routes can answer
 * with a clean 503 instead of a stack trace.
 */
export function getAdminClient(): SupabaseClient<Database> | null {
  if (cached) return cached;
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;

  cached = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
  return cached;
}
