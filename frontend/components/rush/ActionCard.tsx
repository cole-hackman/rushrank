"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  variant: "primary" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export function ActionCard({
  title,
  subtitle,
  icon,
  variant,
  onClick,
  disabled = false,
  testId,
}: ActionCardProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "grid grid-cols-[72px_1fr_24px] gap-4 items-center",
        "p-5 rounded-xl border-2",
        "min-h-[160px] md:min-h-[124px]",
        "transition-all shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        "active:scale-[0.99]",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer",
        // Primary variant styling
        isPrimary && !disabled
          ? "bg-[#013068]/5 dark:bg-[#013068]/10 border-[#013068]/25 dark:border-[#013068]/30 hover:bg-[#013068]/10 dark:hover:bg-[#013068]/15 hover:border-[#013068]/35"
          : isPrimary && disabled
          ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
          : null,
        // Secondary variant styling
        !isPrimary && !disabled
          ? "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300"
          : !isPrimary && disabled
          ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
          : null
      )}
    >
      {/* Icon circle */}
      <div
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0",
          isPrimary && !disabled
            ? "bg-[#013068]/10 dark:bg-[#013068]/20"
            : isPrimary && disabled
            ? "bg-neutral-200 dark:bg-neutral-700"
            : !isPrimary && !disabled
            ? "bg-neutral-100 dark:bg-neutral-700"
            : "bg-neutral-200 dark:bg-neutral-700"
        )}
      >
        <div
          className={cn(
            isPrimary && !disabled
              ? "text-[#013068] dark:text-[#013068]"
              : isPrimary && disabled
              ? "text-neutral-400"
              : !isPrimary && !disabled
              ? "text-neutral-600 dark:text-neutral-300"
              : "text-neutral-400"
          )}
        >
          {icon}
        </div>
      </div>

      {/* Text stack */}
      <div className="flex flex-col gap-1 text-left min-w-0">
        <h3
          className={cn(
            "text-[22px] font-semibold leading-[1.1]",
            disabled
              ? "text-neutral-400"
              : isPrimary
              ? "text-[#013068] dark:text-[#013068]"
              : "text-default-font"
          )}
        >
          {title}
        </h3>
        <p className="text-[15px] text-subtext-color leading-[1.3]">
          {subtitle}
        </p>
      </div>

      {/* Chevron indicator */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <ChevronRight
          className={cn(
            "h-6 w-6",
            disabled
              ? "text-neutral-400"
              : "text-subtext-color"
          )}
        />
      </div>
    </button>
  );
}
