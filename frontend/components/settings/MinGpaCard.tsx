"use client";

import { useEffect, useState } from "react";
import { getChapterMinGpa, setChapterMinGpa } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

/**
 * The chapter's GPA floor. With none set, the roster's "below minimum" flag and
 * filter have nothing to compare against and stay empty.
 */
export function MinGpaCard({ chapterId }: { chapterId: string | null }) {
  const { toast } = useToast();
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!chapterId) return;
    getChapterMinGpa(chapterId)
      .then((r) => {
        setSaved(r.min_gpa);
        setValue(r.min_gpa === null ? "" : String(r.min_gpa));
      })
      .catch(() => {
        /* the card still works for setting a value */
      })
      .finally(() => setLoaded(true));
  }, [chapterId]);

  const parsed = value.trim() === "" ? null : Number(value);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 5);
  const unchanged = parsed === saved;

  const save = async (next: number | null) => {
    if (!chapterId) return;
    setBusy(true);
    try {
      const r = await setChapterMinGpa(chapterId, next);
      setSaved(r.min_gpa);
      setValue(r.min_gpa === null ? "" : String(r.min_gpa));
      toast({
        title: r.min_gpa === null ? "GPA check turned off" : `Minimum GPA set to ${r.min_gpa}`,
        description:
          r.min_gpa === null
            ? "PNMs are no longer flagged against a minimum."
            : "PNMs below it are flagged on the roster unless they have a waiver.",
      });
    } catch (e: any) {
      toast({ title: "Could not save the minimum GPA", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Academic eligibility</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the minimum GPA your chapter or campus requires. PNMs below it are flagged on the roster;
        an admin or exec can record a waiver, with a reason, on the PNM&apos;s page. A PNM with no GPA
        on file is never treated as below the minimum.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Minimum GPA</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={5}
            step={0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={loaded ? "Not set" : "Loading…"}
            disabled={busy || !loaded}
            aria-invalid={invalid}
            className="h-10 touch:h-11 w-32 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() => save(parsed)}
          disabled={busy || invalid || unchanged || !loaded}
          className="h-10 touch:h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved !== null && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={busy}
            className="h-10 touch:h-11 rounded-md border border-input px-4 text-sm font-medium text-foreground disabled:opacity-50"
          >
            Turn off
          </button>
        )}
      </div>
      {invalid && <p className="mt-2 text-sm text-destructive">Enter a number between 0 and 5.</p>}
    </section>
  );
}
