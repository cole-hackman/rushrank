import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  size?: "small" | "medium" | "large";
  variant?: "default" | "inverse";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export function IconButton({
  icon,
  size = "medium",
  variant = "default",
  disabled,
  onClick,
  className,
}: IconButtonProps) {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-10 h-10",
    large: "w-12 h-12",
  };

  const variantClasses = {
    default: "bg-transparent hover:bg-beta-navy/5 text-beta-navy dark:text-white",
    inverse: "bg-white/20 hover:bg-white/30 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-beta-navy disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {icon}
    </button>
  );
}

