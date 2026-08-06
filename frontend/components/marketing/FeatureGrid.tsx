const FEATURES = [
  { title: "Live voting sessions", body: "Real-time websocket sync. The chair drives the pace, everyone sees the same PNM." },
  { title: "PNM dossiers", body: "Photo, GPA, hometown, tags, votes, and every chapter note in one place." },
  { title: "Round management", body: "Standardize round-by-round decisions with explicit cutoffs and audit trails." },
  { title: "Chapter analytics", body: "Distributions, vote drift, attendance — answer the questions before exec asks them." },
  { title: "Multi-tenant security", body: "Postgres row-level security. Your chapter's data never crosses lines." },
  { title: "Slideshow export", body: "One click and you've got a slide deck ready for chapter.", isNew: true },
];

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border bg-bg py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">Everything rush needs. Nothing it doesn&apos;t.</h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-xl text-fg">{f.title}</h3>
                {f.isNew && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-foreground">New</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
