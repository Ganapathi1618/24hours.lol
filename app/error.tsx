'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route] unhandled error', error);
  }, [error]);

  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong.</h1>
      <p className="text-neutral-500">The clock is still running — try loading the board again.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-accent px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
