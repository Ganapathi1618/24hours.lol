import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-neutral-400">404</p>
      <h1 className="text-2xl font-bold">This hour does not exist.</h1>
      <Link href="/" className="font-medium text-accent">
        Back to the clock →
      </Link>
    </main>
  );
}
