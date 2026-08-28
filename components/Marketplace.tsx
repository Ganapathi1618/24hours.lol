'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { Headline } from './Headline';
import { Hero } from './Hero';
import { HourBoard } from './HourBoard';
import { HourModal } from './HourModal';
import { HowItWorks } from './HowItWorks';
import { NextHoursStrip } from './NextHoursStrip';
import { WinBanner } from './WinBanner';
import { isValidHourNumber } from '@/lib/hours';
import { getBrowserClient } from '@/lib/supabase/browser';
import type { HourSlot, HoursResponse } from '@/lib/types';

interface Props {
  initialHours: HourSlot[] | null;
  serverTime: string;
}

const POLL_INTERVAL_MS = 60_000;
/** How long to keep re-checking the board for a webhook to land after payment. */
const WIN_CONFIRM_DELAYS_MS = [2000, 5000, 10_000, 20_000];

export function Marketplace({ initialHours, serverTime }: Props) {
  const [now, setNow] = useState<Date>(() => new Date(serverTime));
  const [hours, setHours] = useState<HourSlot[] | null>(initialHours);
  const [loadFailed, setLoadFailed] = useState(initialHours === null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [wonHour, setWonHour] = useState<number | null>(null);

  const currentHour = now.getUTCHours();
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const response = await fetch('/api/hours', { cache: 'no-store' });
      if (!response.ok) throw new Error(`hours ${response.status}`);
      const data = (await response.json()) as HoursResponse;
      setHours(data.hours);
      setLoadFailed(false);
    } catch (error) {
      console.error('[marketplace] refresh failed', error);
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // The clock.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Realtime: any write to `hours` re-reads the board for every open tab.
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel('hours-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hours' }, () => {
        void refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Safety net for a dropped socket or a tab that slept.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  // A new hour going on air changes who is featured.
  useEffect(() => {
    void refresh();
  }, [currentHour, refresh]);

  // Returning from Dodo: settlement is a webhook, so poll until the board agrees.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true') return;

    const paidHour = Number.parseInt(params.get('hour') ?? '', 10);
    setWonHour(isValidHourNumber(paidHour) ? paidHour : null);
    window.history.replaceState({}, '', window.location.pathname);

    const timers = WIN_CONFIRM_DELAYS_MS.map((delay) =>
      setTimeout(() => void refresh(), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [refresh]);

  const featured = useMemo(
    () => hours?.find((slot) => slot.hour_number === currentHour) ?? null,
    [hours, currentHour],
  );

  const selectedSlot = useMemo(
    () =>
      selectedHour === null ? null : hours?.find((s) => s.hour_number === selectedHour) ?? null,
    [hours, selectedHour],
  );

  const wonSlot = useMemo(
    () => (wonHour === null ? null : hours?.find((s) => s.hour_number === wonHour) ?? null),
    [hours, wonHour],
  );

  return (
    <>
      {wonHour !== null && (
        <WinBanner
          hourNumber={wonHour}
          slot={wonSlot}
          confirmed={Boolean(wonSlot?.claimed)}
          onDismiss={() => setWonHour(null)}
        />
      )}

      <Hero now={now} currentHour={currentHour} slot={featured} onBid={setSelectedHour} />

      <Headline />

      {hours && (
        <ErrorBoundary fallback={null}>
          <NextHoursStrip hours={hours} currentHour={currentHour} onBid={setSelectedHour} />
        </ErrorBoundary>
      )}

      <section id="board" className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <header className="mb-6 px-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">The 24 hour board</h2>
          <p className="mt-1.5 text-neutral-500">
            Highest bid owns that hour. Updated live.
          </p>
        </header>

        {hours ? (
          <ErrorBoundary
            fallback={
              <p className="px-1 py-8 text-sm text-neutral-500">
                The board could not be displayed. Refresh to try again.
              </p>
            }
          >
            <HourBoard hours={hours} currentHour={currentHour} onBid={setSelectedHour} />
          </ErrorBoundary>
        ) : loadFailed ? (
          <div className="rounded border border-neutral-200 px-4 py-10 text-center">
            <p className="font-medium">The board is temporarily unavailable.</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {Array.from({ length: 24 }, (_, index) => (
              <li key={index} className="flex items-center gap-4 px-4 py-4">
                <span className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
                <span className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
                <span className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 px-1 text-xs text-neutral-400">
          Slots run on UTC. Your brand shows on the homepage clock for that hour, every day, for
          the length of your campaign.
        </p>
      </section>

      <HowItWorks />

      {selectedSlot && <HourModal slot={selectedSlot} onClose={() => setSelectedHour(null)} />}
    </>
  );
}
