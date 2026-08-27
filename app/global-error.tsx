'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[root] unhandled error', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          minHeight: '100svh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>24hrs.lol hit an error.</h1>
        <button
          type="button"
          onClick={reset}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 0,
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
