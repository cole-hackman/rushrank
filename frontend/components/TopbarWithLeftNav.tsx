"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

interface TopbarWithLeftNavProps {
  leftSlot: React.ReactNode;
  rightSlot: React.ReactNode;
  mobileNavItems?: { label: string; href: string }[];
  children?: React.ReactNode;
}

export function TopbarWithLeftNav({ leftSlot, rightSlot, mobileNavItems, children }: TopbarWithLeftNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full flex-col items-center">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900 z-50">
        {/* Mobile: hamburger + logo section */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Mobile menu button */}
          {mobileNavItems && mobileNavItems.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-neutral-700 dark:text-neutral-300" />
              ) : (
                <Menu className="h-6 w-6 text-neutral-700 dark:text-neutral-300" />
              )}
            </button>
          )}
          {leftSlot}
        </div>
        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && mobileNavItems && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 top-[57px] z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed left-0 right-0 top-[57px] z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-lg">
            <nav className="flex flex-col p-2 gap-1 max-h-[70vh] overflow-y-auto">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive
                        ? "bg-beta-navy text-white"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

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
  className?: string;
}

TopbarWithLeftNav.NavItem = function NavItem({ selected, children, href, onClick, className: customClassName }: NavItemProps) {
  const pathname = usePathname();
  const isActive = selected || (href && pathname === href);

  const className = cn(
    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors hidden md:inline-flex",
    isActive
      ? "bg-beta-navy text-white"
      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
    customClassName
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
