import { isValidHourNumber, minBidFor } from './hours';

export const MAX_TAGLINE_LENGTH = 60;
export const MAX_BRAND_NAME_LENGTH = 40;
/** Guard rail so a fat-fingered amount cannot create a five-figure charge. */
export const MAX_BID = 100_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface BidInput {
  hour_number: number;
  bid_amount: number;
  bidder_email: string;
  brand_name: string;
  brand_tagline: string;
  brand_url: string;
  brand_logo_url: string | null;
}

export type ValidationResult =
  | { ok: true; value: BidInput }
  | { ok: false; error: string };

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Only http(s) URLs are accepted, so a bidder cannot smuggle `javascript:` or
 * `data:` into a link that we later render on the homepage.
 */
export function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= 254;
}

/**
 * Validate an incoming bid against the slot's live minimum.
 *
 * `currentBid`/`bidCount` come from the database at request time — never from
 * the client — so a tampered payload cannot undercut the standing bid.
 */
export function validateBid(
  body: unknown,
  slot: { currentBid: number; bidCount: number },
): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Invalid request body.' };
  }
  const raw = body as Record<string, unknown>;

  const hourNumber = Number(raw.hour_number);
  if (!isValidHourNumber(hourNumber)) {
    return { ok: false, error: 'Pick an hour between 0 and 23.' };
  }

  const bidAmount = Number(raw.bid_amount);
  if (!Number.isFinite(bidAmount)) {
    return { ok: false, error: 'Enter a bid amount.' };
  }
  const amount = Math.round(bidAmount);
  const minimum = minBidFor(slot.currentBid, slot.bidCount);
  if (amount < minimum) {
    return { ok: false, error: `Bid at least $${minimum} to claim this hour.` };
  }
  if (amount > MAX_BID) {
    return { ok: false, error: `Bids are capped at $${MAX_BID.toLocaleString('en-US')}.` };
  }

  const email = asString(raw.bidder_email).toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const brandName = asString(raw.brand_name);
  if (!brandName) {
    return { ok: false, error: 'Enter your brand name.' };
  }
  if (brandName.length > MAX_BRAND_NAME_LENGTH) {
    return { ok: false, error: `Brand name must be ${MAX_BRAND_NAME_LENGTH} characters or fewer.` };
  }

  const tagline = asString(raw.brand_tagline);
  if (!tagline) {
    return { ok: false, error: 'Enter a tagline.' };
  }
  if (tagline.length > MAX_TAGLINE_LENGTH) {
    return { ok: false, error: `Tagline must be ${MAX_TAGLINE_LENGTH} characters or fewer.` };
  }

  const brandUrl = normaliseUrl(asString(raw.brand_url));
  if (!brandUrl) {
    return { ok: false, error: 'Enter a valid website URL.' };
  }

  const rawLogo = asString(raw.brand_logo_url);
  const brandLogoUrl = rawLogo ? normaliseUrl(rawLogo) : null;
  if (rawLogo && !brandLogoUrl) {
    return { ok: false, error: 'Logo URL must be a valid http(s) link.' };
  }

  return {
    ok: true,
    value: {
      hour_number: hourNumber,
      bid_amount: amount,
      bidder_email: email,
      brand_name: brandName,
      brand_tagline: tagline,
      brand_url: brandUrl,
      brand_logo_url: brandLogoUrl,
    },
  };
}
