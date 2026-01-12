import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ButtonProps {
  variant?: "default" | "neutral-secondary" | "neutral-tertiary" | "destructive-secondary";
  size?: "small" | "medium" | "large";
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "default",
  size = "medium",
  icon,
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: ButtonProps) {
  const variantClasses = {
    default: "bg-beta-navy text-white hover:bg-beta-navy/90",
    "neutral-secondary": "bg-white border border-beta-gray/50 text-beta-navy hover:bg-beta-navy/5",
    "neutral-tertiary": "bg-transparent text-beta-navy hover:bg-beta-navy/5",
    "destructive-secondary": "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100",
  };

  const sizeClasses = {
    small: "px-3 py-1.5 text-sm",
    medium: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

