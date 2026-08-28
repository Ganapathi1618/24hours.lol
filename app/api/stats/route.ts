import { NextResponse } from 'next/server';

import {
  datafastConfigProblem,
  fetchDatafastStats,
  lastDatafastFailure,
} from '@/lib/datafast';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await fetchDatafastStats();
    if (!stats) {
      // The UI hides the row on any 503; `reason` is here so the cause can be
      // read straight off the endpoint instead of hunting through logs.
      const reason =
        datafastConfigProblem() ??
        lastDatafastFailure() ??
        'Datafast responded, but with none of the expected numbers.';
      return NextResponse.json({ error: 'Live stats are unavailable.', reason }, { status: 503 });
    }
    return NextResponse.json({ ...stats, shareUrl: env.datafastShareUrl ?? null }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[api/stats]', error);
    return NextResponse.json({ error: 'Live stats are unavailable.' }, { status: 503 });
  }
}
