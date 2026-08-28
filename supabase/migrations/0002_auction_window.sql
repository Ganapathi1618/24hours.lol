-- Auction windows and campaign length.
-- Safe to run more than once.

alter table public.hours add column if not exists auction_end_time timestamptz;
alter table public.hours add column if not exists campaign_days int default 30;

-- The board reads these on every load.
create index if not exists hours_auction_end_time_idx on public.hours (auction_end_time);
