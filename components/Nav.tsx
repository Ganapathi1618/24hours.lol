'use client';

interface Props {
  onBid: () => void;
}

export function Nav({ onBid }: Props) {
  return (
    <nav className="flex w-full items-center justify-between px-5 py-5 sm:px-8">
      <a href="#top" className="font-mono text-sm font-bold tracking-tight text-white">
        24HRS<span className="text-white/40">.LOL</span>
      </a>

      <div className="flex items-center gap-5">
        <a
          href="#board"
          className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block"
        >
          All hours
        </a>
        <a
          href="#how-it-works"
          className="hidden text-sm text-white/60 transition-colors hover:text-white sm:block"
        >
          How it works
        </a>
        <button
          type="button"
          onClick={onBid}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Bid Now
        </button>
      </div>
    </nav>
  );
}
