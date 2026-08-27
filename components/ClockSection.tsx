'use client';

import { BrandMark } from './BrandMark';
import { ErrorBoundary } from './ErrorBoundary';
import { StatsBar } from './StatsBar';
import { formatHourRange } from '@/lib/hours';
import type { HourSlot } from '@/lib/types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The board runs on UTC, so the clock shows UTC for every visitor. */
function formatClock(date: Date | null): string {
  if (!date) return '--:--:--';
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

interface Props {
  now: Date | null;
  currentHour: number;
  slot: HourSlot | null;
  onBid: (hourNumber: number) => void;
}

export function ClockSection({ now, currentHour, slot, onBid }: Props) {
  const range = formatHourRange(currentHour);
  const isClaimed = Boolean(slot?.claimed && slot.brand_name);

  return (
    <section className="flex min-h-[100svh] flex-col items-center justify-between bg-ink px-5 py-10 text-white sm:min-h-0 sm:py-16">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 sm:gap-10">
        <div className="text-center">
          <time
            className="tabular block font-mono text-[3.25rem] font-bold leading-none tracking-tight sm:text-8xl"
            dateTime={now?.toISOString()}
            suppressHydrationWarning
          >
            {formatClock(now)}
          </time>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-white/40">
            UTC · {range}
          </p>
        </div>

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
                  Visit →
                </a>
              )}
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-white/30">
              Sponsored · {range} UTC
            </p>
          </article>
        ) : (
          <div className="w-full max-w-md text-center">
            <p className="text-xl font-semibold sm:text-2xl">This hour is unclaimed</p>
            <button
              type="button"
              onClick={() => onBid(currentHour)}
              className="mt-4 inline-flex w-full items-center justify-center rounded bg-accent px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Be the first to own {range} →
            </button>
          </div>
        )}
      </div>

      <ErrorBoundary fallback={null}>
        <StatsBar />
      </ErrorBoundary>
    </section>
  );
}
