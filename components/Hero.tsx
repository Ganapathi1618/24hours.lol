'use client';

import { BrandMark } from './BrandMark';
import { CircularClock } from './CircularClock';
import { ErrorBoundary } from './ErrorBoundary';
import { Nav } from './Nav';
import { StatsBar } from './StatsBar';
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

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 px-5 py-8 sm:gap-10 sm:py-14">
        <CircularClock now={now} currentHour={currentHour} />

        {isClaimed && slot ? (
          <article className="w-full max-w-md rounded border border-white/10 bg-white/[0.03] p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <BrandMark name={slot.brand_name ?? ''} logoUrl={slot.brand_logo_url} size={56} />
              <div>
                <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{slot.brand_name}</h2>
                {slot.brand_tagline && (
                  <p className="mt-2 text-base text-white/60">{slot.brand_tagline}</p>
                )}
              </div>
              {slot.brand_url && (
                <a
                  href={slot.brand_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="inline-flex w-full items-center justify-center rounded bg-accent px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Visit Brand →
                </a>
              )}
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-white/30">
              Sponsored · {range} UTC
            </p>
          </article>
        ) : (
          <div className="w-full max-w-md text-center">
            <div className="rounded border border-dashed border-white/15 px-6 py-8">
              <p className="text-lg font-semibold">This hour is unclaimed</p>
              <p className="mt-1.5 text-sm text-white/40">
                One brand, one hour, front and centre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onBid(currentHour)}
              className="mt-4 inline-flex w-full items-center justify-center rounded bg-accent px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Own {range} →
            </button>
            {slot && (
              <p className="mt-2.5 font-mono text-xs text-white/40">
                from {formatMoney(slot.min_bid)}
              </p>
            )}
          </div>
        )}
      </div>

      <ErrorBoundary fallback={null}>
        <StatsBar />
      </ErrorBoundary>
    </section>
  );
}
