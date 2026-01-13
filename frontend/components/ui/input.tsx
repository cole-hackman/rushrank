import React from "react";
import cn from "classnames";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  const base =
    "w-full rounded-lg border border-beta-gray/70 bg-white px-3 py-2 text-sm text-beta-navy placeholder:text-beta-gray focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-1";
  return <input className={cn(base, className)} {...props} />;
}
