'use client';

import { BrandMark } from './BrandMark';
import { CircularClock } from './CircularClock';
import { Nav } from './Nav';
import { formatHourRange, formatMoney } from '@/lib/hours';
import type { HourSlot } from '@/lib/types';

interface Props {
  now: Date;
  currentHour: number;
  slot: HourSlot | null;
  onBid: (hourNumber: number) => void;
}

export function Hero({ now, currentHour, slot, onBid }: Props) {
  const range = formatHourRange(currentHour);
  const isClaimed = Boolean(slot?.claimed && slot.brand_name);

  return (
    <section
      id="top"
      className="flex min-h-[100svh] flex-col bg-ink text-white sm:min-h-0"
    >
      <Nav onBid={() => onBid(currentHour)} />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:py-16">
        <div className="flex flex-col items-center lg:items-start">
          <CircularClock now={now} currentHour={currentHour} />
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-white/40">
            UTC · {range}
          </p>
        </div>

        {isClaimed && slot ? (
          <article className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
              Featured this hour
            </p>

            <div className="mt-5 flex items-center gap-4">
              <BrandMark name={slot.brand_name ?? ''} logoUrl={slot.brand_logo_url} size={56} />
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">
                  {slot.brand_name}
                </h2>
                {slot.brand_tagline && (
                  <p className="mt-1 truncate text-sm text-white/55">{slot.brand_tagline}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {slot.brand_url && (
                <a
                  href={slot.brand_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="inline-flex flex-1 items-center justify-center rounded bg-accent px-5 py-3 text-sm font-medium text-white hover:opacity-90"
                >
                  Visit site →
                </a>
              )}
              <button
                type="button"
                onClick={() => onBid(currentHour)}
                className="inline-flex items-center justify-center rounded border border-white/15 px-5 py-3 text-sm text-white/80 hover:bg-white/5"
              >
                Outbid
              </button>
            </div>

            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-white/30">
              {range} UTC
              {slot.current_bid ? ` · owned for ${formatMoney(Number(slot.current_bid))}` : ''}
            </p>
          </article>
        ) : (
          <div className="w-full max-w-md">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
              This hour is open
            </p>

            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-white/20 px-5 py-6">
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 font-mono text-lg text-white/30"
              >
                S
              </span>
              <span>
                <span className="block text-2xl font-bold tracking-tight">Your startup here</span>
                <span className="mt-1 block text-sm text-white/40">
                  Name, one line, and a link. Live for 60 minutes.
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onBid(currentHour)}
              className="mt-4 inline-flex w-full items-center justify-center rounded bg-accent px-6 py-3.5 font-medium text-white hover:opacity-90"
            >
              Claim {range}
              {slot && ` · from ${formatMoney(slot.min_bid)}`}
            </button>

            <p className="mt-2.5 text-xs text-white/40">
              Highest bid keeps this spot every day until outbid
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
