'use client';

import { useEffect, useState } from 'react';

function format(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface Props {
  endsAt: string;
  className?: string;
}

/** Ticking time-left label for hours that have an auction end time set. */
export function Countdown({ endsAt, className }: Props) {
  const target = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    setRemaining(target - Date.now());
    const timer = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!Number.isFinite(target)) return null;
  if (remaining <= 0) {
    return <span className={className}>Auction closed</span>;
  }
  return (
    <span className={className} suppressHydrationWarning>
      {format(remaining)} left
    </span>
  );
}
