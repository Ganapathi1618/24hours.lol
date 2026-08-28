import type { HourRow, HourSlot } from './types';

/** Opening price for a slot that has never been bid on and has no reserve. */
export const OPENING_BID = 10;

/** Every hour on the board, always 0..23. */
export const ALL_HOURS: readonly number[] = Array.from({ length: 24 }, (_, i) => i);

/** The board runs on UTC so every visitor sees the same slot go live. */
export function currentUtcHour(date: Date = new Date()): number {
  return date.getUTCHours();
}

export function isValidHourNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

/** Default campaign length when the row does not set one. */
export const DEFAULT_CAMPAIGN_DAYS = 30;

/** "09:00–10:00" — the label used on the board, in the modal and on receipts. */
export function formatHourRange(hour: number): string {
  const start = String(hour).padStart(2, '0');
  const end = String((hour + 1) % 24).padStart(2, '0');
  return `${start}:00–${end}:00`;
}

/** "9 AM" / "12 PM" — the conversational label used in strips and emails. */
export function formatHour12(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

/** The next `count` hours after the current one, wrapping past midnight. */
export function upcomingHours(currentHour: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => (currentHour + index + 1) % 24);
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Smallest bid that can take a slot.
 *
 * A slot with bids must be beaten by at least $1. A slot with no bids but a
 * reserve (the seeded opening prices) must be met at the reserve. Everything
 * else opens at $10.
 */
export function minBidFor(currentBid: number, bidCount: number): number {
  const bid = Math.max(0, currentBid);
  if (bidCount > 0) return Math.floor(bid) + 1;
  return bid > 0 ? Math.ceil(bid) : OPENING_BID;
}

/** Turn a database row into a board slot. */
export function slotFromRow(row: HourRow): HourSlot {
  const currentBid = toNumber(row.current_bid);
  const bidCount = row.bid_count ?? 0;
  return {
    hour_number: row.hour_number,
    current_bid: currentBid,
    bid_count: bidCount,
    brand_name: row.brand_name,
    brand_tagline: row.brand_tagline,
    brand_url: row.brand_url,
    brand_logo_url: row.brand_logo_url,
    status: row.status,
    min_bid: minBidFor(currentBid, bidCount),
    claimed: Boolean(row.brand_name && bidCount > 0),
    auction_end_time: row.auction_end_time,
    campaign_days: row.campaign_days ?? DEFAULT_CAMPAIGN_DAYS,
  };
}

/** An hour that has no database row yet: unclaimed, opening at $10. */
export function emptySlot(hour: number): HourSlot {
  return {
    hour_number: hour,
    current_bid: 0,
    bid_count: 0,
    brand_name: null,
    brand_tagline: null,
    brand_url: null,
    brand_logo_url: null,
    status: 'open',
    min_bid: OPENING_BID,
    claimed: false,
    auction_end_time: null,
    campaign_days: DEFAULT_CAMPAIGN_DAYS,
  };
}

/** Expand the rows that exist into the full 24-slot board. */
export function buildBoard(rows: HourRow[]): HourSlot[] {
  const byHour = new Map<number, HourRow>();
  for (const row of rows) {
    if (isValidHourNumber(row.hour_number)) byHour.set(row.hour_number, row);
  }
  return ALL_HOURS.map((hour) => {
    const row = byHour.get(hour);
    return row ? slotFromRow(row) : emptySlot(hour);
  });
}

/** Current hour first, then the hours ahead, then the hours already past. */
export function sortForBoard(slots: HourSlot[], currentHour: number): HourSlot[] {
  return [...slots].sort(
    (a, b) =>
      ((a.hour_number - currentHour + 24) % 24) - ((b.hour_number - currentHour + 24) % 24),
  );
}

/** "$1,240" — bids are whole dollars on screen. */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}
