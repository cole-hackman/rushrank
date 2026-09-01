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
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
          <span className="text-lg font-semibold text-fg">RushRank</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
          >
            Sign in
          </Link>
          <Link
            href="/get-started"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
