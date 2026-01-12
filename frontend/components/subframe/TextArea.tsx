import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TextAreaProps {
  label?: string;
  helpText?: string;
  children: ReactNode;
  className?: string;
}

interface TextAreaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextArea({ label, helpText, children, className }: TextAreaProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label && <label className="text-sm font-medium text-beta-navy dark:text-white">{label}</label>}
      {children}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

TextArea.Input = function TextAreaInput({ className, ...props }: TextAreaInputProps) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-beta-gray/50 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-beta-navy focus:border-beta-navy disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
};

