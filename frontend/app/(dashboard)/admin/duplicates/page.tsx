"use client";

/**
 * Duplicate review.
 *
 * The roster has four independent ways in — the intake form, CSV import,
 * walk-ups typed by hand, and the interest link — so the same person arrives
 * more than once as a matter of course. Import refuses to insert a duplicate it
 * recognises, but two rows that already exist stay split: his notes under one
 * id, his attendance under the other. He reads as half as engaged as he is,
 * twice.
 *
 * Two things this screen has to get right, because merging deletes a row and
 * cannot be undone from here:
 *
 *  - It shows what each row *holds*, not just the name. Choosing a survivor off
 *    two identical names is a coin flip; choosing off "4 notes, 3 events" is a
 *    decision.
 *  - Nothing merges without an explicit choice of which row survives. There is
 *    no "merge all", because a name match is a prompt to look, not a verdict —
 *    two different people called John Smith is a real thing.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FeatherAlertTriangle, FeatherCheck, FeatherGitMerge, FeatherUsers } from "@subframe/core";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import {
  getChapterId,
  getDuplicates,
  mergePnms,
  type DuplicateGroup,
  type DuplicateMember,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import AdminProtected from "@/components/AdminProtected";
import { cn } from "@/lib/utils";

const REASON: Record<DuplicateGroup["reason"], { label: string; hint: string; tone: string }> = {
  email: {
    label: "Same email",
    hint: "Almost certainly the same person.",
    tone: "border-error-200 bg-error-50",
  },
  phone: {
    label: "Same phone",
    hint: "Very likely the same person.",
    tone: "border-warning-200 bg-warning-50",
  },
  name: {
    label: "Same name",
    hint: "Worth a look — two people really can share a name.",
    tone: "border-neutral-border bg-white",
  },
};

export default function DuplicatesPage() {
  return (
    <AdminProtected>
      <Duplicates />
    </AdminProtected>
  );
}

function Duplicates() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    const data = await getDuplicates(cid);
    setGroups(data.groups);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cid = await getChapterId();
        if (!cid) throw new Error("No chapter found");
        setChapterId(cid);
        await load(cid);
      } catch (e: any) {
        setError(e?.message || "Could not check for duplicates");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const merge = async (group: DuplicateGroup, winner: DuplicateMember) => {
    const losers = group.members.filter((m) => m.id !== winner.id);
    const names = losers.map((l) => l.name).join(", ");
    const confirmed = window.confirm(
      `Keep ${winner.name} and fold in ${names}?\n\n` +
        `Notes, attendance, votes and tags move across. The other ` +
        `${losers.length === 1 ? "record is" : "records are"} deleted. This can't be undone.`,
    );
    if (!confirmed || !chapterId) return;

    setBusy(winner.id);
    try {
      for (const loser of losers) {
        await mergePnms(winner.id, loser.id);
      }
      await load(chapterId);
      toast({
        title: `Merged into ${winner.name}`,
        description: "Their history is back in one place.",
      });
    } catch (e: any) {
      toast({ title: "Merge failed", description: e?.message });
      // Reload regardless: a multi-row merge may have partly succeeded, and a
      // stale board would invite merging something that no longer exists.
      if (chapterId) await load(chapterId).catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">Possible duplicates</span>
        <span className="text-body font-body text-subtext-color">
          The same person can come in from the intake form, a CSV and a walk-up. Merging puts
          their notes, events and votes back together.
        </span>
      </div>

      {loading && (
        <div className="flex h-48 w-full items-center justify-center text-subtext-color">
          <span className="text-body font-body">Checking…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex h-48 w-full items-center justify-center text-subtext-color">
          <span className="text-body font-body">{error}</span>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-border py-16 text-center">
          <FeatherCheck className="h-6 w-6 text-success-600" />
          <span className="text-heading-3 font-heading-3 text-default-font">
            No duplicates found
          </span>
          <span className="max-w-sm text-body font-body text-subtext-color">
            Nobody in this chapter shares an email, a phone number or a name.
          </span>
        </div>
      )}

      {groups.map((group) => {
        const meta = REASON[group.reason];
        return (
          <section
            key={`${group.reason}-${group.key}`}
            className={cn("flex w-full flex-col gap-3 rounded-lg border border-solid p-5", meta.tone)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={group.reason === "name" ? "neutral" : "warning"}>{meta.label}</Badge>
              <span className="font-monospace-body text-caption text-subtext-color">
                {group.key}
              </span>
              <span className="text-body font-body text-subtext-color">{meta.hint}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar size="small" image={member.photo_url || undefined}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body-bold font-body-bold text-default-font">
                        {member.name}
                      </div>
                      <div className="truncate text-caption font-caption text-subtext-color">
                        {member.email || member.phone || "No contact details"}
                      </div>
                      <div className="truncate text-caption font-caption text-subtext-color">
                        {[member.major, member.year].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </div>

                  {/* What each row actually holds. This is the whole basis for
                      choosing which one survives. */}
                  <div className="flex flex-wrap gap-3 text-caption font-caption text-subtext-color">
                    <span>{member.notes} notes</span>
                    <span>{member.attendance} events</span>
                    <span>{member.votes} votes</span>
                    <span>added {new Date(member.created_at).toLocaleDateString()}</span>
                  </div>

                  <Button
                    variant="neutral-secondary"
                    icon={<FeatherGitMerge />}
                    loading={busy === member.id}
                    disabled={Boolean(busy)}
                    onClick={() => merge(group, member)}
                  >
                    Keep this one
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-caption font-caption text-subtext-color">
              <FeatherAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The row you keep wins on every field it already has; blanks are filled in from the
                other. Merging can&apos;t be undone — it&apos;s recorded in the activity log.
              </span>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <span className="text-body font-body text-subtext-color">
          <FeatherUsers className="mr-1 inline h-4 w-4" />
          {groups.length} {groups.length === 1 ? "group" : "groups"} to review
        </span>
      )}
    </div>
  );
}
