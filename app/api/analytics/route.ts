import { NextResponse } from 'next/server';

import { fetchAudienceInsights } from '@/lib/datafast';

export const runtime = 'nodejs';
export const revalidate = 60;

/** Audience insights for the hour detail modal. */
export async function GET(): Promise<NextResponse> {
  try {
    const insights = await fetchAudienceInsights();
    if (!insights) {
      return NextResponse.json({ error: 'Analytics are unavailable.' }, { status: 503 });
    }
    return NextResponse.json(insights, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('[api/analytics]', error);
    return NextResponse.json({ error: 'Analytics are unavailable.' }, { status: 503 });
  }
}
