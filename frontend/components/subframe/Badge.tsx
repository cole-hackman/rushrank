import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "neutral" | "success" | "warning" | "error";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "default", icon, children, className }: BadgeProps) {
  const variantClasses = {
    default: "bg-beta-navy/10 text-beta-navy dark:bg-beta-navy/20 dark:text-blue-300",
    neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

