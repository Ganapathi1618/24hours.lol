'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/public-env';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

/** Anon client used in the browser purely for the realtime subscription. */
export function getBrowserClient(): SupabaseClient<Database> | null {
  if (cached) return cached;
  const { supabaseUrl, supabaseAnonKey } = publicEnv;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  cached = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
