import 'server-only';

import crypto from 'node:crypto';

/** Reject anything older than this to blunt replay attempts. */
const TOLERANCE_SECONDS = 5 * 60;

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  // Standard Webhooks secrets are base64 after the prefix. If it is not valid
  // base64 the round-trip will not match, and we fall back to the raw bytes.
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length > 0 && decoded.toString('base64').replace(/=+$/, '') === raw.replace(/=+$/, '')) {
    return decoded;
  }
  return Buffer.from(raw, 'utf8');
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Standard Webhooks signature (the scheme Dodo Payments uses).
 *
 * The signed content is `${id}.${timestamp}.${body}`, HMAC-SHA256 with the
 * decoded secret, base64 encoded. The header may carry several
 * space-separated `v1,<signature>` pairs during a secret rotation.
 */
export function verifyWebhookSignature(options: {
  secret: string;
  body: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { secret, body, webhookId, webhookTimestamp, webhookSignature } = options;

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { ok: false, reason: 'Missing webhook signature headers.' };
  }

  const timestamp = Number.parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'Invalid webhook timestamp.' };
  }
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'Webhook timestamp outside tolerance.' };
  }

  const expected = crypto
    .createHmac('sha256', decodeSecret(secret))
    .update(`${webhookId}.${webhookTimestamp}.${body}`, 'utf8')
    .digest('base64');

  const provided = webhookSignature
    .split(' ')
    .map((part) => {
      const [version, value] = part.split(',');
      return version === 'v1' && value ? value : null;
    })
    .filter((value): value is string => value !== null);

  if (provided.length === 0) {
    return { ok: false, reason: 'No v1 signature present.' };
  }
  if (!provided.some((candidate) => timingSafeEqual(candidate, expected))) {
    return { ok: false, reason: 'Signature mismatch.' };
  }
  return { ok: true };
}
