"use client";

import { useEffect } from "react";
import { useChapterTheme } from "@/lib/queries";
import { deriveAccentTokens, isValidHex, hexToRgb } from "@/lib/theme";

const STORAGE_KEY = "rushrank.theme.v1";

function hexToHslTriplet(hex: string): string {
  // Convert #RRGGBB to "H S% L%" for shadcn hsl(var(--x)) consumers.
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTokens(hex: string | null) {
  const root = document.documentElement.style;
  if (!hex || !isValidHex(hex)) {
    // Defaults: near-black accent
    root.setProperty("--accent-hex", "#0A0A0A");
    root.setProperty("--accent-fg", "#FFFFFF");
    root.setProperty("--accent-soft", "rgba(10,10,10,0.08)");
    root.setProperty("--accent-fg-on-bg", "#0A0A0A");
    root.setProperty("--accent", "0 0% 4%");           // shadcn HSL
    root.setProperty("--primary", "0 0% 4%");
    root.setProperty("--ring", "0 0% 4%");
    return;
  }
  const t = deriveAccentTokens(hex);
  root.setProperty("--accent-hex", t.accent);
  root.setProperty("--accent-fg", t.accentFg);
  root.setProperty("--accent-soft", t.accentSoft);
  root.setProperty("--accent-fg-on-bg", t.accentFgOnBg);
  const hsl = hexToHslTriplet(hex);
  root.setProperty("--accent", hsl);
  root.setProperty("--primary", hsl);
  root.setProperty("--ring", hsl);
}

export function ChapterThemeProvider({ children }: { children: React.ReactNode }) {
  // Read cached theme synchronously to avoid flash; SSR-safe with typeof window.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { hex, ts } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) applyTokens(hex);
      }
    } catch {}
  }, []);

  const { data } = useChapterTheme();

  useEffect(() => {
    if (!data) return;
    const hex = data.enabled ? data.accent_hex : null;
    applyTokens(hex);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hex, ts: Date.now() }));
    } catch {}
  }, [data]);

  return <>{children}</>;
}
