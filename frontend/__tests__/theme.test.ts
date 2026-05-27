import { describe, it, expect } from "vitest";
import { hexToRgb, contrastRatio, deriveAccentTokens, isValidHex } from "@/lib/theme";

describe("isValidHex", () => {
  it("accepts 6-digit hex", () => expect(isValidHex("#0033A0")).toBe(true));
  it("rejects 3-digit hex", () => expect(isValidHex("#03A")).toBe(false));
  it("rejects non-hex", () => expect(isValidHex("blue")).toBe(false));
});

describe("hexToRgb", () => {
  it("parses #FFFFFF", () => expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 }));
  it("parses #000000", () => expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 }));
  it("parses #0033A0", () => expect(hexToRgb("#0033A0")).toEqual({ r: 0, g: 51, b: 160 }));
});

describe("contrastRatio", () => {
  it("black on white = 21", () =>
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0));
  it("same color = 1", () =>
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 1));
});

describe("deriveAccentTokens", () => {
  it("dark accent on cream uses accent as text color", () => {
    const t = deriveAccentTokens("#0033A0");
    expect(t.accent).toBe("#0033A0");
    expect(t.accentFgOnBg).toBe("#0033A0");
    expect(t.accentFg).toBe("#FFFFFF");
  });
  it("light accent darkens for text on cream (BTP pink)", () => {
    const t = deriveAccentTokens("#FFC0CB");
    expect(t.accent).toBe("#FFC0CB");
    expect(t.accentFgOnBg).not.toBe("#FFC0CB");
    expect(contrastRatio(t.accentFgOnBg, "#FAF7F0")).toBeGreaterThanOrEqual(4.5);
    expect(t.accentFg).toBe("#0A0A0A");
  });
  it("light accent picks dark text on accent fill", () => {
    const t = deriveAccentTokens("#FFC0CB");
    expect(t.accentFg).toBe("#0A0A0A");
  });
  it("dark accent picks white text on accent fill", () => {
    const t = deriveAccentTokens("#0033A0");
    expect(t.accentFg).toBe("#FFFFFF");
  });
});
