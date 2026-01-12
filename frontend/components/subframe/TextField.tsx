import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TextFieldProps {
  variant?: "filled" | "outline";
  label?: string;
  helpText?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface TextFieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function TextField({ variant = "outline", label, helpText, icon, className, children }: TextFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label && <label className="text-sm font-medium text-beta-navy dark:text-white">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        {children}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

TextField.Input = function TextFieldInput({ className, ...props }: TextFieldInputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-beta-gray/50 bg-white dark:bg-neutral-900 px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-beta-navy focus:border-beta-navy disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
};

