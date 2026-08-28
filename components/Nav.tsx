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
    <nav className="flex w-full items-center justify-between gap-3 px-5 py-4 sm:px-8">
      <a href="#top" className="flex items-center gap-2">
        <Logo />
        <span className="font-mono text-sm font-bold tracking-tight text-white">
          24HRS<span className="text-white/40">.LOL</span>
        </span>
      </a>

      {stats && (
        <div className="flex items-center rounded-full border border-white/15 bg-white/[0.08] px-2 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md sm:px-3 sm:py-1.5">
          <span className="inline-flex items-center gap-1.5 pr-2 sm:pr-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] font-semibold text-white">{stats.live}</span>
            <span className="hidden text-[10px] uppercase tracking-wider text-white/50 sm:inline">
              live
            </span>
          </span>
          <span className="hidden h-3 w-px bg-white/20 sm:block" />
          <span className="hidden items-center gap-3 pl-3 font-mono text-[11px] text-white sm:flex">
            <span>
              <span className="font-semibold">{stats.visitors}</span>
              <span className="ml-1 text-white/45">visitors</span>
            </span>
            <span>
              <span className="font-semibold">{stats.pageviews}</span>
              <span className="ml-1 text-white/45">views</span>
            </span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-5">
        <a href="#board" className="hidden text-sm text-white/60 hover:text-white sm:block">
          All hours
        </a>
        <a href="#how-it-works" className="hidden text-sm text-white/60 hover:text-white sm:block">
          How it works
        </a>
        <button
          type="button"
          onClick={onBid}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Bid Now
        </button>
      </div>
    </nav>
  );
}
