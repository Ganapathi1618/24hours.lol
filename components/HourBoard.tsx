'use client';

import { Countdown } from './Countdown';
import { formatHourRange, formatMoney, sortForBoard } from '@/lib/hours';
import type { HourSlot } from '@/lib/types';

interface Props {
  hours: HourSlot[];
  currentHour: number;
  onBid: (hourNumber: number) => void;
}

const HOT_BID_THRESHOLD = 3;

export function HourBoard({ hours, currentHour, onBid }: Props) {
  const ordered = sortForBoard(hours, currentHour);

  return (
    <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
      {ordered.map((slot) => {
        const isLive = slot.hour_number === currentHour;
        const isHot = slot.bid_count >= HOT_BID_THRESHOLD;
        const displayPrice = slot.claimed ? slot.current_bid : slot.min_bid;

        return (
          <li key={slot.hour_number}>
            <button
              type="button"
              onClick={() => onBid(slot.hour_number)}
              aria-label={`Bid on ${formatHourRange(slot.hour_number)} UTC, from ${formatMoney(displayPrice)}`}
              className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-4 text-left transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:grid-cols-[10.5rem_1fr_6rem_7rem_9rem] sm:gap-x-4 ${
                isLive ? 'border-l-2 border-l-accent bg-blue-50/40' : 'border-l-2 border-l-transparent'
              }`}
            >
              <span className="tabular flex items-center gap-1.5 font-mono text-sm font-medium">
                {formatHourRange(slot.hour_number)}
                {isHot && <span aria-label="Hot slot">🔥</span>}
              </span>

              <span className="min-w-0 truncate text-sm">
                {slot.claimed && slot.brand_name ? (
                  <span className="font-medium">{slot.brand_name}</span>
                ) : (
                  <span className="text-neutral-400">Available</span>
                )}
              </span>

              <span className="tabular col-start-3 row-start-1 flex flex-col items-end font-mono text-xs text-neutral-400 sm:col-start-3 sm:items-start">
                <span>
                  {slot.bid_count} {slot.bid_count === 1 ? 'bid' : 'bids'}
                </span>
                {slot.auction_end_time && (
                  <Countdown endsAt={slot.auction_end_time} className="text-[10px] text-neutral-400" />
                )}
              </span>

              <span className="tabular col-span-2 col-start-1 row-start-2 font-mono text-base font-bold text-money sm:col-span-1 sm:col-start-4 sm:row-start-1 sm:text-right">
                {formatMoney(displayPrice)}
              </span>

              <span className="col-start-3 row-start-2 flex items-center justify-end gap-3 sm:col-start-5 sm:row-start-1">
                {isLive ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-livered">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-livered" aria-hidden />
                    Live now
                  </span>
                ) : (
                  <span className="whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                    {slot.status === 'ended' ? 'Closed' : 'Open'}
                  </span>
                )}
                <span className="whitespace-nowrap text-sm font-medium text-accent">Bid Now →</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
