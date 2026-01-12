import React from "react";
import cn from "classnames";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "default", size = "md", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
    outline: "border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-300",
    ghost: "text-gray-900 hover:bg-gray-100"
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

