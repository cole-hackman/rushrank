"use client";
import React from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface ThemeOptionProps {
    theme: "light" | "dark" | "system";
    currentTheme: "light" | "dark" | "system";
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

function ThemeOption({ theme, currentTheme, icon, label, onClick }: ThemeOptionProps) {
    const isSelected = theme === currentTheme;

    return (
        <button
            onClick={onClick}
            className={cn(
                "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                "text-neutral-700 dark:text-neutral-300"
            )}
        >
            <span className="flex items-center">{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {isSelected && (
                <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            )}
        </button>
    );
}

export function ThemeToggleItems() {
    const { theme, setTheme } = useTheme();

    return (
        <>
            <ThemeOption
                theme="light"
                currentTheme={theme}
                icon={<Sun className="h-4 w-4" />}
                label="Light"
                onClick={() => setTheme("light")}
            />
            <ThemeOption
                theme="dark"
                currentTheme={theme}
                icon={<Moon className="h-4 w-4" />}
                label="Dark"
                onClick={() => setTheme("dark")}
            />
            <ThemeOption
                theme="system"
                currentTheme={theme}
                icon={<Monitor className="h-4 w-4" />}
                label="System"
                onClick={() => setTheme("system")}
            />
        </>
    );
}
