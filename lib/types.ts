export type HourStatus = 'open' | 'live' | 'ended';
export type BidStatus = 'pending' | 'won' | 'outbid' | 'refunded';

/** A row as it exists in `public.hours`. */
export type HourRow = {
  id: string;
  hour_number: number;
  current_bid: number | string | null;
  bid_count: number | null;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_url: string | null;
  brand_logo_url: string | null;
  winner_email: string | null;
  status: HourStatus;
  created_at: string;
  updated_at: string;
};

/** A row as it exists in `public.bids`. */
export type BidRow = {
  id: string;
  hour_number: number;
  amount: number | string;
  bidder_email: string;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_url: string | null;
  brand_logo_url: string | null;
  payment_id: string | null;
  status: BidStatus;
  created_at: string;
};

/**
 * One of the 24 slots on the board, as sent to the client.
 *
 * Every hour 0..23 always exists here. Hours with no row in the database yet
 * are represented with a zero bid and `open` status — they are genuinely
 * unclaimed, not placeholder data.
 */
export interface HourSlot {
  hour_number: number;
  current_bid: number;
  bid_count: number;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_url: string | null;
  brand_logo_url: string | null;
  status: HourStatus;
  /** Minimum accepted bid for this slot, in whole dollars. */
  min_bid: number;
  /** True when the slot has never received a paid bid. */
  claimed: boolean;
}

export interface HoursResponse {
  hours: HourSlot[];
  /** UTC hour (0-23) the server considers live, at the time of the response. */
  current_hour: number;
  /** Server time in ISO-8601, so the client can detect drift. */
  server_time: string;
}

export interface StatsResponse {
  live: number;
  visitors: number;
  pageviews: number;
}

export interface ApiError {
  error: string;
}
