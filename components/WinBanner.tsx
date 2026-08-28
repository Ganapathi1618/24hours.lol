'use client';

import { formatHour12, formatMoney } from '@/lib/hours';
import { publicEnv } from '@/lib/public-env';
import type { HourSlot } from '@/lib/types';

interface Props {
  hourNumber: number;
  slot: HourSlot | null;
  confirmed: boolean;
  onDismiss: () => void;
}

/**
 * Shown after returning from Dodo. Settlement happens in the webhook, so the
 * hour is only announced as won once the board actually shows it claimed.
 */
export function WinBanner({ hourNumber, slot, confirmed, onDismiss }: Props) {
  const label = formatHour12(hourNumber);

  if (!confirmed || !slot) {
    return (
      <div role="status" className="bg-money px-4 py-2.5 text-center text-sm font-medium text-white">
        Payment received — confirming your bid for {label}. This takes a moment.
      </div>
    );
  }

  const tweet = `I just won ${label} on 24hrs.lol for ${formatMoney(slot.current_bid)}. My brand owns that hour for ${slot.campaign_days} days. 👀`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(publicEnv.siteUrl)}`;

  return (
    <div className="bg-ink px-5 py-6 text-center text-white">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-money">Confirmed</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        🏆 YOU OWN {label.toUpperCase()}
      </h2>
      <p className="mt-1.5 text-sm text-white/60">
        {slot.brand_name} runs at {label} for the next {slot.campaign_days} days.
      </p>

      <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded bg-accent px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
        >
          Share on X →
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded px-6 py-2.5 text-sm text-white/50 transition-colors hover:text-white sm:w-auto"
        >
          Dismiss
        </button>
      </div>

      <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-white/30">
        If a higher bid landed while your payment settled, we refunded you in full and emailed
        the details.
      </p>
    </div>
  );
}
