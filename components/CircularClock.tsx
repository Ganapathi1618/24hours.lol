'use client';

import { useEffect, useState } from 'react';

import { formatHourRange, formatLocalHourRange } from '@/lib/hours';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

interface Props {
  now: Date;
  currentHour: number;
}

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 136;

/**
 * The live clock: a ring with a sweeping second hand and the digital UTC time
 * in the middle. The board runs on UTC, so this reads UTC for every visitor.
 */
export function CircularClock({ now, currentHour }: Props) {
  // Resolved after mount only: the server has no idea what timezone the
  // visitor is in, so rendering this during SSR would mismatch on hydration.
  const [localRange, setLocalRange] = useState<string | null>(null);
  useEffect(() => {
    setLocalRange(formatLocalHourRange(currentHour));
  }, [currentHour]);

  const seconds = now.getUTCSeconds();
  const minutes = now.getUTCMinutes();
  const time = `${pad(now.getUTCHours())}:${pad(minutes)}:${pad(seconds)}`;

  // The ring fills as the hour progresses.
  const circumference = 2 * Math.PI * RADIUS;
  const throughHour = (minutes * 60 + seconds) / 3600;

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <radialGradient id="clock-face" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#clock-face)" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />

        {/* One tick per hour of the day. */}
        {Array.from({ length: 24 }, (_, index) => {
          const angle = (index / 24) * 360 - 90;
          const radians = (angle * Math.PI) / 180;
          const inner = RADIUS - (index % 6 === 0 ? 12 : 6);
          return (
            <line
              key={index}
              x1={CENTER + Math.cos(radians) * inner}
              y1={CENTER + Math.sin(radians) * inner}
              x2={CENTER + Math.cos(radians) * RADIUS}
              y2={CENTER + Math.sin(radians) * RADIUS}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={index % 6 === 0 ? 1.5 : 1}
            />
          );
        })}

        {/* Progress through the current hour. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - throughHour)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          opacity="0.9"
        />

        {/* Sweeping second hand, kept clear of the digits in the middle. */}
        <g transform={`rotate(${seconds * 6} ${CENTER} ${CENTER})`}>
          <line
            x1={CENTER}
            y1={CENTER - RADIUS + 36}
            x2={CENTER}
            y2={CENTER - RADIUS + 10}
            stroke="#dc2626"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="relative z-10 text-center">
        <time
          className="tabular block font-mono text-4xl font-bold leading-none tracking-tight text-white"
          dateTime={now.toISOString()}
          suppressHydrationWarning
        >
          {time}
        </time>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
          UTC · {formatHourRange(currentHour)}
        </p>
        {localRange && (
          <p className="mt-1 font-mono text-[10px] tracking-wider text-white/30">{localRange}</p>
        )}
      </div>
    </div>
  );
}
