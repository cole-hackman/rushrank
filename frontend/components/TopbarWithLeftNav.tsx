"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TopbarWithLeftNavProps {
  leftSlot: React.ReactNode;
  rightSlot: React.ReactNode;
  children?: React.ReactNode;
}

export function TopbarWithLeftNav({ leftSlot, rightSlot, children }: TopbarWithLeftNavProps) {
  return (
    <div className="flex h-screen w-full flex-col items-center">
      <div className="flex w-full items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900 z-50">
        <div className="flex items-center gap-6">{leftSlot}</div>
        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto bg-beta-surface dark:bg-neutral-900">
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface NavItemProps {
  selected?: boolean;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

TopbarWithLeftNav.NavItem = function NavItem({ selected, children, href, onClick }: NavItemProps) {
  const pathname = usePathname();
  const isActive = selected || (href && pathname === href);

  const className = cn(
    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
    isActive
      ? "bg-beta-navy text-white"
      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
};

