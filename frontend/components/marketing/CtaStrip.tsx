import Link from "next/link";

export function CtaStrip() {
  return (
    <section className="border-t border-border bg-bg py-24">
      <div className="mx-auto max-w-[1180px] px-6 text-center">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">
          Free during pilot. Ready when you are.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Stand up your chapter on RushRank in under two minutes. No card required.
        </p>
        <Link
          href="/get-started"
          className="mt-10 inline-block rounded-full bg-accent px-8 py-3 text-base font-medium text-accent-foreground"
        >
          Get started free
        </Link>
      </div>
    </section>
  );
}
