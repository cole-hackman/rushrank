"use client";

/**
 * Bid list board.
 *
 * The backend for this has been complete and tested since May and had no UI at
 * all: twelve routes, a 10-minute editor lock with takeover, CSV and PDF export.
 * @dnd-kit was already a dependency and unused, presumably staged for it.
 *
 * The lock is the interesting part. Two exec members editing the same bid list
 * from different rooms is the normal case the night before bid day, so the
 * board holds a lock, heartbeats well inside the TTL, releases on unload, and
 * shows a takeover affordance rather than silently stealing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Download, Lock, Unlock, CheckCircle2, AlertTriangle, FileText } from "lucide-react";

import {
  BidBucket,
  BidListEntry,
  BidListWithEntries,
  setBidOutcome,
  type BidOutcome,
  acquireBidListLock,
  createBidList,
  downloadBidList,
  finalizeBidList,
  getBidList,
  refreshBidListLock,
  releaseBidListLock,
  triggerBlobDownload,
  updateBidListEntry,
  api,
  getChapterId,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import AdminProtected from "@/components/AdminProtected";
import { cn } from "@/lib/utils";

const BUCKETS: { key: BidBucket; label: string; hint: string }[] = [
  { key: "bid", label: "Bid", hint: "Extending a bid" },
  { key: "maybe", label: "Maybe", hint: "Still deciding" },
  { key: "cut", label: "Cut", hint: "Not this year" },
];

// The server expires a lock after 10 minutes. Heartbeat well inside that so a
// chair who is reading rather than clicking does not silently lose the board.
const LOCK_HEARTBEAT_MS = 2 * 60 * 1000;

type Round = { id: string; name?: string; created_at: string };

/**
 * Outcome control, shown only in the bid bucket.
 *
 * Not gated behind the editor lock like dragging is: an acceptance is a fact
 * arriving from the outside world, often days after the list was finalized,
 * from whoever happens to hear it first. Requiring the lock would mean the
 * person who hears it cannot record it.
 */
