'use client';

import { useEffect, useState } from 'react';

import type { StatsResponse } from '@/lib/types';

type State = { status: 'loading' } | { status: 'ready'; stats: StatsResponse } | { status: 'error' };

function compact(value: number): string {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-baseline sm:gap-1.5">
      <span className="tabular font-mono text-lg font-bold leading-none text-white sm:text-xl">
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-white/40 sm:mt-0">
        {label}
      </span>
    </div>
  );
}

/**
 * The first thing on the page: how many people are on the site right now, and
 * how much traffic the slots get. Real Datafast numbers only — when the API is
 * unreachable the counts are hidden rather than guessed.
 */
export function LiveStatsBar() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/stats', { cache: 'no-store' });
        if (!response.ok) throw new Error(`stats ${response.status}`);
        const stats = (await response.json()) as StatsResponse;
        // Treat an unexpected payload as unavailable rather than rendering
        // undefined into the bar.
        if (typeof stats?.live !== 'number' || typeof stats?.visitors !== 'number') {
          throw new Error('stats payload missing numbers');
        }
        if (!cancelled) setState({ status: 'ready', stats });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    }

    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // When Datafast is unreachable the whole row disappears — no error text, and
  // never a guessed number.
  if (state.status === 'error') return null;

  return (
    <div className="w-full border-b border-white/10 bg-white/[0.03]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <span className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-livered" aria-hidden />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-livered">
            Live
          </span>
        </span>

        {state.status === 'loading' && (
          <span className="h-5 w-56 animate-pulse rounded bg-white/10" aria-hidden />
        )}

        {state.status === 'ready' && (
          <div className="flex flex-1 items-center justify-center gap-5 sm:gap-8">
            <Stat value={state.stats.live.toLocaleString('en-US')} label="here now" />
            <span aria-hidden className="text-white/15">
              ·
            </span>
            <Stat value={compact(state.stats.visitors)} label="visitors 30d" />
            <span aria-hidden className="text-white/15">
              ·
            </span>
            <Stat value={compact(state.stats.pageviews)} label="views 30d" />
          </div>
        )}

        {state.status === 'ready' && state.stats.shareUrl ? (
          <a
            href={state.stats.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 text-xs text-white/50 underline underline-offset-4 transition-colors hover:text-white sm:block"
          >
            Full stats ↗
          </a>
        ) : (
          <span className="hidden shrink-0 sm:block sm:w-16" aria-hidden />
        )}
      </div>
    </div>
  );
}
