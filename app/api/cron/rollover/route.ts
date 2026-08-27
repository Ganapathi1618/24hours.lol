import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { currentUtcHour } from '@/lib/hours';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Hourly rollover: mark the hour that is on air as `live` and put every other
 * open hour back to `open`. Hours an operator has closed (`ended`) are left
 * alone. The write also nudges realtime so every open board re-renders.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!env.cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 503 });
  }

  const hour = currentUtcHour();
  const timestamp = new Date().toISOString();

  const { error: demoteError } = await supabase
    .from('hours')
    .update({ status: 'open', updated_at: timestamp })
    .eq('status', 'live')
    .neq('hour_number', hour);

  const { error: promoteError } = await supabase
    .from('hours')
    .update({ status: 'live', updated_at: timestamp })
    .eq('hour_number', hour)
    .eq('status', 'open');

  if (demoteError || promoteError) {
    console.error('[cron/rollover]', demoteError ?? promoteError);
    return NextResponse.json({ error: 'Rollover failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, live_hour: hour, at: timestamp });
}