function OutcomeControl({
  entry,
  onChange,
}: {
  entry: BidListEntry;
  onChange: (next: BidOutcome, reason?: string) => void;
}) {
  const options: Array<{ key: BidOutcome; label: string; className: string }> = [
    { key: "pending", label: "Not sent", className: "text-subtext-color" },
    { key: "offered", label: "Offered", className: "text-brand-600" },
    { key: "accepted", label: "Accepted", className: "text-success-700" },
    { key: "declined", label: "Declined", className: "text-danger" },
  ];
  const active = options.find((o) => o.key === entry.outcome) ?? options[0];

  return (
    <div className="flex shrink-0 items-center gap-2">
      <select
        aria-label={`Bid outcome for ${entry.name}`}
        value={entry.outcome}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const next = e.target.value as BidOutcome;
          if (next === "declined") {
            // Free text, because chapters lose people to other houses, to cost,
            // and to deciding against Greek life -- and which matters varies.
            const reason = window.prompt(`Why did ${entry.name} decline? (optional)`) ?? undefined;
            onChange(next, reason || undefined);
          } else {
            onChange(next);
          }
        }}
        className={cn(
          "rounded-full border border-border bg-card px-2 py-1 text-caption",
          active.className,
        )}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EntryCard({
  entry,
  disabled,
  onOutcome,
}: {
  entry: BidListEntry;
  disabled: boolean;
  onOutcome?: (pnmId: string, next: BidOutcome, reason?: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.pnm_id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <Avatar image={entry.photo_url || undefined} size="small">
        {entry.name.slice(0, 2).toUpperCase()}
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-bold font-body-bold text-default-font">{entry.name}</div>
        <div className="truncate text-caption text-subtext-color">
          {[entry.year, entry.major].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 font-mono text-caption text-subtext-color">
        <span className="text-token-success">{entry.vote_summary.up}</span>
        <span>/</span>
        <span className="text-danger">{entry.vote_summary.down}</span>
        {entry.vote_summary.star > 0 && <span title="Favorites">★{entry.vote_summary.star}</span>}
      </div>
      {entry.bucket === "bid" && onOutcome && (
        <OutcomeControl
          entry={entry}
          onChange={(next, reason) => onOutcome(entry.pnm_id, next, reason)}
        />
      )}
    </div>
  );
}

function BucketColumn({
  bucket,
  label,
  hint,
  entries,
  disabled,
  overCap,
  onOutcome,
}: {
  bucket: BidBucket;
  label: string;
  hint: string;
  entries: BidListEntry[];
  disabled: boolean;
  overCap: boolean;
  onOutcome?: (pnmId: string, next: BidOutcome, reason?: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[240px] flex-col gap-3 rounded-2xl border p-4 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-surface-muted/40",
      )}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-heading-3 font-heading-3 text-default-font">{label}</h2>
          <p className="text-caption text-subtext-color">{hint}</p>
        </div>
        <Badge variant={overCap ? "warning" : "neutral"}>{entries.length}</Badge>
      </div>

      {overCap && (
        <div className="flex items-center gap-2 rounded-lg bg-warning-100 px-3 py-2 text-caption text-warning-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Over the bid cap
        </div>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((e) => (
          <EntryCard key={e.pnm_id} entry={e} disabled={disabled} onOutcome={onOutcome} />
        ))}
        {entries.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-caption text-subtext-color">
            Drag PNMs here
          </p>
        )}
      </div>
    </div>
  );
}

function BidListBoard() {
  const { toast } = useToast();
  const [data, setData] = useState<BidListWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLock, setHasLock] = useState(false);
  const [dragging, setDragging] = useState<BidListEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const heldRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBidList();
      setData(res);
    } catch (e: any) {
      // 404 is the normal "no bid list yet" state, not an error worth shouting about.
      if (e?.status !== 404) toast({ title: "Could not load bid list", description: e?.message });
      setData(null);
      const cid = await getChapterId();
      if (cid) {
        const rs = await api<Round[]>(`/rounds?chapter_id=${cid}`).catch(() => []);
        setRounds(rs);
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void getSessionUser().then((u) => setUserId(u?.id ?? null));
  }, [load]);

  // Heartbeat + release. Without the release a chair who closes the tab holds
  // the board for the full TTL.
  useEffect(() => {
    if (!hasLock) return;
    heldRef.current = true;
    const interval = setInterval(() => {
      void refreshBidListLock().catch(() => {
        setHasLock(false);
        toast({ title: "Editing lock lost", description: "Someone else may have taken over." });
      });
    }, LOCK_HEARTBEAT_MS);

    const release = () => {
      if (!heldRef.current) return;
      heldRef.current = false;
      void releaseBidListLock().catch(() => {});
    };
    window.addEventListener("beforeunload", release);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [hasLock, toast]);

  const lockedByOther = Boolean(
    data?.bid_list.locked_by && userId && data.bid_list.locked_by !== userId,
  );
  const finalized = Boolean(data?.bid_list.finalized_at);
  const canEdit = hasLock && !finalized;

  const byBucket = useMemo(() => {
    const out: Record<BidBucket, BidListEntry[]> = { bid: [], maybe: [], cut: [] };
    for (const e of data?.entries ?? []) out[e.bucket]?.push(e);
    for (const k of Object.keys(out) as BidBucket[]) out[k].sort((a, b) => a.position - b.position);
    return out;
  }, [data]);

  const bidCap = data?.bid_list.bid_cap ?? null;
  const overCap = bidCap !== null && byBucket.bid.length > bidCap;
  const tally = data?.outcomes;

  const applyOutcome = async (pnmId: string, next: BidOutcome, reason?: string) => {
    const previous = data;
    // Optimistic, then reconciled from the server response -- the tally is
    // derived server-side, so a stale local count would misreport bids left.
    setData((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((e) =>
              e.pnm_id === pnmId
                ? { ...e, outcome: next, declined_reason: reason ?? null }
                : e,
            ),
          }
        : current,
    );
    try {
      await setBidOutcome(pnmId, next, reason);
      await load();
    } catch (e: any) {
      setData(previous);
      toast({ title: "Couldn't record that", description: e?.message });
    }
  };
  // Once bids start going out, the useful number stops being "how many are on
  // the list" and becomes "how many do we have left" -- declines give bids back.
  const inPlay = (tally?.accepted ?? 0) + (tally?.offered ?? 0);

  const takeLock = async () => {
    setBusy(true);
    try {
      await acquireBidListLock();
      setHasLock(true);
      await load();
      toast({ title: "You have the board" });
    } catch (e: any) {
      toast({ title: "Could not take the lock", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setDragging(null);
    const bucket = event.over?.id as BidBucket | undefined;
    const pnmId = String(event.active.id);
    if (!bucket || !data) return;

    const entry = data.entries.find((e) => e.pnm_id === pnmId);
    if (!entry || entry.bucket === bucket) return;

    const position = byBucket[bucket].length;
    // Optimistic: the board should feel immediate with forty PNMs on screen.
    const previous = data;
    setData({
      ...data,
      entries: data.entries.map((e) =>
        e.pnm_id === pnmId ? { ...e, bucket, position } : e,
      ),
    });

    try {
      await updateBidListEntry(pnmId, { bucket, position });
    } catch (e: any) {
      setData(previous);
      const conflict = e?.status === 409;
      toast({
        title: conflict ? "You don't hold the lock" : "Move failed",
        description: conflict ? "Take over the board to make changes." : e?.message,
      });
      if (conflict) setHasLock(false);
    }
  };

  const exportAs = async (format: "csv" | "pdf") => {
    try {
      const { blob, filename } = await downloadBidList(format);
      triggerBlobDownload(blob, filename);
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message });
    }
  };

  const seedFromRound = async (roundId: string) => {
    setBusy(true);
    try {
      await createBidList({ source_round_id: roundId, name: "Bid List" });
      await load();
      toast({ title: "Bid list created", description: "Seeded from round results." });
    } catch (e: any) {
      toast({ title: "Could not create bid list", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-subtext-color">Loading bid list…</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-heading-1 font-heading-1 text-default-font">No bid list yet</h1>
        <p className="mt-2 text-body text-subtext-color">
          Seed one from a completed voting round. PNMs start in Maybe, ordered by score.
        </p>
        {rounds.length === 0 ? (
          <p className="mt-6 text-caption text-subtext-color">
            You&apos;ll need a voting round with results first.
          </p>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2">
            {rounds.slice(0, 5).map((r) => (
              <Button
                key={r.id}
                variant="neutral-secondary"
                disabled={busy}
                onClick={() => seedFromRound(r.id)}
                className="w-full max-w-sm"
              >
                {r.name || `Round ${r.id.slice(0, 6)}`} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-heading-1 text-default-font">{data.bid_list.name}</h1>
          <p className="text-body text-subtext-color">
            {byBucket.bid.length} bids
            {bidCap !== null && ` of ${bidCap}`} · {byBucket.maybe.length} undecided ·{" "}
            {byBucket.cut.length} cut
          </p>
          {tally && inPlay > 0 && (
            <p className="mt-1 text-body text-subtext-color">
              <span className="text-body-bold font-body-bold text-success-700">
                {tally.accepted} accepted
              </span>
              {tally.offered > 0 && ` · ${tally.offered} awaiting an answer`}
              {tally.declined > 0 && ` · ${tally.declined} declined`}
              {tally.remaining !== null && (
                <>
                  {" · "}
                  <span className="text-body-bold font-body-bold text-default-font">
                    {tally.remaining} {tally.remaining === 1 ? "bid" : "bids"} left
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {finalized ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
              Finalized
            </Badge>
          ) : canEdit ? (
            <Badge variant="success">
              <Unlock className="mr-1 inline h-3.5 w-3.5" />
              You&apos;re editing
            </Badge>
          ) : (
            <Button
              variant="neutral-secondary"
              icon={<Lock className="h-4 w-4" />}
              onClick={takeLock}
              disabled={busy}
            >
              {lockedByOther ? "Take over editing" : "Start editing"}
            </Button>
          )}

          <Button variant="neutral-secondary" icon={<Download className="h-4 w-4" />} onClick={() => exportAs("csv")}>
            CSV
          </Button>
          <Button variant="neutral-secondary" icon={<FileText className="h-4 w-4" />} onClick={() => exportAs("pdf")}>
            PDF
          </Button>

          {!finalized && (
            <Button
              variant="brand-primary"
              disabled={!canEdit || busy}
              onClick={async () => {
                if (!confirm("Finalize this bid list? It becomes read-only.")) return;
                setBusy(true);
                try {
                  await finalizeBidList();
                  await load();
                  toast({ title: "Bid list finalized" });
                } catch (e: any) {
                  toast({ title: "Could not finalize", description: e?.message });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Finalize
            </Button>
          )}
        </div>
      </div>

      {lockedByOther && !canEdit && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-body text-subtext-color">
          <Lock className="h-4 w-4 shrink-0" />
          Another exec member is editing. Their lock expires after ten minutes of
          inactivity, or you can take over now.
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) =>
          setDragging(data.entries.find((x) => x.pnm_id === String(e.active.id)) ?? null)
        }
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BUCKETS.map((b) => (
            <BucketColumn
              key={b.key}
              bucket={b.key}
              label={b.label}
              hint={b.hint}
              entries={byBucket[b.key]}
              disabled={!canEdit}
              overCap={b.key === "bid" && overCap}
              onOutcome={b.key === "bid" ? applyOutcome : undefined}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging && (
            <div className="flex items-center gap-3 rounded-xl border border-primary bg-card p-3 shadow-lg">
              <Avatar image={dragging.photo_url || undefined} size="small">
                {dragging.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <span className="text-body-bold font-body-bold text-default-font">{dragging.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default function BidListPage() {
  return (
    <AdminProtected>
      <BidListBoard />
    </AdminProtected>
  );
}
