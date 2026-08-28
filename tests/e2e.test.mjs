/** Drives the real Next server against the mock PostgREST + Dodo. */
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import mock from './helpers/mock-server.mjs';

const BASE = 'http://127.0.0.1:3100';
const WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-secret-for-24hrs-lol').toString('base64');

let passed = 0;
const refunds = [];
mock.on('dodo:refund', (body) => refunds.push(body));

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}\n      ${error.message}`);
    process.exitCode = 1;
  }
}

/** Sign a payload exactly the way Dodo (Standard Webhooks) does. */
function signedHeaders(bodyText) {
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(WEBHOOK_SECRET.slice('whsec_'.length), 'base64');
  const signature = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${bodyText}`, 'utf8')
    .digest('base64');
  return {
    'Content-Type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  };
}

function paymentEvent(paymentId, metadata) {
  return JSON.stringify({
    type: 'payment.succeeded',
    data: { payment_id: paymentId, status: 'succeeded', metadata },
  });
}

const hourOf = (board, n) => board.hours.find((h) => h.hour_number === n);

async function main() {
  await new Promise((resolve) => mock.listen(54321, resolve));

  console.log('\n— Board API —');

  let board;
  await check('GET /api/hours returns all 24 slots from the database', async () => {
    const response = await fetch(`${BASE}/api/hours`);
    assert.equal(response.status, 200);
    board = await response.json();
    assert.equal(board.hours.length, 24);
    assert.equal(hourOf(board, 9).current_bid, 50);
    assert.equal(hourOf(board, 9).min_bid, 50, 'reserve is met, not beaten, before any bids');
    assert.equal(hourOf(board, 7).current_bid, 0, 'hours with no row are unclaimed');
    assert.equal(hourOf(board, 7).min_bid, 10);
  });

  console.log('\n— Checkout —');

  await check('rejects a bid under the reserve', async () => {
    const response = await fetch(`${BASE}/api/bid/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hour_number: 9, bid_amount: 49, bidder_email: 'a@b.com',
        brand_name: 'Acme', brand_tagline: 'Ship it', brand_url: 'https://acme.com',
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(data.error, /at least \$50/);
  });

  await check('rejects a javascript: website URL', async () => {
    const response = await fetch(`${BASE}/api/bid/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hour_number: 9, bid_amount: 60, bidder_email: 'a@b.com',
        brand_name: 'Acme', brand_tagline: 'Ship it', brand_url: 'javascript:alert(1)',
      }),
    });
    assert.equal(response.status, 400);
  });

  let paymentId;
  await check('valid bid returns a Dodo payment link and records a pending bid', async () => {
    const response = await fetch(`${BASE}/api/bid/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hour_number: 9, bid_amount: 60, bidder_email: 'first@acme.com',
        brand_name: 'Acme', brand_tagline: 'Ship it fast', brand_url: 'acme.com',
        brand_logo_url: '',
      }),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.match(data.url, /^https:\/\/checkout\.test\//);
    paymentId = data.url.split('/').pop();

    const pending = mock.db.bids.filter((b) => b.status === 'pending');
    assert.equal(pending.length, 1);
    assert.equal(pending[0].payment_id, paymentId);
    assert.equal(Number(pending[0].amount), 60);
  });

  await check('the charge sent to Dodo is exactly the bid, in minor units', async () => {
    const payment = mock.db.bids.find((b) => b.payment_id === paymentId);
    assert.equal(Number(payment.amount), 60);
  });

  console.log('\n— Webhook —');

  await check('rejects an unsigned request', async () => {
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: paymentEvent('pay_nope', { type: 'hour_bid', hour_number: '9', bid_amount: '999' }),
    });
    assert.equal(response.status, 401);
  });

  await check('rejects a forged signature', async () => {
    const bodyText = paymentEvent('pay_forged', { type: 'hour_bid', hour_number: '9', bid_amount: '999' });
    const headers = signedHeaders(bodyText);
    headers['webhook-signature'] = 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const response = await fetch(`${BASE}/api/webhooks/dodo`, { method: 'POST', headers, body: bodyText });
    assert.equal(response.status, 401);
  });

  await check('rejects a body altered after signing', async () => {
    const original = paymentEvent('pay_x', { type: 'hour_bid', hour_number: '9', bid_amount: '60' });
    const headers = signedHeaders(original);
    const tampered = paymentEvent('pay_x', { type: 'hour_bid', hour_number: '9', bid_amount: '99999' });
    const response = await fetch(`${BASE}/api/webhooks/dodo`, { method: 'POST', headers, body: tampered });
    assert.equal(response.status, 401);
  });

  const winnerMetadata = {
    type: 'hour_bid', hour_number: '9', bid_amount: '60', bidder_email: 'first@acme.com',
    brand_name: 'Acme', brand_tagline: 'Ship it fast', brand_url: 'https://acme.com/',
    brand_logo_url: '',
  };

  await check('a signed payment claims the hour', async () => {
    const bodyText = paymentEvent(paymentId, winnerMetadata);
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, result: 'won' });

    const hour = mock.db.hours.find((h) => Number(h.hour_number) === 9);
    assert.equal(Number(hour.current_bid), 60);
    assert.equal(hour.bid_count, 1);
    assert.equal(hour.brand_name, 'Acme');
    assert.equal(hour.winner_email, 'first@acme.com');
  });

  await check('the pending bid was promoted, not duplicated', async () => {
    const forPayment = mock.db.bids.filter((b) => b.payment_id === paymentId);
    assert.equal(forPayment.length, 1);
    assert.equal(forPayment[0].status, 'won');
  });

  await check('a retried webhook is idempotent', async () => {
    const bodyText = paymentEvent(paymentId, winnerMetadata);
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, duplicate: true });

    const hour = mock.db.hours.find((h) => Number(h.hour_number) === 9);
    assert.equal(hour.bid_count, 1, 'the bid count must not move on a retry');
    assert.equal(Number(hour.current_bid), 60);
  });

  await check('the board now shows the winner', async () => {
    const response = await fetch(`${BASE}/api/hours`);
    const fresh = await response.json();
    const nine = hourOf(fresh, 9);
    assert.equal(nine.brand_name, 'Acme');
    assert.equal(nine.claimed, true);
    assert.equal(nine.current_bid, 60);
    assert.equal(nine.min_bid, 61, 'the next bidder must beat it by a dollar');
  });

  await check('a higher payment takes the hour and demotes the old winner', async () => {
    const metadata = {
      type: 'hour_bid', hour_number: '9', bid_amount: '150', bidder_email: 'second@globex.com',
      brand_name: 'Globex', brand_tagline: 'Bigger', brand_url: 'https://globex.com/', brand_logo_url: '',
    };
    const bodyText = paymentEvent('pay_globex', metadata);
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.deepEqual(await response.json(), { received: true, result: 'won' });

    const hour = mock.db.hours.find((h) => Number(h.hour_number) === 9);
    assert.equal(Number(hour.current_bid), 150);
    assert.equal(hour.bid_count, 2);
    assert.equal(hour.winner_email, 'second@globex.com');

    const old = mock.db.bids.find((b) => b.payment_id === paymentId);
    assert.equal(old.status, 'outbid', 'the displaced bid is marked outbid');
    const fresh = mock.db.bids.find((b) => b.payment_id === 'pay_globex');
    assert.equal(fresh.status, 'won');
  });

  await check('a payment that lost the race is refunded, not banked', async () => {
    const metadata = {
      type: 'hour_bid', hour_number: '9', bid_amount: '80', bidder_email: 'slow@initech.com',
      brand_name: 'Initech', brand_tagline: 'Late', brand_url: 'https://initech.com/', brand_logo_url: '',
    };
    const bodyText = paymentEvent('pay_slow', metadata);
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.deepEqual(await response.json(), { received: true, result: 'outbid', refunded: true });

    const hour = mock.db.hours.find((h) => Number(h.hour_number) === 9);
    assert.equal(Number(hour.current_bid), 150, 'the standing winner is untouched');
    assert.equal(hour.winner_email, 'second@globex.com');

    const bid = mock.db.bids.find((b) => b.payment_id === 'pay_slow');
    assert.equal(bid.status, 'refunded');
    assert.equal(refunds.at(-1).payment_id, 'pay_slow');
  });

  await check('a payment for an hour with no row creates that row', async () => {
    const metadata = {
      type: 'hour_bid', hour_number: '3', bid_amount: '10', bidder_email: 'night@owl.com',
      brand_name: 'Owl', brand_tagline: 'Night shift', brand_url: 'https://owl.com/', brand_logo_url: '',
    };
    const bodyText = paymentEvent('pay_owl', metadata);
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.deepEqual(await response.json(), { received: true, result: 'won' });
    const hour = mock.db.hours.find((h) => Number(h.hour_number) === 3);
    assert.equal(Number(hour.current_bid), 10);
    assert.equal(hour.brand_name, 'Owl');
  });

  await check('non-bid events are acknowledged and ignored', async () => {
    const bodyText = JSON.stringify({ type: 'subscription.active', data: { payment_id: 'x', metadata: {} } });
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ignored, 'subscription.active');
  });

  await check('a signed payment for someone else\'s product is ignored', async () => {
    const bodyText = paymentEvent('pay_other', { type: 'tshirt_order', size: 'L' });
    const response = await fetch(`${BASE}/api/webhooks/dodo`, {
      method: 'POST', headers: signedHeaders(bodyText), body: bodyText,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ignored, 'not an hour bid');
  });

  console.log('\n— Cron —');

  await check('rollover rejects a missing secret', async () => {
    const response = await fetch(`${BASE}/api/cron/rollover`);
    assert.equal(response.status, 401);
  });

  await check('rollover marks the on-air hour live', async () => {
    const response = await fetch(`${BASE}/api/cron/rollover`, {
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.live_hour, new Date().getUTCHours());
  });

  console.log('\n— Stats —');

  // TEMPORARY: /api/stats is a raw passthrough while we identify Datafast's
  // response shape. Restore the parsed-numbers assertions when the route is
  // reverted (see the header comment in app/api/stats/route.ts).
  await check('stats passes the upstream payloads through untouched', async () => {
    const response = await fetch(`${BASE}/api/stats`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.debug, true);
    // Verbatim, not reinterpreted.
    assert.equal(data.realtime.live, 12);
    assert.equal(data.overview.visitors, 48210);
    assert.equal(data.overview.pageviews, 91500);
    assert.ok(Array.isArray(data.overview.countries), 'nested shapes survive');
    assert.equal(data.meta.realtime.status, 200);
    assert.equal(data.meta.overview.status, 200);
    // Today, never a future date.
    assert.equal(data.dateRange.endAt, new Date().toISOString().split('T')[0]);
  });

  console.log('\n— Analytics —');

  await check('parses Datafast payloads into audience insights', async () => {
    const response = await fetch(`${BASE}/api/analytics`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.live, 12);
    assert.equal(data.monthlyVisitors, 48210);
    assert.equal(data.monthlyPageviews, 91500);
    assert.equal(data.dailyAveragePageviews, Math.round(91500 / 30));
    assert.equal(data.topCountries[0].name, 'United States', 'countries sorted by visitors');
    assert.equal(data.topCountries.length, 3);
    assert.equal(data.hourly.length, 24, 'every UTC hour is bucketed');
    assert.ok(data.hourly.every((p) => p.hour >= 0 && p.hour <= 23));
  });

  console.log('\n— Page —');

  await check('the homepage server-renders the live board', async () => {
    const response = await fetch(BASE);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('THE INTERNET HAS 24 HOURS.'), 'headline present');
    assert.ok(html.includes('How it works'), 'how-it-works section present');
    assert.ok(html.includes('Globex'), 'winning brand rendered server-side');
    assert.ok(html.includes('09:00–10:00'), 'hour labels rendered');
    assert.ok(html.includes('Bigger'), 'the winning tagline is server-rendered');
  });

  console.log(`\n${passed} checks passed.\n`);
  process.exit(process.exitCode ?? 0);
}

main();
