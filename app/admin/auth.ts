import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';

export const ADMIN_COOKIE = 'admin_session';

/** The cookie holds a digest of the password, never the password itself. */
export function sessionToken(password: string): string {
  return crypto.createHash('sha256').update(`24hrs.lol:${password}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isPasswordCorrect(candidate: string): boolean {
  if (!env.adminPassword) return false;
  return safeEqual(candidate, env.adminPassword);
}

export function isSignedIn(): boolean {
  if (!env.adminPassword) return false;
  const cookie = cookies().get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, sessionToken(env.adminPassword));
}
