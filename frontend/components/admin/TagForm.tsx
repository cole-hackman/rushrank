"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/ui/label";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TagForm - Create/edit tag form with color picker
 * Supports creating new tags or editing existing ones
 */
type Tag = {
  id?: string;
  label: string;
  color?: string | null;
};

interface TagFormProps {
  tag?: Tag | null;
  onSubmit: (tag: { label: string; color?: string }) => Promise<void>;
  onCancel: () => void;
}

const PRESET_COLORS = [
  "#4ade80", // green
  "#60a5fa", // blue
  "#f87171", // red
  "#fbbf24", // yellow
  "#a78bfa", // purple
  "#fb7185", // pink
  "#34d399", // emerald
  "#38bdf8", // sky
  "#f59e0b", // amber
  "#8b5cf6", // violet
];

export function TagForm({ tag, onSubmit, onCancel }: TagFormProps) {
  const [label, setLabel] = useState(tag?.label || "");
  const [color, setColor] = useState(tag?.color || PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tag) {
      setLabel(tag.label);
      setColor(tag.color || PRESET_COLORS[0]);
    }
  }, [tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ label: label.trim(), color });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="tag-label">Tag Label</Label>
        <Input
          id="tag-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Athlete, Legacy"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label>Color</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              type="button"
              onClick={() => setColor(presetColor)}
              className={cn(
                "h-10 w-10 rounded-lg border-2 transition-all",
                color === presetColor
                  ? "border-beta-navy scale-110"
                  : "border-beta-gray/30 hover:border-beta-gray/60"
              )}
              style={{ backgroundColor: presetColor }}
              aria-label={`Select color ${presetColor}`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-20 cursor-pointer"
          />
          <span className="text-sm text-beta-gray">Custom color</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-8 w-8 rounded border border-beta-gray/30"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm text-beta-gray">Preview</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting || !label.trim()}>
          {submitting ? "Saving..." : tag ? "Update Tag" : "Create Tag"}
        </Button>
        <Button type="button" variant="neutral-secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

