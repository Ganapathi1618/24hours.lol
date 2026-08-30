'use client';

import { useEffect, useState } from 'react';
import type { StatsResponse } from '@/lib/types';

interface Props {
  onBid: () => void;
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="white" strokeWidth="1.5" />
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeDasharray="22 66"
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        24
      </text>
    </svg>
  );
}

export function Nav({ onBid }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.live === 'number' && typeof json?.visitors === 'number' && !cancelled) {
          setStats(json);
        }
      } catch {
        /* hide stats if API fails */
      }
    }
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <nav className="flex w-full items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-8 sm:py-4">
      <a href="#top" className="flex shrink-0 items-center gap-2">
        <Logo />
        <span className="hidden font-mono text-sm font-bold tracking-tight text-white sm:inline">
          24HRS<span className="text-white/40">.LOL</span>
        </span>
      </a>

      {stats && (
        <div className="flex min-w-0 items-center rounded-full border border-white/15 bg-white/[0.08] px-2 py-1 backdrop-blur-md sm:px-3 sm:py-1.5">
          <span className="inline-flex items-center gap-1 pr-1.5 sm:gap-1.5 sm:pr-3">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-semibold text-white sm:text-[11px]">
              {stats.live}
            </span>
          </span>
          <span className="h-3 w-px shrink-0 bg-white/20" />
          <span className="flex items-center gap-1.5 pl-1.5 font-mono text-[10px] text-white sm:gap-3 sm:pl-3 sm:text-[11px]">
            <span className="whitespace-nowrap">
              <span className="font-semibold">{stats.visitors}</span>
              <span className="ml-0.5 text-white/45">vis</span>
            </span>
            <span className="whitespace-nowrap">
              <span className="font-semibold">{stats.pageviews}</span>
              <span className="ml-0.5 text-white/45">views</span>
            </span>
          </span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-4 sm:gap-5">
        <a href="#board" className="hidden text-sm text-white/60 hover:text-white sm:block">
          All hours
        </a>
        <a href="#how-it-works" className="hidden text-sm text-white/60 hover:text-white sm:block">
          How it works
        </a>
        <button
          type="button"
          onClick={onBid}
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 sm:px-4"
        >
          Bid Now
        </button>
      </div>
    </nav>
  );
}
