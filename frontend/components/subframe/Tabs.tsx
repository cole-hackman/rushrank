import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TabsProps {
  children: ReactNode;
  className?: string;
}

interface TabItemProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Tabs({ children, className }: TabsProps) {
  return <div className={cn("flex gap-1 border-b border-beta-gray/30", className)}>{children}</div>;
}

Tabs.Item = function TabItem({ children, active, onClick, className }: TabItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px",
        active
          ? "border-beta-navy text-beta-navy dark:text-blue-400"
          : "border-transparent text-muted-foreground hover:text-beta-navy dark:hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
};

