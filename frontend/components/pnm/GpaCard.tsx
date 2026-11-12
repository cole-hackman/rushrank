"use client";

import { useState } from "react";
import { ELIGIBILITY_LABEL, setGpaWaiver, setPnmGpa, type Eligibility } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useMyRole } from "@/hooks/useMyRole";

type Props = {
  pnmId: string;
  gpa: number | null | undefined;
  minGpa: number | null | undefined;
  waived: boolean | undefined;
  waivedReason: string | null | undefined;
  eligibility: Eligibility | null | undefined;
  /** Called after a successful change so the page can reload the PNM. */
  onChanged: () => void;
};

const TONE: Record<Eligibility, string> = {
  no_minimum: "text-beta-gray",
  unknown: "text-beta-gray",
  waived: "text-amber-700",
  eligible: "text-emerald-700",
  below: "text-red-700",
};

/**
 * GPA on the PNM's page: any member can enter it, an admin or exec can waive
 * the chapter minimum with a reason. Both endpoints existed with no screen.
 */
export function GpaCard({ pnmId, gpa, minGpa, waived, waivedReason, eligibility, onChanged }: Props) {
  const { toast } = useToast();
  const { canManage } = useMyRole();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(gpa == null ? "" : String(gpa));
  const [waiving, setWaiving] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const status: Eligibility = eligibility ?? "no_minimum";
  const parsed = value.trim() === "" ? null : Number(value);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 5);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast({ title: done });
      setEditing(false);
      setWaiving(false);
      setReason("");
      onChanged();
    } catch (e: any) {
      toast({ title: "Could not save", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-beta-navy">Academic eligibility</span>
        {!editing && (
          <button
            type="button"
            className="text-sm font-medium text-beta-navy underline underline-offset-2 touch:min-h-[44px] touch:min-w-[44px]"
            onClick={() => {
              setValue(gpa == null ? "" : String(gpa));
              setEditing(true);
            }}
          >
            {gpa == null ? "Add GPA" : "Edit"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-beta-gray">
            GPA
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={5}
              step={0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={invalid}
              className="h-10 touch:h-11 w-28 rounded-lg border border-beta-gray/60 px-3 text-sm text-beta-navy"
            />
          </label>
          <button
            type="button"
            disabled={busy || invalid}
            onClick={() => run(() => setPnmGpa(pnmId, parsed), parsed === null ? "GPA cleared" : "GPA saved")}
            className="h-10 touch:h-11 rounded-lg bg-beta-navy px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
            className="h-10 touch:h-11 rounded-lg border border-beta-gray/60 px-4 text-sm font-medium text-beta-navy"
          >
            Cancel
          </button>
          {invalid && <p className="w-full text-sm text-red-700">Enter a number between 0 and 5, or leave it blank.</p>}
        </div>
      ) : (
        <dl className="mt-4 space-y-3 text-sm text-beta-gray">
          <div className="flex items-center justify-between">
            <dt>GPA</dt>
            <dd className="font-medium text-beta-navy">{gpa == null ? "Not on file" : gpa.toFixed(2)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>Chapter minimum</dt>
            <dd className="font-medium text-beta-navy">{minGpa == null ? "None set" : minGpa.toFixed(2)}</dd>
          </div>
          {status !== "no_minimum" && (
            <div className="flex items-center justify-between">
              <dt>Status</dt>
              <dd className={`font-medium ${TONE[status]}`}>{ELIGIBILITY_LABEL[status]}</dd>
            </div>
          )}
          {waived && waivedReason && (
            <div>
              <dt className="text-xs font-medium">Waiver reason</dt>
              <dd className="mt-1 text-beta-navy">{waivedReason}</dd>
            </div>
          )}
        </dl>
      )}

      {canManage && !editing && minGpa != null && (
        <div className="mt-4 border-t border-beta-gray/20 pt-4">
          {waived ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => setGpaWaiver(pnmId, false), "Waiver removed")}
              className="text-sm font-medium text-beta-navy underline underline-offset-2 touch:min-h-[44px]"
            >
              Remove waiver
            </button>
          ) : waiving ? (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-beta-gray">
                Why is the minimum being waived? This is kept in the activity log.
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="rounded-lg border border-beta-gray/60 px-3 py-2 text-sm text-beta-navy"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={() => run(() => setGpaWaiver(pnmId, true, reason.trim()), "Waiver recorded")}
                  className="h-10 touch:h-11 rounded-lg bg-beta-navy px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  Record waiver
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setWaiving(false)}
                  className="h-10 touch:h-11 rounded-lg border border-beta-gray/60 px-4 text-sm font-medium text-beta-navy"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWaiving(true)}
              className="text-sm font-medium text-beta-navy underline underline-offset-2 touch:min-h-[44px]"
            >
              Waive the minimum for this PNM
            </button>
          )}
        </div>
      )}
    </div>
  );
}
