'use client';

import { useState } from 'react';

const PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2'] as const;

/** Stable colour per brand, so a logo-less advertiser looks the same every hour. */
function colourFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

interface Props {
  name: string;
  logoUrl: string | null;
  size?: number;
}

/** Brand logo, falling back to an initial when there is none or it fails to load. */
export function BrandMark({ name, logoUrl, size = 56 }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: colourFor(name),
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}
