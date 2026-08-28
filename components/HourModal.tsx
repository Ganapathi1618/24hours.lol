'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Countdown } from './Countdown';
import { HourAnalytics } from './HourAnalytics';
import { formatHourRange, formatMoney } from '@/lib/hours';
import { MAX_BID, MAX_BRAND_NAME_LENGTH, MAX_TAGLINE_LENGTH } from '@/lib/validation';
import type { HourSlot } from '@/lib/types';

interface Props {
  slot: HourSlot;
  onClose: () => void;
}

interface CheckoutResponse {
  url?: string;
  error?: string;
}

export function HourModal({ slot, onClose }: Props) {
  const fieldId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState<string>(String(slot.min_bid));
  const [email, setEmail] = useState('');
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = formatHourRange(slot.hour_number);

  // Held in a ref so a caller passing a fresh closure each render cannot
  // re-run the effects below.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus the amount once, when the modal opens. This MUST NOT depend on
  // anything that changes while the modal is open: the page re-renders every
  // second from the clock, and re-running this would pull the caret out of
  // whichever field the bidder is typing in.
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function step(delta: number) {
    const parsed = Number.parseInt(amount, 10);
    const base = Number.isFinite(parsed) ? parsed : slot.min_bid;
    setAmount(String(Math.min(MAX_BID, Math.max(slot.min_bid, base + delta))));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount < slot.min_bid) {
      setError(`Bid at least ${formatMoney(slot.min_bid)} to win this hour.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/bid/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_number: slot.hour_number,
          bid_amount: parsedAmount,
          bidder_email: email,
          brand_name: brandName,
          brand_tagline: tagline,
          brand_url: url,
          brand_logo_url: logoUrl,
        }),
      });

      const data = (await response.json()) as CheckoutResponse;
      if (!response.ok || !data.url) {
        setError(data.error ?? 'Could not start checkout. Try again.');
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  const labelClass = 'block text-xs font-medium uppercase tracking-wider text-neutral-500';
  const inputClass =
    'mt-1.5 w-full rounded border border-neutral-300 px-3 py-2.5 text-base outline-none transition-colors focus:border-accent';

  // Stacking is explicit so nothing can sit over the form fields: the wrapper
  // itself is inert (pointer-events-none) and only the backdrop and the dialog
  // opt back in. The dialog also sits on its own layer above the backdrop.
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      {/* The backdrop owns the click-outside-to-close behaviour. */}
      <div
        className="pointer-events-auto absolute inset-0 z-0 animate-fade-in bg-black/50"
        aria-hidden
        onMouseDown={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="pointer-events-auto relative z-10 max-h-[92svh] w-full animate-slide-up overflow-y-auto rounded-t-lg bg-white p-5 sm:max-w-md sm:animate-fade-in sm:rounded-lg sm:p-6"
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 id={`${fieldId}-title`} className="font-mono text-lg font-bold">
              {range}
              <span className="ml-1.5 text-xs font-medium text-neutral-400">UTC</span>
            </h2>
            {slot.bid_count > 0 ? (
              <>
                <p className="tabular mt-2 font-mono text-3xl font-bold text-money">
                  {formatMoney(slot.current_bid)}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Bid {formatMoney(slot.min_bid)} or more to win this hour
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                No bids yet — be the first for {formatMoney(slot.min_bid)}
              </p>
            )}
            {slot.auction_end_time && (
              <Countdown
                endsAt={slot.auction_end_time}
                className="mt-1 block font-mono text-xs text-livered"
              />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded p-2 text-xl leading-none text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <HourAnalytics hourNumber={slot.hour_number} />

        <p className="mt-5 rounded border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
          Winner gets this hour for {slot.campaign_days} days.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          <div className="space-y-4">
            <div>
              <label htmlFor={`${fieldId}-amount`} className={labelClass}>
                Your bid
              </label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Decrease bid"
                  className="w-12 shrink-0 rounded border border-neutral-300 text-lg font-medium transition-colors hover:bg-neutral-50 disabled:opacity-40"
                  disabled={Number.parseInt(amount, 10) <= slot.min_bid}
                >
                  −
                </button>
                <input
                  ref={amountRef}
                  id={`${fieldId}-amount`}
                  name="bid_amount"
                  type="number"
                  inputMode="numeric"
                  min={slot.min_bid}
                  max={MAX_BID}
                  step={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  onBlur={() => {
                    const parsed = Number.parseInt(amount, 10);
                    if (!Number.isFinite(parsed) || parsed < slot.min_bid) {
                      setAmount(String(slot.min_bid));
                    }
                  }}
                  className="tabular w-full rounded border border-neutral-300 px-3 py-2.5 text-center font-mono text-xl font-bold outline-none transition-colors focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Increase bid"
                  className="w-12 shrink-0 rounded border border-neutral-300 text-lg font-medium transition-colors hover:bg-neutral-50"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label htmlFor={`${fieldId}-email`} className={labelClass}>
                Email
              </label>
              <input
                id={`${fieldId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-brand`} className={labelClass}>
                Brand name
              </label>
              <input
                id={`${fieldId}-brand`}
                name="brand_name"
                type="text"
                required
                maxLength={MAX_BRAND_NAME_LENGTH}
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="Acme"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`${fieldId}-tagline`} className={labelClass}>
                  Tagline
                </label>
                <span className="tabular font-mono text-xs text-neutral-400">
                  {tagline.length}/{MAX_TAGLINE_LENGTH}
                </span>
              </div>
              <input
                id={`${fieldId}-tagline`}
                name="brand_tagline"
                type="text"
                required
                maxLength={MAX_TAGLINE_LENGTH}
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="The fastest way to ship"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-url`} className={labelClass}>
                Website
              </label>
              <input
                id={`${fieldId}-url`}
                name="brand_url"
                type="url"
                inputMode="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://acme.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-logo`} className={labelClass}>
                Logo URL <span className="normal-case text-neutral-400">(optional)</span>
              </label>
              <input
                id={`${fieldId}-logo`}
                name="brand_logo_url"
                type="url"
                inputMode="url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://acme.com/logo.png"
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-livered">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded bg-accent px-6 py-3.5 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Starting checkout…' : 'Place Bid →'}
          </button>

          <p className="mt-3 text-center text-xs text-neutral-400">
            You&apos;ll be charged exactly your bid. Outbid notifications sent by email.
          </p>
        </form>
      </div>
    </div>
  );
}
