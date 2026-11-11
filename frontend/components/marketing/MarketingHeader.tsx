"use client";

/**
 * The landing page had a footer and no header, which meant there was no way to
 * sign in from it. An existing user arriving at rushrank.app had to know to type
 * /login. That is a strange thing for a returning customer to have to work out.
 */

import Link from "next/link";
import Image from "next/image";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 touch:min-h-[44px]">
          {/* Decorative on purpose: the word "RushRank" beside it already names
              the link. alt="RushRank" would make screen readers say it twice. */}
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
          <span className="text-lg font-semibold text-fg">RushRank</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-fg hover:bg-surface-muted touch:min-h-[44px]"
          >
            Sign in
          </Link>
          <Link
            href="/get-started"
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground touch:min-h-[44px]"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
