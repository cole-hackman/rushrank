import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IconWithBackgroundProps {
  icon?: ReactNode;
  variant?: "default" | "neutral" | "success" | "warning" | "error";
  size?: "small" | "medium" | "large";
  className?: string;
}

export function IconWithBackground({
  icon,
  variant = "default",
  size = "medium",
  className,
}: IconWithBackgroundProps) {
  const variantClasses = {
    default: "bg-beta-navy/10 text-beta-navy",
    neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-10 h-10",
    large: "w-12 h-12",
  };

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center flex-shrink-0",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {icon}
    </div>
  );
}

