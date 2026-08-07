"use client";

/**
 * Chapter audit trail.
 *
 * `audit_log` was created by migration 0013 and never written to, so the two
 * questions a chapter actually asks after rush -- "who cut him?" and "who made
 * Ty an admin?" -- had no answer anywhere in the product. This is the reading
 * end of that; the writes live at the handlers in routes.py.
 *
 * Deliberately read-only and unfiltered by actor: an audit log you can edit or
 * narrow to hide yourself is not one.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FeatherArchive,
  FeatherClipboardList,
  FeatherFileText,
  FeatherListChecks,
  FeatherScissors,
  FeatherShield,
  FeatherTrash2,
  FeatherUpload,
} from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { getAuditLog, getChapterId, type AuditEntry } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import AdminProtected from "@/components/AdminProtected";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const FILTERS: Array<{ label: string; prefix?: string }> = [
  { label: "Everything" },
  { label: "Rounds", prefix: "round." },
  { label: "PNMs", prefix: "pnm." },
  { label: "Roles", prefix: "membership." },
  { label: "Bid list", prefix: "bid_list." },
];

/** Icon, colour and plain-English label per action. */
const ACTIONS: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  "round.create": { label: "Started a round", icon: <FeatherClipboardList />, tone: "text-brand-600" },
  "round.end": { label: "Ended a round", icon: <FeatherClipboardList />, tone: "text-subtext-color" },
  "round.cutoff": { label: "Made cuts", icon: <FeatherScissors />, tone: "text-error-600" },
  "pnm.import": { label: "Imported a roster", icon: <FeatherUpload />, tone: "text-brand-600" },
  "pnm.bulk_archive": { label: "Archived PNMs", icon: <FeatherArchive />, tone: "text-warning-600" },
  "pnm.delete": { label: "Deleted a PNM", icon: <FeatherTrash2 />, tone: "text-error-600" },
  "membership.role_change": { label: "Changed a role", icon: <FeatherShield />, tone: "text-warning-600" },
  "bid_list.finalize": { label: "Finalized the bid list", icon: <FeatherListChecks />, tone: "text-success-700" },
};

export default function AuditLogPage() {
  return (
    <AdminProtected>
      <AuditLog />
    </AdminProtected>
  );
}

function AuditLog() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [prefix, setPrefix] = useState<string | undefined>(undefined);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cid: string, activePrefix: string | undefined, before?: string) => {
      const page = await getAuditLog(cid, {
        limit: PAGE_SIZE,
        action: activePrefix,
        before,
      });
      setNextBefore(page.next_before);
      setEntries((current) => (before ? [...current, ...page.entries] : page.entries));
    },
    [],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cid = await getChapterId();
        if (!cid) throw new Error("No chapter found");
        setChapterId(cid);
        await load(cid, prefix);
      } catch (e: any) {
        const message = e?.message || "Failed to load the audit log";
        setError(message);
        toast({ title: "Failed to load the audit log", description: message });
      } finally {
        setLoading(false);
      }
    })();
  }, [prefix, load, toast]);

  const loadMore = async () => {
    if (!chapterId || !nextBefore) return;
    setLoadingMore(true);
    try {
      await load(chapterId, prefix, nextBefore);
    } catch (e: any) {
      toast({ title: "Failed to load more", description: e?.message });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">Activity log</span>
        <span className="text-body font-body text-subtext-color">
          Every cut, import, archive and role change, in order. Visible to admins and exec.
        </span>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setPrefix(filter.prefix)}
            className={cn(
              "rounded-full border border-solid px-4 py-1.5 text-body font-body transition",
              prefix === filter.prefix
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-neutral-border bg-white text-subtext-color hover:text-default-font",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col rounded-lg border border-solid border-neutral-border bg-white shadow-sm">
        {loading && (
          <div className="flex h-48 items-center justify-center text-subtext-color">
            <span className="text-body font-body">Loading…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-subtext-color">
            <span className="text-body font-body">{error}</span>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center text-subtext-color">
            <FeatherFileText className="h-6 w-6" />
            <span className="text-body font-body">
              Nothing logged yet. Cuts, imports and role changes will appear here.
            </span>
          </div>
        )}

        {!loading && !error && entries.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </div>

      {nextBefore && !loading && (
        <Button variant="neutral-secondary" loading={loadingMore} onClick={loadMore}>
          Load older activity
        </Button>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: AuditEntry }) {
  const meta = ACTIONS[entry.action] ?? {
    label: entry.action,
    icon: <FeatherFileText />,
    tone: "text-subtext-color",
  };
  const actor = entry.actor_name || entry.actor_email || "Someone";
  const summary = describe(entry);

  return (
    <div className="flex w-full items-start gap-4 border-b border-solid border-neutral-border px-6 py-4 last:border-b-0">
      <span className={cn("mt-0.5 shrink-0", meta.tone)}>{meta.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-bold font-body-bold text-default-font">{actor}</span>
          <span className="text-body font-body text-subtext-color">{meta.label.toLowerCase()}</span>
          {entry.action === "round.cutoff" && entry.after?.cut_count > 0 && (
            <Badge variant="error">{entry.after.cut_count} cut</Badge>
          )}
        </div>
        {summary && (
          <span className="text-body font-body text-subtext-color">{summary}</span>
        )}
      </div>
      <time
        className="shrink-0 text-caption font-caption text-subtext-color"
        dateTime={entry.created_at}
        title={new Date(entry.created_at).toLocaleString()}
      >
        {relative(entry.created_at)}
      </time>
    </div>
  );
}

/** One sentence per action, built from whatever the handler recorded. */
function describe(entry: AuditEntry): string | null {
  const { action, before, after } = entry;

  if (action === "round.cutoff") {
    const rule =
      before?.mode === "top_n"
        ? `top ${before?.value}`
        : `at least ${before?.value}% yes`;
    const archived = after?.archived_count
      ? `, ${after.archived_count} archived`
      : "";
    return `${rule} — ${after?.advanced_count ?? "?"} advanced, ${after?.cut_count ?? "?"} cut${archived}`;
  }
  if (action === "pnm.import") {
    const file = after?.filename ? `${after.filename}: ` : "";
    return `${file}${after?.imported ?? 0} imported, ${after?.skipped ?? 0} skipped`;
  }
  if (action === "pnm.bulk_archive") {
    return `${after?.count ?? 0} PNM(s) ${after?.archived ? "archived" : "restored"}`;
  }
  if (action === "pnm.delete") {
    return before?.name ? `${before.name}${before.email ? ` (${before.email})` : ""}` : null;
  }
  if (action === "membership.role_change") {
    return `${before?.role ?? "?"} → ${after?.role ?? "?"}`;
  }
  if (action === "round.create") {
    return `${after?.type ?? "round"} with ${after?.pnm_count ?? 0} PNMs`;
  }
  return null;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
