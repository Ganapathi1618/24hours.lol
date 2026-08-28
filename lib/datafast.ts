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
export async function fetchDatafastStats(): Promise<Omit<StatsResponse, 'shareUrl'> | null> {
  if (!env.datafastApiKey || !env.datafastWebsiteId) return null;

  const websiteId = encodeURIComponent(env.datafastWebsiteId);
  const now = new Date();
  // endAt is today, never tomorrow — a future end date can be rejected outright,
  // which is one way the overview call comes back empty.
  const endAt = isoDate(now);
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

// ---------------------------------------------------------------------------
// Audience insights shown inside the hour detail modal.
//
// Only the two confirmed endpoints are called. Country and per-hour breakdowns
// are read out of those payloads when Datafast includes them; when it does not,
// the field comes back null and the UI hides that block. Nothing here is
// invented — an empty analytics panel is better than a fabricated one.
// ---------------------------------------------------------------------------

export interface CountryStat {
  name: string;
  visitors: number;
}

export interface HourStat {
  hour: number;
  pageviews: number;
}

export interface AudienceInsights {
  live: number | null;
  monthlyVisitors: number | null;
  monthlyPageviews: number | null;
  dailyAveragePageviews: number | null;
  topCountries: CountryStat[] | null;
  hourly: HourStat[] | null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** Find the first array under any of `keys`, searching one level into wrappers. */
function findArray(source: unknown, keys: readonly string[], depth = 0): unknown[] | null {
  if (typeof source !== 'object' || source === null || depth > 3) return null;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const direct = asArray(record[key]);
    if (direct) return direct;
    if (typeof record[key] === 'object' && record[key] !== null) {
      const nested = findArray(record[key], ['data', 'items', 'results', 'values'], depth + 1);
      if (nested) return nested;
    }
  }
  for (const container of ['data', 'result', 'analytics', 'summary'] as const) {
    const nested = record[container];
    if (typeof nested === 'object' && nested !== null) {
      const found = findArray(nested, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseCountries(overview: unknown): CountryStat[] | null {
  const rows = findArray(overview, ['countries', 'topCountries', 'byCountry', 'country']);
  if (!rows) return null;

  const parsed: CountryStat[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;
    const name = readString(record, ['name', 'country', 'countryName', 'label', 'code']);
    const visitors = readNumber(record, ['visitors', 'count', 'value', 'sessions', 'visits']);
    if (name && visitors !== null) parsed.push({ name, visitors: Math.max(0, Math.round(visitors)) });
  }
  if (parsed.length === 0) return null;
  return parsed.sort((a, b) => b.visitors - a.visitors).slice(0, 5);
}

/** Bucket whatever time series Datafast returns into the 24 UTC hours. */
function parseHourly(overview: unknown): HourStat[] | null {
  const rows = findArray(overview, ['hourly', 'byHour', 'hours', 'timeseries', 'series', 'timeSeries']);
  if (!rows) return null;

  const buckets = new Map<number, number>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;

    let hour = readNumber(record, ['hour', 'hourOfDay']);
    if (hour === null) {
      const stamp = readString(record, ['date', 'timestamp', 'time', 'datetime', 'bucket']);
      if (stamp) {
        const parsedDate = new Date(stamp);
        if (!Number.isNaN(parsedDate.getTime())) hour = parsedDate.getUTCHours();
      }
    }
    if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;

    const views = readNumber(record, ['pageviews', 'pageViews', 'views', 'visitors', 'count', 'value']);
    if (views === null) continue;
    buckets.set(hour, (buckets.get(hour) ?? 0) + Math.max(0, views));
  }

  if (buckets.size === 0) return null;
  return ALL_HOURS_LOCAL.map((hour) => ({ hour, pageviews: Math.round(buckets.get(hour) ?? 0) }));
}

const ALL_HOURS_LOCAL = Array.from({ length: 24 }, (_, index) => index);

/** Everything the hour detail modal needs, in one round trip pair. */
export async function fetchAudienceInsights(): Promise<AudienceInsights | null> {
  if (!env.datafastApiKey || !env.datafastWebsiteId) return null;

  const websiteId = encodeURIComponent(env.datafastWebsiteId);
  const now = new Date();
  // endAt is today, never tomorrow — a future end date can be rejected outright,
  // which is one way the overview call comes back empty.
  const endAt = isoDate(now);
  const startAt = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [realtime, overview] = await Promise.all([
    getJson(`/analytics/realtime?websiteId=${websiteId}`),
    getJson(`/analytics/overview?startAt=${startAt}&endAt=${endAt}&websiteId=${websiteId}`),
  ]);

  if (realtime === null && overview === null) return null;

  const live = pickNumber(realtime, ['live', 'visitors', 'activeVisitors', 'current', 'online']);
  const monthlyVisitors = pickNumber(overview, ['visitors', 'uniqueVisitors', 'visits', 'sessions']);
  const monthlyPageviews = pickNumber(overview, ['pageviews', 'pageViews', 'views']);

  return {
    live: live === null ? null : Math.max(0, Math.round(live)),
    monthlyVisitors: monthlyVisitors === null ? null : Math.max(0, Math.round(monthlyVisitors)),
    monthlyPageviews: monthlyPageviews === null ? null : Math.max(0, Math.round(monthlyPageviews)),
    dailyAveragePageviews:
      monthlyPageviews === null ? null : Math.max(0, Math.round(monthlyPageviews / 30)),
    topCountries: parseCountries(overview),
    hourly: parseHourly(overview),
  };
}
