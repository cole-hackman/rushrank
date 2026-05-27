const SCHOOLS = ["Boston College", "UNC Chapel Hill", "Vanderbilt", "USC", "Michigan", "Tulane"];

export function SocialProof() {
  return (
    <section className="border-t border-border bg-bg py-16">
      <div className="mx-auto max-w-[1180px] px-6">
        <p className="text-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by chapters at
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground">
          {SCHOOLS.map((s) => (
            <span key={s} className="font-serif text-lg opacity-70">{s}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
