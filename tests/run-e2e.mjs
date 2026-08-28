/**
 * Boots the production build against the mock PostgREST + Dodo, runs the
 * end-to-end assertions, then tears everything down.
 *
 * Usage: npm run build && npm run test:e2e
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 3100;

if (!existsSync(new URL('../.next', import.meta.url))) {
  console.error('No production build found. Run `npm run build` first.');
  process.exit(1);
}

const testEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  DODO_API_KEY: 'test-dodo-key',
  DODO_BID_PRODUCT_ID: 'prod_test',
  DODO_API_BASE: 'http://127.0.0.1:54321',
  DATAFAST_API_BASE: 'http://127.0.0.1:54321',
  DATAFAST_API_KEY: 'test-datafast-key',
  NEXT_PUBLIC_DATAFAST_WEBSITE_ID: 'dfid_test',
  DODO_WEBHOOK_SECRET: `whsec_${Buffer.from('test-secret-for-24hrs-lol').toString('base64')}`,
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
  CRON_SECRET: 'test-cron-secret',
  ADMIN_PASSWORD: 'test-admin-pw',
};

// A server left over from another run would silently answer these tests with a
// different environment, so refuse to start rather than test the wrong process.
try {
  await fetch(`http://127.0.0.1:${PORT}/`);
  console.error(`Port ${PORT} is already serving. Stop it first: pkill -f next-server`);
  process.exit(1);
} catch {
  /* nothing listening, which is what we want */
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: testEnv,
  detached: true,
  stdio: 'ignore',
});

function shutdown() {
  try {
    process.kill(-server.pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
}
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });

let ready = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/`);
    ready = true;
    break;
  } catch {
    await sleep(500);
  }
}
if (!ready) {
  console.error(`Server never came up on :${PORT}.`);
  shutdown();
  process.exit(1);
}

const tests = spawn('node', ['tests/e2e.test.mjs'], { env: testEnv, stdio: 'inherit' });
tests.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 1);
});
