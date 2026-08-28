'use client';

import { formatHour12, formatMoney, upcomingHours } from '@/lib/hours';
import type { HourSlot } from '@/lib/types';

const HOT_BID_THRESHOLD = 3;

interface Props {
  hours: HourSlot[];
  currentHour: number;
  onBid: (hourNumber: number) => void;
}

/** The four hours coming up next, as a horizontally scrollable strip on mobile. */
export function NextHoursStrip({ hours, currentHour, onBid }: Props) {
  const byHour = new Map(hours.map((slot) => [slot.hour_number, slot]));
  const next = upcomingHours(currentHour, 4)
    .map((hour) => byHour.get(hour))
    .filter((slot): slot is HourSlot => slot !== undefined);

  if (next.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
        Next hours
      </h2>

      <ul className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        {next.map((slot) => (
          <li key={slot.hour_number} className="min-w-[8.5rem] flex-1 snap-start">
            <button
              type="button"
              onClick={() => onBid(slot.hour_number)}
              className="w-full rounded border border-neutral-200 px-4 py-3.5 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="tabular flex items-center gap-1.5 font-mono text-sm font-medium">
                {formatHour12(slot.hour_number)}
                {slot.bid_count >= HOT_BID_THRESHOLD && <span aria-label="Hot slot">🔥</span>}
              </span>
              <span className="tabular mt-1 block font-mono text-lg font-bold text-money">
                {formatMoney(slot.current_bid)}
              </span>
              <span className="mt-0.5 block truncate text-xs text-neutral-400">
                {slot.claimed && slot.brand_name ? slot.brand_name : 'Available'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <a
        href="#board"
        className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
      >
        View all 24 hours →
      </a>
    </section>
  );
}
