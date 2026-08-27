import assert from 'node:assert/strict';

import { applyWinningBid, recordBid, demotePreviousWinner } from '../lib/settle';
import type { BidInput } from '../lib/validation';
import { FakeDb } from './helpers/fake-supabase';

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}\n      ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

const bid = (amount: number, email = 'new@x.com'): BidInput => ({
  hour_number: 9,
  bid_amount: amount,
  bidder_email: email,
  brand_name: 'Acme',
  brand_tagline: 'Ship it',
  brand_url: 'https://acme.com',
  brand_logo_url: null,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (db: FakeDb) => db as any;

async function main() {
  console.log('\n— Settlement —');

  await check('creates the hour row when the slot has never been sold', async () => {
    const db = new FakeDb();
    const outcome = await applyWinningBid(client(db), bid(25));
    assert.deepEqual(outcome, { result: 'won', previousWinnerEmail: null, previousBid: 0 });
    assert.equal(db.tables.hours?.length, 1);
    assert.equal(db.tables.hours?.[0]?.current_bid, 25);
    assert.equal(db.tables.hours?.[0]?.bid_count, 1);
  });

  await check('beats a standing bid and reports who was displaced', async () => {
    const db = new FakeDb();
    db.tables.hours = [
      { id: 'h9', hour_number: 9, current_bid: '50.00', bid_count: 3, winner_email: 'old@x.com' },
    ];
    const outcome = await applyWinningBid(client(db), bid(51));
    assert.deepEqual(outcome, { result: 'won', previousWinnerEmail: 'old@x.com', previousBid: 50 });
    assert.equal(db.tables.hours?.[0]?.current_bid, 51);
    assert.equal(db.tables.hours?.[0]?.bid_count, 4);
    assert.equal(db.tables.hours?.[0]?.winner_email, 'new@x.com');
  });

  await check('refuses a bid equal to the standing bid', async () => {
    const db = new FakeDb();
    db.tables.hours = [{ id: 'h9', hour_number: 9, current_bid: 50, bid_count: 1, winner_email: 'o@x.com' }];
    const outcome = await applyWinningBid(client(db), bid(50));
    assert.deepEqual(outcome, { result: 'outbid', standingBid: 50 });
    assert.equal(db.tables.hours?.[0]?.winner_email, 'o@x.com');
  });

  await check('RACE: a higher bid landing mid-flight makes this payment refundable', async () => {
    const db = new FakeDb();
    db.tables.hours = [{ id: 'h9', hour_number: 9, current_bid: 50, bid_count: 1, winner_email: 'o@x.com' }];
    // Someone pays $80 in the gap between our read and our write.
    db.beforeUpdate = () => {
      db.beforeUpdate = null;
      const row = db.tables.hours?.[0];
      if (row) Object.assign(row, { current_bid: 80, bid_count: 2, winner_email: 'rich@x.com' });
    };
    const outcome = await applyWinningBid(client(db), bid(60));
    assert.deepEqual(outcome, { result: 'outbid', standingBid: 80 });
    assert.equal(db.tables.hours?.[0]?.current_bid, 80, 'the higher bid must survive');
    assert.equal(db.tables.hours?.[0]?.winner_email, 'rich@x.com');
  });

  await check('RACE: a lower bid landing mid-flight is overwritten, not double counted', async () => {
    const db = new FakeDb();
    db.tables.hours = [{ id: 'h9', hour_number: 9, current_bid: 50, bid_count: 1, winner_email: 'o@x.com' }];
    db.beforeUpdate = () => {
      db.beforeUpdate = null;
      const row = db.tables.hours?.[0];
      if (row) Object.assign(row, { current_bid: 55, bid_count: 2, winner_email: 'mid@x.com' });
    };
    const outcome = await applyWinningBid(client(db), bid(90));
    assert.equal(outcome.result, 'won');
    assert.equal(db.tables.hours?.[0]?.current_bid, 90);
    // Retried against the fresh row, so the count reflects both bids.
    assert.equal(db.tables.hours?.[0]?.bid_count, 3);
  });

  await check('RACE: a row created concurrently is re-read instead of duplicated', async () => {
    const db = new FakeDb();
    db.failNextHoursInsert = true;
    // The concurrent creator's row, which our retry must find.
    db.tables.hours = [];
    const original = db.from.bind(db);
    let inserted = false;
    // Simulate the winner of the insert race appearing right after our failure.
    db.from = ((table: string) => {
      if (!inserted && db.failNextHoursInsert === false && db.tables.hours?.length === 0) {
        db.tables.hours.push({ id: 'h9', hour_number: 9, current_bid: 20, bid_count: 1, winner_email: 'first@x.com' });
        inserted = true;
      }
      return original(table);
    }) as typeof db.from;

    const outcome = await applyWinningBid(client(db), bid(30));
    assert.equal(outcome.result, 'won');
    assert.equal(db.tables.hours?.length, 1, 'no duplicate hour row');
    assert.equal(db.tables.hours?.[0]?.current_bid, 30);
    assert.equal(db.tables.hours?.[0]?.bid_count, 2);
  });

  console.log('\n— Bid records —');

  await check('promotes the pending row for this payment rather than duplicating it', async () => {
    const db = new FakeDb();
    db.tables.bids = [{ id: 'b1', payment_id: 'pay_1', status: 'pending', hour_number: 9, amount: 51 }];
    await recordBid(client(db), bid(51), 'pay_1', 'won');
    assert.equal(db.tables.bids?.length, 1);
    assert.equal(db.tables.bids?.[0]?.status, 'won');
  });

  await check('inserts a bid row when checkout never wrote one', async () => {
    const db = new FakeDb();
    await recordBid(client(db), bid(51), 'pay_2', 'won');
    assert.equal(db.tables.bids?.length, 1);
    assert.equal(db.tables.bids?.[0]?.status, 'won');
    assert.equal(db.tables.bids?.[0]?.payment_id, 'pay_2');
  });

  await check('demotes the old winner but never the new one', async () => {
    const db = new FakeDb();
    db.tables.bids = [
      { id: 'b1', payment_id: 'old', status: 'won', hour_number: 9 },
      { id: 'b2', payment_id: 'new', status: 'won', hour_number: 9 },
      { id: 'b3', payment_id: 'other', status: 'won', hour_number: 12 },
    ];
    await demotePreviousWinner(client(db), 9, 'new');
    assert.equal(db.tables.bids?.[0]?.status, 'outbid');
    assert.equal(db.tables.bids?.[1]?.status, 'won', 'the new winner keeps the hour');
    assert.equal(db.tables.bids?.[2]?.status, 'won', 'other hours untouched');
  });

  console.log(`\n${passed} checks passed.\n`);
}

void main();
