"use client";

import Link from "next/link";

// Every link here goes somewhere real. The previous footer had six `href="#"`
// links (including Pricing, About, Blog and Contact pages that do not exist),
// and its hover colour was white on the cream background.
const PRODUCT_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#demo", label: "See it work" },
  { href: "/demo", label: "Try the demo" },
];

const ACCOUNT_LINKS = [
  { href: "/get-started", label: "Get started" },
  { href: "/login", label: "Sign in" },
];

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="font-semibold text-fg">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="transition hover:text-fg hover:underline touch:inline-flex touch:min-h-[44px] touch:items-center"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg py-8">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold text-fg">RushRank</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Modern rush management for fraternities.
            </p>
          </div>
          <FooterLinks title="Product" links={PRODUCT_LINKS} />
          <FooterLinks title="Your chapter" links={ACCOUNT_LINKS} />
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {currentYear} RushRank. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
