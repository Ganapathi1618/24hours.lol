import 'server-only';

import { DATAFAST_API_BASE, env } from './env';
import type { StatsResponse } from './types';

/** Datafast's payload shape varies by endpoint; dig for the first number that fits. */
function pickNumber(source: unknown, keys: readonly string[], depth = 0): number | null {
  if (typeof source !== 'object' || source === null || depth > 3) return null;

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (typeof value === 'object' && value !== null) {
      const nested = pickNumber(value, ['value', 'total', 'count'], depth + 1);
      if (nested !== null) return nested;
    }
  }

  for (const container of ['data', 'result', 'totals', 'summary', 'analytics'] as const) {
    const nested = record[container];
    if (typeof nested === 'object' && nested !== null) {
      const found = pickNumber(nested, keys, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

async function getJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${DATAFAST_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${env.datafastApiKey}` },
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      console.error('[datafast]', path, response.status, (await response.text()).slice(0, 300));
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.error('[datafast] request failed', path, error);
    return null;
  }
}

function isoDate(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

/**
 * Live visitor count plus a trailing-30-day overview.
 *
 * Returns null when Datafast is unreachable or unconfigured — the UI hides the
 * stats bar rather than showing invented numbers.
 */
export async function fetchDatafastStats(): Promise<StatsResponse | null> {
  if (!env.datafastApiKey || !env.datafastWebsiteId) return null;

  const websiteId = encodeURIComponent(env.datafastWebsiteId);
  const now = new Date();
  const endAt = isoDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const startAt = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [realtime, overview] = await Promise.all([
    getJson(`/analytics/realtime?websiteId=${websiteId}`),
    getJson(`/analytics/overview?startAt=${startAt}&endAt=${endAt}&websiteId=${websiteId}`),
  ]);

  if (realtime === null && overview === null) return null;

  const live = pickNumber(realtime, ['live', 'visitors', 'activeVisitors', 'current', 'online']);
  const visitors = pickNumber(overview, ['visitors', 'uniqueVisitors', 'visits', 'sessions']);
  const pageviews = pickNumber(overview, ['pageviews', 'pageViews', 'views']);

  if (live === null && visitors === null && pageviews === null) return null;

  return {
    live: Math.max(0, Math.round(live ?? 0)),
    visitors: Math.max(0, Math.round(visitors ?? 0)),
    pageviews: Math.max(0, Math.round(pageviews ?? 0)),
  };
}
