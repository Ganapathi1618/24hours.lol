import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './supabase/database.types';
import type { BidInput } from './validation';

const MAX_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

export type SettlementOutcome =
  | { result: 'won'; previousWinnerEmail: string | null; previousBid: number }
  | { result: 'outbid'; standingBid: number };

/**
 * Apply a settled payment to the hours table.
 *
 * Two payments can settle for the same hour at the same moment, so the write
 * is an optimistic compare-and-set: the update only lands while the row still
 * holds the bid and count we read. If another payment slipped in first we
 * re-read and decide again, and the loser is reported as outbid so the caller
 * can refund it.
 */
export async function applyWinningBid(
  supabase: SupabaseClient<Database>,
  bid: BidInput,
): Promise<SettlementOutcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data: existing, error: readError } = await supabase
      .from('hours')
      .select('id, current_bid, bid_count, winner_email')
      .eq('hour_number', bid.hour_number)
      .maybeSingle();

    if (readError) throw new Error(`Failed to read hour ${bid.hour_number}: ${readError.message}`);

    if (!existing) {
      const { error: insertError } = await supabase.from('hours').insert({
        hour_number: bid.hour_number,
        current_bid: bid.bid_amount,
        bid_count: 1,
        brand_name: bid.brand_name,
        brand_tagline: bid.brand_tagline,
        brand_url: bid.brand_url,
        brand_logo_url: bid.brand_logo_url,
        winner_email: bid.bidder_email,
        status: 'open',
        updated_at: new Date().toISOString(),
      });

      if (!insertError) {
        return { result: 'won', previousWinnerEmail: null, previousBid: 0 };
      }
      // Another settlement created the row first — re-read and compare properly.
      if (insertError.code === UNIQUE_VIOLATION) continue;
      throw new Error(`Failed to create hour ${bid.hour_number}: ${insertError.message}`);
    }

    const standingBid = Number(existing.current_bid ?? 0);
    const standingCount = existing.bid_count ?? 0;
    const displacedWinner = existing.winner_email;

    if (bid.bid_amount <= standingBid) {
      return { result: 'outbid', standingBid };
    }

    const { data: updated, error: updateError } = await supabase
      .from('hours')
      .update({
        current_bid: bid.bid_amount,
        bid_count: standingCount + 1,
        brand_name: bid.brand_name,
        brand_tagline: bid.brand_tagline,
        brand_url: bid.brand_url,
        brand_logo_url: bid.brand_logo_url,
        winner_email: bid.bidder_email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('current_bid', standingBid)
      .eq('bid_count', standingCount)
      .select('id');

    if (updateError) {
      throw new Error(`Failed to update hour ${bid.hour_number}: ${updateError.message}`);
    }
    if (updated && updated.length > 0) {
      return { result: 'won', previousWinnerEmail: displacedWinner, previousBid: standingBid };
    }
    // The row moved underneath us; loop and re-evaluate against the new bid.
  }

  throw new Error(`Could not settle hour ${bid.hour_number} after ${MAX_ATTEMPTS} attempts.`);
}

/**
 * Record the bid itself. The checkout route already wrote a `pending` row for
 * this payment, so prefer updating that row over inserting a duplicate.
 */
export async function recordBid(
  supabase: SupabaseClient<Database>,
  bid: BidInput,
  paymentId: string,
  status: 'won' | 'outbid',
): Promise<void> {
  const { data: pending, error: findError } = await supabase
    .from('bids')
    .select('id')
    .eq('payment_id', paymentId)
    .limit(1);

  if (findError) console.error('[settle] failed to look up pending bid', findError);

  if (pending && pending.length > 0 && pending[0]) {
    const { error } = await supabase.from('bids').update({ status }).eq('id', pending[0].id);
    if (error) throw new Error(`Failed to update bid ${paymentId}: ${error.message}`);
    return;
  }

  const { error } = await supabase.from('bids').insert({
    hour_number: bid.hour_number,
    amount: bid.bid_amount,
    bidder_email: bid.bidder_email,
    brand_name: bid.brand_name,
    brand_tagline: bid.brand_tagline,
    brand_url: bid.brand_url,
    brand_logo_url: bid.brand_logo_url,
    payment_id: paymentId,
    status,
  });
  if (error) throw new Error(`Failed to insert bid ${paymentId}: ${error.message}`);
}

/** Demote the bid that previously held the hour. */
export async function demotePreviousWinner(
  supabase: SupabaseClient<Database>,
  hourNumber: number,
  paymentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bids')
    .update({ status: 'outbid' })
    .eq('hour_number', hourNumber)
    .eq('status', 'won')
    .neq('payment_id', paymentId);

  if (error) console.error('[settle] failed to demote previous winner', error);
}

export async function markRefunded(
  supabase: SupabaseClient<Database>,
  paymentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bids')
    .update({ status: 'refunded' })
    .eq('payment_id', paymentId);

  if (error) console.error('[settle] failed to mark refund', error);
}
