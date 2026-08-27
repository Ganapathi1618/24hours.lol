-- 24hrs.lol — hourly advertising slots.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.hours (
  id uuid primary key default gen_random_uuid(),
  hour_number int not null unique check (hour_number between 0 and 23),
  current_bid numeric(10,2) default 0,
  bid_count int default 0,
  brand_name text,
  brand_tagline text,
  brand_url text,
  brand_logo_url text,
  winner_email text,
  status text default 'open' check (status in ('open', 'live', 'ended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  hour_number int not null,
  amount numeric(10,2) not null,
  bidder_email text not null,
  brand_name text,
  brand_tagline text,
  brand_url text,
  brand_logo_url text,
  payment_id text,
  status text default 'pending' check (status in ('pending', 'won', 'outbid', 'refunded')),
  created_at timestamptz default now()
);

-- The webhook looks bids up by payment id for its idempotency check, and the
-- admin dashboard reads them newest-first.
create index if not exists bids_payment_id_idx on public.bids (payment_id);
create index if not exists bids_hour_number_idx on public.bids (hour_number);
create index if not exists bids_created_at_idx on public.bids (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The board is public. Bids may be inserted by anyone (the checkout route runs
-- with the anon key in the worst case) but are never publicly readable: they
-- hold bidder email addresses. Only the service role reads or updates them.
-- ---------------------------------------------------------------------------

alter table public.hours enable row level security;
alter table public.bids enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hours' and policyname = 'hours are public'
  ) then
    create policy "hours are public" on public.hours for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bids' and policyname = 'anyone can insert bids'
  ) then
    create policy "anyone can insert bids" on public.bids for insert with check (true);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hours'
  ) then
    alter publication supabase_realtime add table public.hours;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Seed: opening reserve prices for the first six slots.
-- ---------------------------------------------------------------------------

insert into public.hours (hour_number, current_bid, status)
values
  (9, 50, 'open'),
  (12, 40, 'open'),
  (18, 35, 'open'),
  (21, 30, 'open'),
  (15, 25, 'open'),
  (0, 10, 'open')
on conflict (hour_number) do nothing;
