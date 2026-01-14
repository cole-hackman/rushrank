"use client";
import React from "react";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/ui/dropdown-menu";

// SubframeCore wrapper to match the user's expected API
export const SubframeCore = {
  DropdownMenu: {
    Root: BaseDropdownMenu,
    Trigger: DropdownMenuTrigger,
    Portal: DropdownMenuPortal,
    Content: DropdownMenuContent,
    Separator: DropdownMenuSeparator,
    Label: DropdownMenuLabel,
  },
};

