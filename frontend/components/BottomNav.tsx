"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Users, Calendar, Vote } from "lucide-react";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

// Voting sits after PNMs: you look at the candidate, then you vote on him.
// It was previously reachable only through the hamburger, which is a poor place
// for the one screen the whole chapter is on during a live session.
const navItems: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: <Home className="h-5 w-5" /> },
    { label: "Rush", href: "/rush", icon: <ClipboardList className="h-5 w-5" /> },
    { label: "PNMs", href: "/pnms", icon: <Users className="h-5 w-5" /> },
    { label: "Voting", href: "/voting", icon: <Vote className="h-5 w-5" /> },
    { label: "Events", href: "/events", icon: <Calendar className="h-5 w-5" /> },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-around px-2 py-1 safe-area-pb">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                // px-2 rather than px-3: five items have to fit
                                // across a 390px phone without the labels
                                // colliding. The 48px touch target is kept.
                                "flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-2 rounded-xl transition-all duration-200",
                                "active:scale-95",
                                isActive
                                    ? "text-beta-navy dark:text-white"
                                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                                    isActive && "bg-beta-navy/10 dark:bg-white/10"
                                )}
                            >
                                {React.cloneElement(item.icon as React.ReactElement, {
                                    className: cn(
                                        "h-5 w-5 transition-transform duration-200",
                                        isActive && "scale-110"
                                    ),
                                    strokeWidth: isActive ? 2.5 : 2,
                                })}
                            </div>
                            <span
                                className={cn(
                                    "text-xs mt-0.5 font-medium transition-all duration-200",
                                    isActive && "font-semibold"
                                )}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
