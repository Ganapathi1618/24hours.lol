import type { Metadata } from 'next';

import { signOut } from './actions';
import { SignInForm } from './SignInForm';
import { isSignedIn } from './auth';
import { env } from '@/lib/env';
import { buildBoard, formatHourRange, formatMoney } from '@/lib/hours';
import { getAdminClient } from '@/lib/supabase/admin';
import type { BidRow, HourRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Admin — 24hrs.lol',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">24hrs.lol admin</h1>
      <div className="mt-8">{children}</div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="tabular mt-1.5 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  won: 'text-money',
  pending: 'text-neutral-400',
  outbid: 'text-neutral-500',
  refunded: 'text-livered',
};

export default async function AdminPage() {
  if (!env.adminPassword) {
    return (
      <Shell>
        <p className="text-neutral-500">
          Set <code className="font-mono text-neutral-900">ADMIN_PASSWORD</code> in the environment
          to enable this dashboard.
        </p>
      </Shell>
    );
  }

  if (!isSignedIn()) {
    return (
      <Shell>
        <SignInForm />
      </Shell>
    );
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return (
      <Shell>
        <p className="text-neutral-500">Supabase service role key is not configured.</p>
      </Shell>
    );
  }

  const [hoursResult, bidsResult] = await Promise.all([
    supabase.from('hours').select('*').order('hour_number', { ascending: true }),
    supabase.from('bids').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  if (hoursResult.error || bidsResult.error) {
    console.error('[admin]', hoursResult.error ?? bidsResult.error);
    return (
      <Shell>
        <p className="text-livered">Could not read from Supabase. Check the server logs.</p>
      </Shell>
    );
  }

  const board = buildBoard((hoursResult.data ?? []) as HourRow[]);
  const bids = (bidsResult.data ?? []) as BidRow[];

  const claimed = board.filter((slot) => slot.claimed);
  const wonBids = bids.filter((bid) => bid.status === 'won');
  const revenue = wonBids.reduce((total, bid) => total + Number(bid.amount ?? 0), 0);
  const pending = bids.filter((bid) => bid.status === 'pending').length;

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue (won)" value={formatMoney(revenue)} />
        <Stat label="Hours claimed" value={`${claimed.length}/24`} />
        <Stat label="Paid bids" value={String(wonBids.length)} />
        <Stat label="Pending checkouts" value={String(pending)} />
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Board</h2>
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Hour</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Brand</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Winner</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Bids</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Bid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {board.map((slot) => {
              const row = (hoursResult.data ?? []).find(
                (candidate) => candidate.hour_number === slot.hour_number,
              );
              return (
                <tr key={slot.hour_number}>
                  <td className="px-4 py-2.5 font-mono">{formatHourRange(slot.hour_number)}</td>
                  <td className="px-4 py-2.5">
                    {slot.brand_name ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {row?.winner_email ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-mono">{slot.bid_count}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono font-bold text-money">
                    {formatMoney(slot.current_bid)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Recent bids</h2>
      {bids.length === 0 ? (
        <p className="text-sm text-neutral-500">No bids yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Hour</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Bidder</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {bids.map((bid) => (
                <tr key={bid.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-neutral-500">
                    {new Date(bid.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{formatHourRange(bid.hour_number)}</td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-neutral-500">
                    {bid.bidder_email}
                  </td>
                  <td
                    className={`px-4 py-2.5 font-mono text-xs uppercase ${
                      STATUS_STYLES[bid.status] ?? 'text-neutral-500'
                    }`}
                  >
                    {bid.status}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-mono font-bold">
                    {formatMoney(Number(bid.amount ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={signOut} className="mt-10">
        <button type="submit" className="text-sm font-medium text-neutral-500 underline underline-offset-4">
          Sign out
        </button>
      </form>
    </Shell>
  );
}
