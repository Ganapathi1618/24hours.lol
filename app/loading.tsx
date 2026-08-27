export default function Loading() {
  return (
    <main>
      <section className="flex min-h-[100svh] flex-col items-center justify-center bg-ink px-5 sm:min-h-0 sm:py-16">
        <div className="h-14 w-64 animate-pulse rounded bg-white/10 sm:h-24 sm:w-[28rem]" />
      </section>
      <section className="mx-auto w-full max-w-3xl px-4 py-14">
        <div className="mb-8 h-9 w-80 max-w-full animate-pulse rounded bg-neutral-100" />
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {Array.from({ length: 12 }, (_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-4">
              <span className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
              <span className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
              <span className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
