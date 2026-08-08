import Image from "next/image";
import { DEMO_PNMS } from "@/lib/demo-data";

export function PnmCardShowcase() {
  const cards = DEMO_PNMS.slice(0, 3);
  return (
    <section className="border-t border-border bg-surface-muted/40 py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">Every PNM, fully knowable.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Notes, votes, tags, and conversation history live in one dossier so chapter
          decisions are made on signal, not memory.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map((p, i) => (
            <div
              key={p.id}
              className="rounded-3xl border border-border bg-surface p-6 transition-transform hover:-translate-y-1"
              style={{ transform: `rotate(${(i - 1) * 1.5}deg)` }}
            >
              <div className="relative h-[240px] w-full overflow-hidden rounded-2xl bg-surface-muted">
                <Image src={p.photo} alt={p.name} fill className="object-cover" />
              </div>
              <div className="mt-4">
                <div className="font-serif text-xl text-fg">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.year} · {p.major} · GPA {p.gpa.toFixed(2)}</div>
              </div>
              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bids / Passes / Stars</dt>
                  <dd className="font-mono text-fg">
                    {p.voteSummary.up} / {p.voteSummary.down} / {p.voteSummary.star}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="font-mono text-fg">{p.noteCount}</dd>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text">
                      {t}
                    </span>
                  ))}
                </div>
              </dl>
              {p.latestNote && (
                <blockquote className="mt-4 border-l-2 border-accent pl-3 text-sm italic text-muted-foreground">
                  &ldquo;{p.latestNote.text}&rdquo;
                  <div className="mt-1 text-xs not-italic">— {p.latestNote.author}</div>
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
