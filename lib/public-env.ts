/**
 * Client-safe environment.
 *
 * These are read as static `process.env.NEXT_PUBLIC_*` member expressions on
 * purpose: that is the only form Next.js inlines into the browser bundle.
 * Never add a non-public key to this file.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  datafastWebsiteId: process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://24hrs.lol',
} as const;

export const DATAFAST_SHARE_URL = 'https://datafa.st/share/6a8dcd957ec703b02ac6cb54';

/** True when the browser has what it needs to open a realtime channel. */
export function hasPublicSupabase(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
