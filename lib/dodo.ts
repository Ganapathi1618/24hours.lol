import 'server-only';

import { DODO_API_BASE, env } from './env';
import { formatHourRange } from './hours';
import type { BidInput } from './validation';

export interface CheckoutResult {
  url: string;
  paymentId: string | null;
}

interface DodoPaymentResponse {
  payment_link?: string;
  payment_id?: string;
  [key: string]: unknown;
}

/** Metadata we round-trip through Dodo and read back in the webhook. */
export function buildBidMetadata(bid: BidInput): Record<string, string> {
  return {
    hour_number: String(bid.hour_number),
    bid_amount: String(bid.bid_amount),
    bidder_email: bid.bidder_email,
    brand_name: bid.brand_name,
    brand_tagline: bid.brand_tagline,
    brand_url: bid.brand_url,
    brand_logo_url: bid.brand_logo_url ?? '',
    type: 'hour_bid',
  };
}

/**
 * Create a one-off Dodo payment link for exactly the bid amount.
 *
 * Dodo takes the amount in minor units, so a $421 bid is sent as 42100.
 */
export async function createBidCheckout(bid: BidInput): Promise<CheckoutResult> {
  if (!env.dodoApiKey) throw new Error('DODO_API_KEY is not configured.');
  if (!env.dodoBidProductId) throw new Error('DODO_BID_PRODUCT_ID is not configured.');

  const payload = {
    billing: { city: 'NA', country: 'US', state: 'NA', street: 'NA', zipcode: '00000' },
    customer: { email: bid.bidder_email, name: bid.brand_name },
    product_cart: [
      {
        product_id: env.dodoBidProductId,
        quantity: 1,
        amount: Math.round(bid.bid_amount * 100),
      },
    ],
    payment_link: true,
    metadata: buildBidMetadata(bid),
    return_url: `${env.siteUrl}?success=true&hour=${bid.hour_number}`,
  };

  const response = await fetch(`${DODO_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.dodoApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await response.text();
  console.log('[dodo] create payment', response.status, text);

  if (!response.ok) {
    throw new Error(`Dodo responded ${response.status}: ${text.slice(0, 500)}`);
  }

  let data: DodoPaymentResponse;
  try {
    data = JSON.parse(text) as DodoPaymentResponse;
  } catch {
    throw new Error('Dodo returned a response that was not JSON.');
  }

  if (!data.payment_link) {
    throw new Error('Dodo did not return a payment link.');
  }

  return { url: data.payment_link, paymentId: data.payment_id ?? null };
}

/**
 * Refund a payment that lost the slot while it was being processed.
 * Failures are logged and surfaced to the caller, never thrown into the
 * webhook response — Dodo must still get its 200.
 */
export async function refundPayment(paymentId: string, hourNumber: number): Promise<boolean> {
  if (!env.dodoApiKey) {
    console.error('[dodo] cannot refund without DODO_API_KEY', paymentId);
    return false;
  }

  try {
    const response = await fetch(`${DODO_API_BASE}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_id: paymentId,
        reason: `Outbid on ${formatHourRange(hourNumber)} UTC before the payment settled.`,
      }),
      cache: 'no-store',
    });

    const text = await response.text();
    console.log('[dodo] refund', paymentId, response.status, text);
    return response.ok;
  } catch (error) {
    console.error('[dodo] refund request failed', paymentId, error);
    return false;
  }
}
