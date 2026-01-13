import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TableProps {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface TableRowProps {
  children: ReactNode;
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
}

interface TableHeaderCellProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Table({ header, children, className }: TableProps) {
  return (
    <table className={cn("w-full", className)}>
      {header}
      <tbody>{children}</tbody>
    </table>
  );
}

Table.HeaderRow = function TableHeaderRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-beta-gray/30", className)}>{children}</tr>;
};

Table.HeaderCell = function TableHeaderCell({ children, className, onClick }: TableHeaderCellProps) {
  return (
    <th
      onClick={onClick}
      className={cn("px-4 py-3 text-left text-xs font-semibold text-beta-navy dark:text-white uppercase tracking-wide align-middle", className)}
    >
      {children}
    </th>
  );
};

Table.Row = function TableRow({ children, clickable, onClick, className }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-beta-gray/20 dark:border-neutral-800",
        clickable && "cursor-pointer hover:bg-beta-navy/5 dark:hover:bg-neutral-800/50 transition-colors",
        className
      )}
    >
      {children}
    </tr>
  );
};

Table.Cell = function TableCell({ children, className }: TableCellProps) {
  return <td className={cn("px-4 py-3 text-sm align-middle whitespace-nowrap", className)}>{children}</td>;
};

