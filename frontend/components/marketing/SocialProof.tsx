// Kept free of chapter names and dates. A pilot sentence that named a chapter
// and promised "Fall 2026" went stale the moment that term started, and the
// brand references were removed from the UI deliberately (d9c5592).
export function SocialProof() {
  return (
    <section className="border-t border-border bg-bg py-16">
      <div className="mx-auto max-w-[1180px] px-6">
        <p className="text-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Built in a real rush
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground">
          <p className="mx-auto max-w-2xl text-center font-serif text-lg leading-relaxed opacity-70">
            RushRank was built alongside a fraternity chapter running its own recruitment, and
            any chapter can set up its own account today.
          </p>
        </div>
      </div>
    </section>
  );
}
