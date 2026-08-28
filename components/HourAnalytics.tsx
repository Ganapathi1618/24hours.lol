'use client';

import { useEffect, useState } from 'react';

import { formatHourRange } from '@/lib/hours';
import type { AudienceInsights } from '@/lib/datafast';

type State =
  | { status: 'loading' }
  | { status: 'ready'; insights: AudienceInsights }
  | { status: 'error' };

function compact(value: number): string {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="tabular mt-0.5 font-mono text-lg font-bold">{value}</p>
    </div>
  );
}

/**
 * Real audience data for the slot being bid on. Every block renders only when
 * Datafast actually returned that figure — nothing here is estimated.
 */
export function HourAnalytics({ hourNumber }: { hourNumber: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/analytics', { cache: 'no-store' });
        if (!response.ok) throw new Error(`analytics ${response.status}`);
        const insights = (await response.json()) as AudienceInsights;
        if (!cancelled) setState({ status: 'ready', insights });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="mt-5 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="mt-5 rounded border border-neutral-200 px-3 py-3 text-xs text-neutral-400">
        Audience data is unavailable right now.
      </p>
    );
  }

  const { insights } = state;
  const hourly = insights.hourly;
  const peak = hourly ? Math.max(...hourly.map((point) => point.pageviews), 1) : 1;
  const thisHour = hourly?.find((point) => point.hour === hourNumber) ?? null;

  const hasMetrics =
    insights.monthlyPageviews !== null ||
    insights.dailyAveragePageviews !== null ||
    insights.live !== null ||
    insights.monthlyVisitors !== null;

  if (!hasMetrics && !hourly && !insights.topCountries) {
    return (
      <p className="mt-5 rounded border border-neutral-200 px-3 py-3 text-xs text-neutral-400">
        Audience data is unavailable right now.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
        Audience · last 30 days
      </h3>

      {hasMetrics && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {insights.monthlyPageviews !== null && (
            <Metric label="Monthly impressions" value={compact(insights.monthlyPageviews)} />
          )}
          {insights.dailyAveragePageviews !== null && (
            <Metric label="Daily average" value={compact(insights.dailyAveragePageviews)} />
          )}
          {insights.monthlyVisitors !== null && (
            <Metric label="Monthly visitors" value={compact(insights.monthlyVisitors)} />
          )}
          {insights.live !== null && <Metric label="Live right now" value={String(insights.live)} />}
        </div>
      )}

      {hourly && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              Traffic by hour (UTC)
            </p>
            {thisHour && (
              <p className="tabular font-mono text-[10px] text-neutral-400">
                {formatHourRange(hourNumber)}: {compact(thisHour.pageviews)}
              </p>
            )}
          </div>
          <div className="mt-2 flex h-16 items-end gap-[2px]" role="img"
               aria-label={`Traffic by UTC hour; ${formatHourRange(hourNumber)} highlighted`}>
            {hourly.map((point) => (
              <span
                key={point.hour}
                title={`${String(point.hour).padStart(2, '0')}:00 — ${point.pageviews.toLocaleString('en-US')}`}
                style={{ height: `${Math.max(4, (point.pageviews / peak) * 100)}%` }}
                className={`flex-1 rounded-sm ${
                  point.hour === hourNumber ? 'bg-accent' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {insights.topCountries && insights.topCountries.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Top countries
          </p>
          <ul className="mt-1.5 space-y-1">
            {insights.topCountries.map((country) => (
              <li key={country.name} className="flex justify-between text-xs">
                <span className="text-neutral-600">{country.name}</span>
                <span className="tabular font-mono text-neutral-400">
                  {compact(country.visitors)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
