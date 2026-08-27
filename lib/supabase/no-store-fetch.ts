import 'server-only';

/**
 * Next.js caches `fetch` in server contexts by default, and supabase-js issues
 * its queries through that same global. Without this the board would happily
 * serve a snapshot of the auction from minutes ago. Every server-side Supabase
 * call opts out of the data cache explicitly.
 */
export const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });
