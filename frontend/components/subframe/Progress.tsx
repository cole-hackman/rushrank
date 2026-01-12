import { cn } from "@/lib/utils";

interface ProgressProps {
  value?: number; // 0-100
  className?: string;
}

export function Progress({ value = 0, className }: ProgressProps) {
  return (
    <div className={cn("h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-beta-navy transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

