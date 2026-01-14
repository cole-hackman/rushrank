"use client";
import { cn } from "@/lib/utils";

interface SkeletonTableProps {
    rows?: number;
    columns?: number;
    className?: string;
    showCheckbox?: boolean;
}

export function SkeletonTable({
    rows = 8,
    columns = 6,
    className,
    showCheckbox = true,
}: SkeletonTableProps) {
    return (
        <div className={cn("w-full", className)}>
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-neutral-border px-4 py-3 bg-neutral-50 dark:bg-neutral-800">
                {showCheckbox && (
                    <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                )}
                {Array.from({ length: columns }).map((_, i) => (
                    <div
                        key={i}
                        className="h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                        style={{ width: `${80 + Math.random() * 60}px` }}
                    />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div
                    key={rowIdx}
                    className="flex items-center gap-4 border-b border-neutral-border px-4 py-4"
                >
                    {showCheckbox && (
                        <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                    )}
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <div
                            key={colIdx}
                            className="h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                            style={{
                                width: colIdx === 0 ? "160px" : `${60 + Math.random() * 80}px`,
                                animationDelay: `${(rowIdx * columns + colIdx) * 50}ms`,
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

interface SkeletonCardProps {
    className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-xl border border-neutral-border bg-white dark:bg-neutral-800 p-5",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
                <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
    );
}

interface SkeletonRowProps {
    columns?: number;
    showCheckbox?: boolean;
    showAvatar?: boolean;
}

export function SkeletonRow({
    columns = 6,
    showCheckbox = true,
    showAvatar = true,
}: SkeletonRowProps) {
    return (
        <div className="flex items-center gap-4 px-4 py-4 border-b border-neutral-border">
            {showCheckbox && (
                <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            )}
            {showAvatar && (
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
            )}
            {Array.from({ length: columns }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                    style={{ width: `${60 + Math.random() * 80}px` }}
                />
            ))}
        </div>
    );
}
