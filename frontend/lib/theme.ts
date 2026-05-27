export const BG_CREAM = "#FAF7F0";

export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function relLum({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLum(hexToRgb(a));
  const lb = relLum(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export interface AccentTokens {
  accent: string;
  accentFg: string;
  accentSoft: string;
  accentFgOnBg: string;
}

export function deriveAccentTokens(hex: string): AccentTokens {
  if (!isValidHex(hex)) throw new Error(`Invalid hex: ${hex}`);

  const accentFg = contrastRatio(hex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#0A0A0A";

  let accentFgOnBg = hex;
  let attempts = 0;
  while (contrastRatio(accentFgOnBg, BG_CREAM) < 4.5 && attempts < 12) {
    accentFgOnBg = darken(accentFgOnBg, 0.12);
    attempts++;
  }

  const { r, g, b } = hexToRgb(hex);
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.08)`;

  return { accent: hex, accentFg, accentSoft, accentFgOnBg };
}
