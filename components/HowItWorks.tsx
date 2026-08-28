const STEPS = [
  {
    title: 'Choose your hour',
    body: 'Pick the time when your audience is most active.',
  },
  {
    title: 'Place your bid',
    body: 'Highest bid wins. Outbid to reclaim.',
  },
  {
    title: 'Own the spotlight',
    body: 'Your brand featured for 30 days during your hour.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="tabular font-mono text-sm font-bold text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
