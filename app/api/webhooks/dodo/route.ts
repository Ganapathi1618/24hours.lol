import { NextResponse } from 'next/server';

import { refundPayment } from '@/lib/dodo';
import { sendOutbidEmail, sendRefundEmail, sendWinnerEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { isValidHourNumber } from '@/lib/hours';
import {
  applyWinningBid,
  demotePreviousWinner,
  markRefunded,
  recordBid,
} from '@/lib/settle';
import { getAdminClient } from '@/lib/supabase/admin';
import { normaliseUrl } from '@/lib/validation';
import type { BidInput } from '@/lib/validation';
import { verifyWebhookSignature } from '@/lib/webhook-signature';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DodoEvent {
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Pull our own metadata back out of the event, defensively. */
function parseBidMetadata(metadata: Record<string, unknown>): BidInput | null {
  if (asString(metadata.type) !== 'hour_bid') return null;

  const hourNumber = Number.parseInt(asString(metadata.hour_number), 10);
  if (!isValidHourNumber(hourNumber)) return null;

  const bidAmount = Number.parseFloat(asString(metadata.bid_amount));
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) return null;

  const bidderEmail = asString(metadata.bidder_email).toLowerCase();
  if (!bidderEmail) return null;

  const logo = asString(metadata.brand_logo_url);

  return {
    hour_number: hourNumber,
    bid_amount: Math.round(bidAmount),
    bidder_email: bidderEmail,
    brand_name: asString(metadata.brand_name) || bidderEmail,
    brand_tagline: asString(metadata.brand_tagline),
    brand_url: normaliseUrl(asString(metadata.brand_url)) ?? '',
    brand_logo_url: logo ? normaliseUrl(logo) : null,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!env.dodoWebhookSecret) {
    console.error('[webhook] DODO_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  // The raw body must be read before parsing — the signature covers the bytes.
  const rawBody = await request.text();

  const verification = verifyWebhookSignature({
    secret: env.dodoWebhookSecret,
    body: rawBody,
    webhookId: request.headers.get('webhook-id'),
    webhookTimestamp: request.headers.get('webhook-timestamp'),
    webhookSignature: request.headers.get('webhook-signature'),
  });

  if (!verification.ok) {
    console.error('[webhook] rejected:', verification.reason);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(rawBody) as DodoEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventType = asString(event.type);
  if (eventType !== 'payment.succeeded') {
    return NextResponse.json({ received: true, ignored: eventType || 'unknown' });
  }

  const payload = asRecord(event.data) ?? event;
  const paymentId = asString(payload.payment_id) || asString(payload.id);
  const metadata = asRecord(payload.metadata);

  if (!metadata) {
    return NextResponse.json({ received: true, ignored: 'no metadata' });
  }

  const bid = parseBidMetadata(metadata);
  if (!bid) {
    return NextResponse.json({ received: true, ignored: 'not an hour bid' });
  }
  if (!paymentId) {
    console.error('[webhook] hour_bid event without a payment id');
    return NextResponse.json({ error: 'Missing payment id.' }, { status: 400 });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[webhook] Supabase service role is not configured.');
    // 500 so Dodo retries once the deployment is fixed.
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 });
  }

  try {
    // Idempotency: Dodo retries, and a settled payment must only count once.
    const { data: settled, error: settledError } = await supabase
      .from('bids')
      .select('id, status')
      .eq('payment_id', paymentId)
      .in('status', ['won', 'outbid', 'refunded'])
      .limit(1);

    if (settledError) throw new Error(settledError.message);
    if (settled && settled.length > 0) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const outcome = await applyWinningBid(supabase, bid);

    if (outcome.result === 'won') {
      await recordBid(supabase, bid, paymentId, 'won');
      await demotePreviousWinner(supabase, bid.hour_number, paymentId);

      await Promise.all([
        sendWinnerEmail(
          bid.bidder_email,
          bid.hour_number,
          bid.bid_amount,
          bid.brand_name,
          outcome.campaignDays,
        ),
        outcome.previousWinnerEmail && outcome.previousWinnerEmail !== bid.bidder_email
          ? sendOutbidEmail(outcome.previousWinnerEmail, bid.hour_number, bid.bid_amount)
          : Promise.resolve(),
      ]);

      console.log('[webhook] hour won', bid.hour_number, bid.bid_amount, paymentId);
      return NextResponse.json({ received: true, result: 'won' });
    }

    // A higher bid landed while this payment was settling: refund it.
    await recordBid(supabase, bid, paymentId, 'outbid');
    const refunded = await refundPayment(paymentId, bid.hour_number);
    if (refunded) {
      await markRefunded(supabase, paymentId);
      await sendRefundEmail(bid.bidder_email, bid.hour_number, bid.bid_amount);
    } else {
      console.error('[webhook] REFUND REQUIRED — manual follow-up', paymentId, bid.bid_amount);
    }

    console.log('[webhook] hour outbid', bid.hour_number, outcome.standingBid, paymentId);
    return NextResponse.json({ received: true, result: 'outbid', refunded });
  } catch (error) {
    // 500 asks Dodo to retry; the idempotency check above makes that safe.
    console.error('[webhook] settlement failed', paymentId, error);
    return NextResponse.json({ error: 'Settlement failed.' }, { status: 500 });
  }
}
