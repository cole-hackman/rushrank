import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, label, className }: CheckboxProps) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="w-4 h-4 rounded border-beta-gray/50 text-beta-navy focus:ring-beta-navy focus:ring-offset-0 focus:ring-2"
      />
      {label && <span className="text-sm text-beta-navy dark:text-white">{label}</span>}
    </label>
  );
}

