# 24hrs.lol

A live 24-hour advertising clock. Twenty-four hourly slots; the highest bid owns
that hour on the homepage clock, every day, until someone outbids it.

Next.js 14 (App Router) · TypeScript (strict) · Supabase · Dodo Payments ·
Tailwind · Vercel.

---

## How it works

- **The board runs on UTC.** `hours.hour_number` is a UTC hour, so every visitor
  anywhere sees the same brand go live at the same moment. The homepage clock is
  labelled UTC for that reason.
- **The database holds only the hours that have been touched.** The board always
  renders all 24 slots; hours with no row are genuinely unclaimed, opening at $10.
- **Bidding is pay-to-win, settled by webhook.** A bidder is charged exactly their
  bid up front. The hour only changes hands when Dodo confirms the payment.
- **Losing a race refunds automatically.** If a higher bid settles first, the
  later payment is recorded as `outbid` and refunded through the Dodo API.

### Bid minimums

| Slot state | Minimum bid |
| --- | --- |
| No row, or `current_bid` 0 | $10 |
| Reserve set, no bids yet (the seeded hours) | the reserve, met exactly |
| One or more bids | `current_bid + 1` |

The minimum is always recomputed from the database inside
`/api/bid/checkout` — a tampered client payload cannot undercut the standing bid.

---

## Setup

### 1. Database

Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor. It is
idempotent, and it creates the tables, indexes, RLS policies, the realtime
publication and the six seeded opening prices.

Note on RLS: `hours` is world-readable, `bids` is insert-only and **never**
publicly readable — bid rows hold bidder email addresses. Only the service role
reads them.

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in. Every key and what it does is
documented there. `RESEND_API_KEY` and `ADMIN_PASSWORD` are optional: without
them, emails are skipped and `/admin` stays disabled.

### 3. Dodo Payments

Create a product for bids and put its id in `DODO_BID_PRODUCT_ID`; the per-bid
amount is overridden at checkout, so the product's own price does not matter.
Point the webhook at `https://<your-domain>/api/webhooks/dodo` and copy the
signing secret into `DODO_WEBHOOK_SECRET`.

### 4. Cron

`vercel.json` schedules `/api/cron/rollover` daily at 00:00 UTC — the Vercel
hobby plan allows at most one cron run per day. Vercel sends `CRON_SECRET` as a
bearer token automatically; the route rejects anything else.

This only affects the bookkeeping `hours.status` column, not what visitors see:
the board derives LIVE NOW and the featured brand from the ticking clock, so the
right hour goes live every hour regardless of when the cron last ran. On a paid
plan you can restore `"0 * * * *"` to keep `status` accurate hour by hour.

---

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit, strict
npm run lint
npm test             # pure logic: bid minimums, board assembly, validation,
                     # webhook signatures, settlement races
npm run build && npm run test:e2e   # full money path against a mock Supabase + Dodo
```

`npm run test:e2e` boots the production build against a stand-in PostgREST and
Dodo (`tests/helpers/mock-server.mjs`) and drives the real routes: checkout,
signature rejection, claiming an hour, webhook idempotency, outbid refunds and
the server-rendered board.

---

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/hours` | The full 24-slot board. Never cached. |
| `POST /api/bid/checkout` | Validates a bid against the live minimum, creates a Dodo payment link. |
| `POST /api/webhooks/dodo` | Signature-verified settlement. Idempotent. |
| `GET /api/stats` | Datafast live/visitor counts, revalidated every 30s. |
| `GET /api/cron/rollover` | Daily status rollover. Bearer `CRON_SECRET`. |
| `/admin` | Revenue, board state and recent bids. Password gated. |

---

## Notes for whoever maintains this

- **Server-side Supabase calls opt out of the Next data cache** via
  `lib/supabase/no-store-fetch.ts`. Without it, Next caches the `fetch` that
  supabase-js makes and the board serves a stale auction. Do not remove it.
- **Settlement uses optimistic concurrency**, not a transaction: it reads the
  hour, then writes only while `current_bid` and `bid_count` are unchanged,
  retrying on conflict. `tests/settlement.test.ts` covers the race cases.
- **The webhook is idempotent by `payment_id`.** It returns 500 on transient
  failures so Dodo retries, which is only safe because of that check.
- **`/api/stats` fails closed.** If Datafast is unreachable the UI hides the
  counts rather than showing invented numbers.
