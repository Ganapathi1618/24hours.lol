import 'server-only';

import { publicEnv } from './public-env';

/**
 * Server-side environment access.
 *
 * Nothing here throws at import time: the app must still build and render a
 * clear "not configured" state when a key is missing, rather than crashing the
 * whole route tree.
 */
function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  supabaseUrl: publicEnv.supabaseUrl,
  supabaseAnonKey: publicEnv.supabaseAnonKey,
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  dodoApiKey: optional('DODO_API_KEY'),
  dodoWebhookSecret: optional('DODO_WEBHOOK_SECRET'),
  dodoBidProductId: optional('DODO_BID_PRODUCT_ID'),
  datafastWebsiteId: publicEnv.datafastWebsiteId,
  datafastApiKey: optional('DATAFAST_API_KEY'),
  datafastShareUrl: optional('NEXT_PUBLIC_DATAFAST_SHARE_URL'),
  siteUrl: publicEnv.siteUrl,
  resendApiKey: optional('RESEND_API_KEY'),
  resendFrom: optional('RESEND_FROM') ?? '24hrs.lol <bids@24hrs.lol>',
  cronSecret: optional('CRON_SECRET'),
  adminPassword: optional('ADMIN_PASSWORD'),
} as const;

export const DODO_API_BASE = optional('DODO_API_BASE') ?? 'https://live.dodopayments.com';
export const DATAFAST_API_BASE = optional('DATAFAST_API_BASE') ?? 'https://datafa.st/api/v1';

/** True when the privileged Supabase credentials are present. */
export function hasAdminSupabase(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
