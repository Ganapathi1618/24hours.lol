import { NextResponse } from 'next/server';

import { fetchDatafastStats } from '@/lib/datafast';

export const runtime = 'nodejs';
export const revalidate = 30;

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await fetchDatafastStats();
    if (!stats) {
      return NextResponse.json({ error: 'Live stats are unavailable.' }, { status: 503 });
    }
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[api/stats]', error);
    return NextResponse.json({ error: 'Live stats are unavailable.' }, { status: 503 });
  }
}
