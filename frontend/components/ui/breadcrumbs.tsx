import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CrumbProps = { children: ReactNode; href?: string; active?: boolean };

function Item({ children, href, active }: CrumbProps) {
  if (href && !active) {
    return (
      <Link href={href} className="text-sm font-medium text-beta-navy hover:underline">
        {children}
      </Link>
    );
  }
  return (
    <span
      className={cn(
        "text-sm font-medium",
        active ? "text-beta-navy" : "text-beta-gray"
      )}
    >
      {children}
    </span>
  );
}

function Divider() {
  return <span className="text-beta-gray">/</span>;
}

export const Breadcrumbs = Object.assign(
  function Breadcrumbs({ children }: { children: ReactNode }) {
    return <div className="flex items-center gap-2">{children}</div>;
  },
  { Item, Divider }
);
