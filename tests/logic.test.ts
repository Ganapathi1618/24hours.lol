import assert from 'node:assert/strict';

import {
  minBidFor,
  buildBoard,
  sortForBoard,
  formatHourRange,
  formatHour12,
  formatLocalHourRange,
  formatMoney,
  upcomingHours,
} from '../lib/hours';
import { validateBid, normaliseUrl } from '../lib/validation';
import { verifyWebhookSignature } from '../lib/webhook-signature';
import type { HourRow } from '../lib/types';

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}\n      ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

console.log('\n— Standard Webhooks signature (published test vector) —');
check('accepts the canonical signature', () => {
  const result = verifyWebhookSignature({
    secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    body: '{"test": 2432232314}',
    webhookId: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
    webhookTimestamp: '1614265330',
    webhookSignature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
    now: 1614265330 * 1000,
  });
  assert.deepEqual(result, { ok: true });
});

check('rejects a tampered body', () => {
  const result = verifyWebhookSignature({
    secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    body: '{"test": 9999999999}',
    webhookId: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
    webhookTimestamp: '1614265330',
    webhookSignature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
    now: 1614265330 * 1000,
  });
  assert.equal(result.ok, false);
});

check('rejects a replayed (stale) timestamp', () => {
  const result = verifyWebhookSignature({
    secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    body: '{"test": 2432232314}',
    webhookId: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
    webhookTimestamp: '1614265330',
    webhookSignature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
    now: (1614265330 + 600) * 1000,
  });
  assert.equal(result.ok, false);
});

check('accepts one valid signature among rotated keys', () => {
  const result = verifyWebhookSignature({
    secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    body: '{"test": 2432232314}',
    webhookId: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
    webhookTimestamp: '1614265330',
    webhookSignature: 'v1,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA= v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
    now: 1614265330 * 1000,
  });
  assert.deepEqual(result, { ok: true });
});

check('rejects missing headers', () => {
  const result = verifyWebhookSignature({
    secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    body: '{}',
    webhookId: null,
    webhookTimestamp: null,
    webhookSignature: null,
  });
  assert.equal(result.ok, false);
});

console.log('\n— Bid minimums —');
check('seeded reserve with no bids must be met, not beaten', () => {
  assert.equal(minBidFor(50, 0), 50);
});
check('a slot with bids must be beaten by $1', () => {
  assert.equal(minBidFor(420, 7), 421);
});
check('an untouched slot opens at $10', () => {
  assert.equal(minBidFor(0, 0), 10);
});
check('fractional standing bids round up to the next whole dollar', () => {
  assert.equal(minBidFor(50.5, 3), 51);
});

console.log('\n— Board assembly —');
const rows: HourRow[] = [
  {
    id: 'a', hour_number: 9, current_bid: '50.00', bid_count: 3, brand_name: 'Acme',
    brand_tagline: 'Ship it', brand_url: 'https://acme.com', brand_logo_url: null,
    winner_email: 'a@b.com', status: 'open', auction_end_time: null, campaign_days: 30,
    created_at: '', updated_at: '',
  },
];
check('always yields all 24 slots', () => {
  assert.equal(buildBoard(rows).length, 24);
});
check('numeric strings from PostgREST become numbers', () => {
  const slot = buildBoard(rows).find((s) => s.hour_number === 9);
  assert.equal(slot?.current_bid, 50);
  assert.equal(slot?.claimed, true);
});
check('hours with no row are unclaimed at $0', () => {
  const slot = buildBoard(rows).find((s) => s.hour_number === 4);
  assert.equal(slot?.current_bid, 0);
  assert.equal(slot?.claimed, false);
  assert.equal(slot?.min_bid, 10);
});
check('ordering is current hour, then future, then past (wraps midnight)', () => {
  const order = sortForBoard(buildBoard([]), 22).map((s) => s.hour_number);
  assert.deepEqual(order.slice(0, 5), [22, 23, 0, 1, 2]);
  assert.equal(order.at(-1), 21);
});
check('hour labels wrap at midnight', () => {
  assert.equal(formatHourRange(23), '23:00–00:00');
  assert.equal(formatHourRange(9), '09:00–10:00');
});
check('money is formatted with separators', () => {
  assert.equal(formatMoney(1240), '$1,240');
});

