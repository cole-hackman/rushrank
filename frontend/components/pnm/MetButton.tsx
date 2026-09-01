"use client";

/**
 * "I've talked to him."
 *
 * The single highest-signal thing a brother can record, and it has to cost one
 * tap or it will not happen — this is used standing up, at an event, on a
 * phone, mid-conversation.
 *
 * Optimistic by design: the count flips immediately and rolls back if the
 * server disagrees. A spinner between tap and feedback is enough friction to
 * stop people bothering, and the write is idempotent per event anyway, so the
 * worst case of a lost round trip is a no-op.
 */

import React, { useState } from "react";
import { FeatherCheck, FeatherUserCheck } from "@subframe/core";
import { logContact, removeContact } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

export function MetButton({
  pnmId,
  eventId,
  metByMe,
  metCount,
  onChange,
  size = "default",
}: {
  pnmId: string;
  /** Records where they met, so "who did we talk to at Sports Night" works. */
  eventId?: string;
  metByMe: boolean;
  metCount: number;
  onChange?: (next: { met_by_me: boolean; met_count: number }) => void;
  size?: "default" | "compact";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    // Lives inside clickable rows and draggable cards.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const wasMet = metByMe;
    const optimistic = {
      met_by_me: !wasMet,
      met_count: Math.max(0, metCount + (wasMet ? -1 : 1)),
    };
    onChange?.(optimistic);
    setBusy(true);

    try {
      const result = wasMet
        ? await removeContact(pnmId, eventId)
        : await logContact(pnmId, eventId ? { event_id: eventId } : undefined);
      onChange?.({ met_by_me: result.met_by_me, met_count: result.met_count });
    } catch (err: any) {
      onChange?.({ met_by_me: wasMet, met_count: metCount });
      toast({ title: "Couldn't save that", description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const compact = size === "compact";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={metByMe}
      title={metByMe ? "You've met him — tap to undo" : "Mark that you've talked to him"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-solid font-body transition disabled:opacity-60",
        compact ? "px-2 py-0.5 text-caption" : "px-3 py-1.5 text-body",
        metByMe
          ? "border-success-600 bg-success-50 text-success-700"
          : "border-neutral-border bg-white text-subtext-color hover:border-brand-600 hover:text-brand-600",
      )}
    >
      {metByMe ? (
        <FeatherCheck className={compact ? "h-3 w-3" : "h-4 w-4"} />
      ) : (
        <FeatherUserCheck className={compact ? "h-3 w-3" : "h-4 w-4"} />
      )}
      {metByMe ? "Met" : "I've met him"}
    </button>
  );
}

/**
 * How many brothers know him, phrased so the number prompts an action.
 *
 * Zero is the important case and gets its own treatment: an unmet PNM going
 * into a vote is the thing the rush chair needs to see before Thursday, not
 * after.
 */
export function CoverageBadge({
  metCount,
  metByMe,
  className,
}: {
  metCount: number;
  metByMe?: boolean;
  className?: string;
}) {
  if (metCount === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-caption font-caption text-warning-700",
          className,
        )}
      >
        Nobody&apos;s met him
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-caption text-subtext-color",
        className,
      )}
    >
      {metCount} {metCount === 1 ? "brother has" : "brothers have"} met him
      {metByMe && " · incl. you"}
    </span>
  );
}
