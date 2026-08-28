import { NextResponse } from 'next/server';

import { DATAFAST_API_BASE, env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY DIAGNOSTIC BUILD.
 *
 * This route normally returns { live, visitors, pageviews, shareUrl }. While we
 * work out the shape Datafast actually sends, it returns the two upstream
 * payloads verbatim instead, and logs them in full.
 *
 * Consequences while this is in place:
 *   - the live stats row stays hidden (the client gets no numbers to show)
 *   - this site's raw analytics are readable by anyone who opens the URL
 *
 * REVERT once the shape is known: the previous version is one file away in git
 * (`git show HEAD:app/api/stats/route.ts`). The API key is only ever sent as a
 * request header, so it is not exposed here.
 */

interface Fetched {
  url: string;
  status: number | null;
  ok: boolean;
  /** Parsed JSON when the body was JSON, otherwise null. */
  json: unknown;
  /** Raw text, kept when the body would not parse as JSON. */
  text: string | null;
  error: string | null;
}

async function probe(label: string, path: string): Promise<Fetched> {
  const url = `${DATAFAST_API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.datafastApiKey}` },
      cache: 'no-store',
    });

    const body = await response.text();
    console.log(
      `[datafast:${label}] ${response.status} ${url}\n` +
        `[datafast:${label}] raw body >>>\n${body}\n<<< end body`,
    );

    try {
      return {
        url,
        status: response.status,
        ok: response.ok,
        json: JSON.parse(body) as unknown,
        text: null,
        error: null,
      };
    } catch {
      // Not JSON — hand back the text so the shape is still visible.
      return {
        url,
        status: response.status,
        ok: response.ok,
        json: null,
        text: body,
        error: 'Response body was not valid JSON.',
      };
    }
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[datafast:${label}] request failed`, url, message);
    return { url, status: null, ok: false, json: null, text: null, error: message };
  }
}

export async function GET(): Promise<NextResponse> {
  if (!env.datafastApiKey || !env.datafastWebsiteId) {
    const missing = [
      env.datafastApiKey ? null : 'DATAFAST_API_KEY',
      env.datafastWebsiteId ? null : 'NEXT_PUBLIC_DATAFAST_WEBSITE_ID',
    ].filter(Boolean);
    console.error('[datafast] not configured, missing:', missing.join(', '));
    return NextResponse.json(
      { debug: true, error: `Not configured. Missing: ${missing.join(', ')}` },
      { status: 503 },
    );
  }

  const websiteId = encodeURIComponent(env.datafastWebsiteId);
  const today = new Date().toISOString().split('T')[0];
  const ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [realtime, overview] = await Promise.all([
    probe('realtime', `/analytics/realtime?websiteId=${websiteId}`),
    probe('overview', `/analytics/overview?startAt=${ago}&endAt=${today}&websiteId=${websiteId}`),
  ]);

  return NextResponse.json(
    {
      debug: true,
      note: 'Temporary raw passthrough. Revert app/api/stats/route.ts once the shape is known.',
      dateRange: { startAt: ago, endAt: today },
      // The two upstream payloads, exactly as Datafast returned them.
      realtime: realtime.json ?? realtime.text,
      overview: overview.json ?? overview.text,
      meta: {
        realtime: { url: realtime.url, status: realtime.status, ok: realtime.ok, error: realtime.error },
        overview: { url: overview.url, status: overview.status, ok: overview.ok, error: overview.error },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
