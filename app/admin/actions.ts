'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { ADMIN_COOKIE, isPasswordCorrect, sessionToken } from './auth';

export async function signIn(_previous: string | null, formData: FormData): Promise<string | null> {
  if (!env.adminPassword) return 'Admin access is not configured.';

  if (!rateLimit(`admin:${clientIp(headers())}`, 5, 60_000)) {
    return 'Too many attempts. Wait a minute.';
  }

  const password = String(formData.get('password') ?? '');
  if (!isPasswordCorrect(password)) return 'Incorrect password.';

  cookies().set(ADMIN_COOKIE, sessionToken(env.adminPassword), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 60 * 60 * 8,
  });
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
  redirect('/admin');
}
