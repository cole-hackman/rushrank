const STEPS = [
  { n: "01", title: "Create your chapter", body: "Two minutes. Fraternity name, school, admin email." },
  { n: "02", title: "Import your PNMs", body: "CSV upload or one-by-one. Photos optional but recommended." },
  { n: "03", title: "Run rush", body: "Open a session, swipe through PNMs, export the deck." },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-surface-muted/40 py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">How it works.</h2>
        <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="border-t-2 border-accent pt-6">
              <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
              <h3 className="mt-2 font-serif text-2xl text-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
