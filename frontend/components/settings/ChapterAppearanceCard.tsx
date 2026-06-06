"use client";

import { useState, useEffect } from "react";
import { useChapterTheme, useUpdateChapterTheme } from "@/lib/queries";
import { isValidHex } from "@/lib/theme";

export function ChapterAppearanceCard() {
  const { data } = useChapterTheme();
  const update = useUpdateChapterTheme();
  const [enabled, setEnabled] = useState(false);
  const [hex, setHex] = useState<string>("#0033A0");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    if (data.accent_hex) setHex(data.accent_hex);
  }, [data]);

  const hexValid = isValidHex(hex);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Chapter Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Apply a chapter accent color across the product. Disabled by default.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="chapter-accent-mode"
            checked={!enabled}
            onChange={() => setEnabled(false)}
          />
          <span>Generic (cream &amp; black)</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="chapter-accent-mode"
            checked={enabled}
            onChange={() => setEnabled(true)}
          />
          <span>Use our chapter colors</span>
        </label>
      </div>

      {enabled && (
        <div className="mt-4 flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border border-border"
            style={{ backgroundColor: hexValid ? hex : "#CCCCCC" }}
          />
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 font-mono text-sm"
            placeholder="#0033A0"
          />
          {!hexValid && <span className="text-sm text-danger">Invalid hex</span>}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={(enabled && !hexValid) || update.isPending}
          onClick={() =>
            update.mutate({
              enabled,
              accent_hex: enabled ? hex : null,
              source: "manual",
            })
          }
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <div className="ml-auto flex gap-2">
          <span className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Button</span>
          <span className="rounded border-b-2 border-primary px-2 py-1 text-xs">Tab</span>
          <span
            className="rounded px-2 py-1 text-xs"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-fg-on-bg)" }}
          >
            Tag
          </span>
        </div>
      </div>
    </section>
  );
}
