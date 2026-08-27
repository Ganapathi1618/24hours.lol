'use client';

import { useEffect, useState } from 'react';

import { DATAFAST_SHARE_URL } from '@/lib/public-env';
import type { StatsResponse } from '@/lib/types';

type State = { status: 'loading' } | { status: 'ready'; stats: StatsResponse } | { status: 'error' };

/**
 * Live traffic, straight from Datafast. When the API is unreachable the counts
 * are hidden rather than guessed — only the link to the public dashboard stays.
 */
export function StatsBar() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/stats', { cache: 'no-store' });
        if (!response.ok) throw new Error(`stats ${response.status}`);
        const stats = (await response.json()) as StatsResponse;
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

  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-white/10 px-5 py-4 text-sm text-white/60 sm:flex-row sm:justify-center sm:gap-6">
      {state.status === 'loading' && (
        <span className="h-4 w-40 animate-pulse rounded bg-white/10" aria-hidden />
      )}

      {state.status === 'ready' && (
        <p className="tabular flex items-center gap-2 font-mono">
          <span
            className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-money"
            aria-hidden
          />
          <span>
            {state.stats.live.toLocaleString('en-US')} live ·{' '}
            {state.stats.visitors.toLocaleString('en-US')} visitors ·{' '}
            {state.stats.pageviews.toLocaleString('en-US')} views
          </span>
        </p>
      )}

      {state.status === 'error' && (
        <p className="font-mono text-white/40">Live stats unavailable</p>
      )}

      <a
        href={DATAFAST_SHARE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/60 underline underline-offset-4 transition-colors hover:text-white"
      >
        Full stats ↗
      </a>
    </div>
  );
}
