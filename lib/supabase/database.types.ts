import type { BidRow, BidStatus, HourRow, HourStatus } from '@/lib/types';

export type HourInsert = {
  hour_number: number;
  current_bid?: number;
  bid_count?: number;
  brand_name?: string | null;
  brand_tagline?: string | null;
  brand_url?: string | null;
  brand_logo_url?: string | null;
  winner_email?: string | null;
  status?: HourStatus;
  auction_end_time?: string | null;
  campaign_days?: number | null;
  updated_at?: string;
};

export type HourUpdate = Partial<HourInsert>;

export type BidInsert = {
  hour_number: number;
  amount: number;
  bidder_email: string;
  brand_name?: string | null;
  brand_tagline?: string | null;
  brand_url?: string | null;
  brand_logo_url?: string | null;
  payment_id?: string | null;
  status?: BidStatus;
};

export type BidUpdate = Partial<BidInsert>;

export interface Database {
  public: {
    Tables: {
      hours: { Row: HourRow; Insert: HourInsert; Update: HourUpdate; Relationships: [] };
      bids: { Row: BidRow; Insert: BidInsert; Update: BidUpdate; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
