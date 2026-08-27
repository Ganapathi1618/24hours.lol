import { NextResponse } from 'next/server';

import { createBidCheckout } from '@/lib/dodo';
import { env } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { getReadClient } from '@/lib/supabase/read';
import { isValidHourNumber } from '@/lib/hours';
import { validateBid } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!env.dodoApiKey || !env.dodoBidProductId) {
    console.error('[api/bid/checkout] Dodo is not configured.');
    return fail('Bidding is temporarily unavailable.', 503);
  }

  if (!rateLimit(`bid:${clientIp(request.headers)}`, 8, 60_000)) {
    return fail('Too many bids from this device. Try again in a minute.', 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request body.', 400);
  }

  const requestedHour = Number((body as Record<string, unknown> | null)?.hour_number);
  if (!isValidHourNumber(requestedHour)) {
    return fail('Pick an hour between 0 and 23.', 400);
  }

  // The standing bid always comes from the database, never from the client.
  const reader = getReadClient();
  if (!reader) return fail('Bidding is temporarily unavailable.', 503);

  const { data: hourRow, error: readError } = await reader
    .from('hours')
    .select('current_bid, bid_count, status')
    .eq('hour_number', requestedHour)
    .maybeSingle();

  if (readError) {
    console.error('[api/bid/checkout] failed to read hour', readError);
    return fail('Could not check the current bid. Try again.', 503);
  }
  if (hourRow?.status === 'ended') {
    return fail('This hour is closed for bidding.', 409);
  }

  const currentBid = Number(hourRow?.current_bid ?? 0);
  const bidCount = hourRow?.bid_count ?? 0;

  const validation = validateBid(body, {
    currentBid: Number.isFinite(currentBid) ? currentBid : 0,
    bidCount,
  });
  if (!validation.ok) {
    return fail(validation.error, 400);
  }
  const bid = validation.value;

  let checkout;
  try {
    checkout = await createBidCheckout(bid);
  } catch (error) {
    console.error('[api/bid/checkout] Dodo checkout failed', error);
    return fail('Could not start checkout. Try again.', 502);
  }

  // Record the attempt so an abandoned checkout is still visible in admin.
  // A failure here must not block a payment that Dodo already has a link for.
  const admin = getAdminClient();
  if (admin) {
    const { error: insertError } = await admin.from('bids').insert({
      hour_number: bid.hour_number,
      amount: bid.bid_amount,
      bidder_email: bid.bidder_email,
      brand_name: bid.brand_name,
      brand_tagline: bid.brand_tagline,
      brand_url: bid.brand_url,
      brand_logo_url: bid.brand_logo_url,
      payment_id: checkout.paymentId,
      status: 'pending',
    });
    if (insertError) console.error('[api/bid/checkout] pending bid insert failed', insertError);
  }

  return NextResponse.json({ url: checkout.url }, { headers: { 'Cache-Control': 'no-store' } });
}
