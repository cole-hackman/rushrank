"use client";
import React from "react";
import { DropdownMenuItem as BaseDropdownMenuItem } from "@/components/ui/ui/dropdown-menu";

interface DropdownItemProps extends React.ComponentPropsWithoutRef<typeof BaseDropdownMenuItem> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const DropdownMenu = {
  DropdownItem: React.forwardRef<
    React.ElementRef<typeof BaseDropdownMenuItem>,
    DropdownItemProps
  >(({ icon, children, ...props }, ref) => {
    return (
      <BaseDropdownMenuItem
        ref={ref}
        className="flex items-center gap-2 cursor-pointer"
        {...props}
      >
        {icon && <span className="flex items-center">{icon}</span>}
        {children}
      </BaseDropdownMenuItem>
    );
  }),
};

DropdownMenu.DropdownItem.displayName = "DropdownItem";

