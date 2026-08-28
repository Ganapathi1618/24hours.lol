import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  // The tracking script in app/layout.tsx reads NEXT_PUBLIC_DATAFAST_WEBSITE_ID,
  // so accept either name — otherwise whichever one is set in the host decides
  // whether tracking or stats works, and the other silently breaks.
  const websiteId =
    process.env.DATAFAST_WEBSITE_ID ?? process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID;
  const apiKey = process.env.DATAFAST_API_KEY;

  if (!websiteId || !apiKey) {
    const missing = [
      apiKey ? null : "DATAFAST_API_KEY",
      websiteId ? null : "DATAFAST_WEBSITE_ID (or NEXT_PUBLIC_DATAFAST_WEBSITE_ID)",
    ].filter(Boolean);
    console.error("[api/stats] not configured, missing:", missing.join(", "));
    return NextResponse.json(
      { ok: false, error: "stats_not_configured", missing },
      { status: 503 }
    );
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  const startAt = "2026-07-29";
  const endAt = new Date().toISOString().slice(0, 10);

  const [realtimeRes, overviewRes] = await Promise.all([
    fetch(
      `https://datafa.st/api/v1/analytics/realtime?websiteId=${websiteId}`,
      { headers, cache: "no-store" }
    ),
    fetch(
      `https://datafa.st/api/v1/analytics/overview?startAt=${startAt}&endAt=${endAt}&websiteId=${websiteId}`,
      { headers, next: { revalidate: 30 } }
    ),
  ]);

  if (!realtimeRes.ok || !overviewRes.ok) {
    return NextResponse.json(
      { ok: false, error: "stats_upstream_failed" },
      { status: 502 }
    );
  }

  const realtime = await realtimeRes.json();
  const overview = await overviewRes.json();

  const live = Number(realtime?.data?.[0]?.visitors ?? 0);
  const o = overview?.data?.[0] ?? {};

  return NextResponse.json({
    ok: true,
    live,
    visitors: Number(o.visitors ?? 0),
    pageviews: Number(o.pageviews ?? 0),
    sessions: Number(o.sessions ?? 0),
    bounceRate: Number(o.bounce_rate ?? 0),
  });
}
