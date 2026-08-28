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

/**
 * The same hour window expressed in the viewer's own timezone, e.g.
 * "3:30–4:30 AM IST" for 22:00–23:00 UTC seen from India.
 *
 * Browsers report `timeZoneName: 'short'` as a raw offset ("GMT+5:30") for many
 * zones, so when that happens the abbreviation is built from the long name
 * ("India Standard Time" → "IST"). Returns null if Intl cannot resolve a zone,
 * so the caller can simply render nothing.
 */
export function formatLocalHourRange(hour: number, now: Date = new Date()): string | null {
  try {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0),
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const time = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const parts = (date: Date) => {
      const found = time.formatToParts(date);
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        found.find((part) => part.type === type)?.value ?? '';
      return {
        clock: `${value('hour')}:${value('minute')}`,
        meridiem: value('dayPeriod').toUpperCase(),
      };
    };

    const from = parts(start);
    const to = parts(end);
    if (!from.clock.trim() || !to.clock.trim()) return null;

    // "11:30 AM–12:30 PM" when the window crosses noon or midnight,
    // "3:30–4:30 AM" when it does not.
    const window =
      from.meridiem === to.meridiem
        ? `${from.clock}–${to.clock} ${to.meridiem}`
        : `${from.clock} ${from.meridiem}–${to.clock} ${to.meridiem}`;

    return `${window} ${localZoneAbbreviation(start)}`.trim();
  } catch {
    return null;
  }
}

/** "IST", "PST", "CET" — falling back to the offset when nothing better exists. */
function localZoneAbbreviation(date: Date): string {
  const readName = (style: 'short' | 'long'): string =>
    new Intl.DateTimeFormat(undefined, { timeZoneName: style })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  // An offset always carries a sign ("GMT+5:30", "UTC-3"); a real abbreviation
  // never does, so this keeps "IST", "PST" and a bare "UTC" while rejecting
  // offsets.
  const short = readName('short');
  if (short && !/[+-]/.test(short)) return short;

  const long = readName('long');
  const initials = long
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word))
    .map((word) => word[0])
    .join('');

  return initials.length >= 2 ? initials : short;
}
