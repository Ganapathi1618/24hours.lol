import 'server-only';

/**
 * Small in-memory limiter to blunt accidental double-submits and casual abuse.
 * It is per-instance by design — the authoritative guard against a bad bid is
 * the database check in the checkout route, not this.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [existingKey, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(existingKey);
    }
  }
  return true;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