check('12-hour labels read the way people say them', () => {
  assert.equal(formatHour12(0), '12 AM');
  assert.equal(formatHour12(9), '9 AM');
  assert.equal(formatHour12(12), '12 PM');
  assert.equal(formatHour12(13), '1 PM');
  assert.equal(formatHour12(23), '11 PM');
});
check('the next-hours strip wraps past midnight', () => {
  assert.deepEqual(upcomingHours(22, 4), [23, 0, 1, 2]);
  assert.deepEqual(upcomingHours(9, 4), [10, 11, 12, 13]);
});
check('new rows carry the auction window through to the board', () => {
  const slot = buildBoard(rows).find((s) => s.hour_number === 9);
  assert.equal(slot?.campaign_days, 30);
  assert.equal(slot?.auction_end_time, null);
  const empty = buildBoard([]).find((s) => s.hour_number === 4);
  assert.equal(empty?.campaign_days, 30);
});

check('the local hour window is a one-hour range with a zone label', () => {
  // Timezone-agnostic: the suite runs wherever it runs.
  const label = formatLocalHourRange(22, new Date(Date.UTC(2026, 7, 28, 22, 0, 0)));
  assert.ok(label, 'a label is produced');
  assert.match(label ?? '', /^\d{1,2}:\d{2}( [AP]M)?–\d{1,2}:\d{2} [AP]M .+$/);
});
check('local windows that cross noon label both ends', () => {
  const original = process.env.TZ;
  process.env.TZ = 'Asia/Kolkata';
  try {
    const crossing = formatLocalHourRange(6, new Date(Date.UTC(2026, 7, 28, 6, 0, 0)));
    const plain = formatLocalHourRange(22, new Date(Date.UTC(2026, 7, 28, 22, 0, 0)));
    assert.equal(crossing, '11:30 AM–12:30 PM IST');
    assert.equal(plain, '3:30–4:30 AM IST');
  } finally {
    process.env.TZ = original;
  }
});

console.log('\n— Bid validation —');
const good = {
  hour_number: 9, bid_amount: 51, bidder_email: 'Buyer@Example.com ',
  brand_name: 'Acme', brand_tagline: 'Ship it', brand_url: 'acme.com',
  brand_logo_url: '',
};
check('accepts a well-formed bid and normalises it', () => {
  const result = validateBid(good, { currentBid: 50, bidCount: 3 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.bidder_email, 'buyer@example.com');
    assert.equal(result.value.brand_url, 'https://acme.com/');
    assert.equal(result.value.brand_logo_url, null);
  }
});
check('rejects a bid below the live minimum', () => {
  const result = validateBid({ ...good, bid_amount: 50 }, { currentBid: 50, bidCount: 3 });
  assert.equal(result.ok, false);
});
check('rejects an absurd bid', () => {
  const result = validateBid({ ...good, bid_amount: 10_000_000 }, { currentBid: 0, bidCount: 0 });
  assert.equal(result.ok, false);
});
check('rejects a javascript: url', () => {
  const result = validateBid({ ...good, brand_url: 'javascript:alert(1)' }, { currentBid: 0, bidCount: 0 });
  assert.equal(result.ok, false);
});
check('rejects an over-long tagline', () => {
  const result = validateBid({ ...good, brand_tagline: 'x'.repeat(61) }, { currentBid: 0, bidCount: 0 });
  assert.equal(result.ok, false);
});
check('rejects a bad email', () => {
  const result = validateBid({ ...good, bidder_email: 'nope' }, { currentBid: 0, bidCount: 0 });
  assert.equal(result.ok, false);
});
check('rejects an out-of-range hour', () => {
  const result = validateBid({ ...good, hour_number: 24 }, { currentBid: 0, bidCount: 0 });
  assert.equal(result.ok, false);
});
check('normaliseUrl refuses data: urls', () => {
  assert.equal(normaliseUrl('data:text/html,<script>'), null);
});

console.log(`\n${passed} checks passed.\n`);
