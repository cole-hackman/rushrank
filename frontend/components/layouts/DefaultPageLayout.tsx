"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Vote } from "lucide-react";
import ProfileDropdown from "@/components/ProfileDropdown";
import { cn } from "@/lib/utils";

interface DefaultPageLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  {
    href: "/" as const,
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/pnms" as const,
    label: "PNMs",
    icon: Users,
  },
  {
    href: "/voting" as const,
    label: "Voting",
    icon: Vote,
  },
];

export function DefaultPageLayout({ children }: DefaultPageLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* Topbar */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex h-16 items-center px-6">
          {/* Logo/Brand */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-xl font-bold text-[#162238] dark:text-white"
            >
              RushRank
            </Link>

            {/* Navigation Items */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#162238] text-white dark:bg-white dark:text-[#162238]"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side - Profile */}
          <div className="ml-auto flex items-center gap-4">
            <ProfileDropdown />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex md:hidden items-center gap-1 border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[#162238] text-white dark:bg-white dark:text-[#162238]"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

