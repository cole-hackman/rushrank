import React from "react";
import cn from "classnames";

type Variant =
  | "primary"
  | "default"
  | "outline"
  | "ghost"
  | "secondary"
  | "neutral-secondary"
  | "neutral-tertiary"
  | "destructive"
  | "destructive-secondary";

type Size = "sm" | "md" | "lg" | "icon";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses: Record<Variant, string> = {
    primary: "bg-beta-navy text-white hover:bg-beta-navy/90",
    default: "bg-beta-navy text-white hover:bg-beta-navy/90",
    outline:
      "border border-beta-gray/60 text-beta-navy bg-white hover:bg-beta-navy/5",
    ghost: "text-beta-navy hover:bg-beta-navy/10",
    secondary:
      "bg-white border border-beta-gray/60 text-beta-navy hover:bg-beta-navy/5",
    "neutral-secondary":
      "bg-white border border-beta-gray/60 text-beta-navy hover:bg-beta-navy/5",
    "neutral-tertiary": "bg-transparent text-beta-navy hover:bg-beta-navy/10",
    destructive:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus:ring-offset-2",
    "destructive-secondary":
      "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 focus:ring-red-500 focus:ring-offset-2",
  };

  const sizeClasses: Record<Size, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
