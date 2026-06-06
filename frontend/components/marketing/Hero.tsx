import Link from "next/link";
import Image from "next/image";
import { DEMO_PNMS } from "@/lib/demo-data";

export function Hero() {
  const fan = DEMO_PNMS.slice(0, 3);
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h1 className="font-serif text-6xl leading-[1.02] tracking-tight text-fg md:text-7xl">
            Rush, ranked.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A modern home for chapter recruitment. Run live voting, manage every PNM dossier,
            and ship a polished slide deck before chapter even ends.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/get-started"
              className="rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-foreground"
            >
              Get started free
            </Link>
            <Link
              href="#demo"
              className="rounded-full border border-fg/15 px-6 py-3 text-base text-fg hover:bg-surface-muted"
            >
              Try the demo
            </Link>
          </div>
        </div>

        <div className="relative h-[480px]">
          {fan.map((p, i) => (
            <div
              key={p.id}
              className="absolute left-1/2 top-6 h-[360px] w-[260px] -translate-x-1/2 rounded-3xl border border-border bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(10,10,10,0.25)]"
              style={{
                transform: `translateX(calc(-50% + ${(i - 1) * 28}px)) rotate(${(i - 1) * 4}deg)`,
                zIndex: 10 - i,
              }}
            >
              <div className="relative h-[230px] w-full overflow-hidden rounded-2xl bg-surface-muted">
                <Image src={p.photo} alt={p.name} fill className="object-cover" />
              </div>
              <div className="mt-3">
                <div className="font-medium text-fg">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.year} · {p.major}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
