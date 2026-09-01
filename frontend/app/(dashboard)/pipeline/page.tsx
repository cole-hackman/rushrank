"use client";

/**
 * Pre-rush pipeline.
 *
 * The two or three months before formal rush — summer DMs, the activities
 * fair, referrals — previously had nowhere to live, so prospects were lost
 * every year not because they were cut but because nobody wrote them down.
 *
 * Two design calls worth knowing about:
 *
 *  - The board's columns are *contact status*, not stage. "Where does this
 *    conversation stand" is the question a rush chair asks on Thursday night;
 *    stage only changes once, at conversion.
 *  - Owner is surfaced everywhere, and "nobody owns this one" gets its own
 *    filter. "Someone should message him" is how prospects get lost; "Devin
 *    owes him a reply" is how they don't.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  FeatherArrowRight,
  FeatherCheck,
  FeatherCopy,
  FeatherInstagram,
  FeatherLink,
  FeatherUserPlus,
  FeatherUsers,
} from "@subframe/core";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import {
  CONTACT_STATUSES,
  SOURCE_LABELS,
  getChapterId,
  getPipeline,
  updatePipeline,
  type ContactStatus,
  type PipelineBoard,
  type Prospect,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

export default function PipelinePage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [mine, setMine] = useState(false);
  const [unownedOnly, setUnownedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Prospect | null>(null);

  const load = useCallback(
    async (cid: string, onlyMine: boolean) => {
      const data = await getPipeline(cid, onlyMine);
      setBoard(data);
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
        await load(cid, mine);
      } catch (e: any) {
        setError(e?.message || "Could not load the pipeline");
      } finally {
        setLoading(false);
      }
    })();
  }, [mine, load]);

  const visible = useMemo(() => {
    if (!board) return [];
    return unownedOnly ? board.prospects.filter((p) => !p.owner_user_id) : board.prospects;
  }, [board, unownedOnly]);

  const columns = useMemo(() => {
    const grouped: Record<ContactStatus, Prospect[]> = {
      new: [], contacted: [], responded: [], invited: [], no_response: [],
    };
    for (const prospect of visible) grouped[prospect.contact_status]?.push(prospect);
    return grouped;
  }, [visible]);

  const sensors = useSensors(
    // 6px so a tap on a card still reads as a tap on a phone.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const move = async (prospect: Prospect, to: ContactStatus) => {
    if (prospect.contact_status === to) return;
    const from = prospect.contact_status;

    // Optimistic: the board is a thinking tool and a round trip per drag makes
    // it feel broken. Rolled back below if the server disagrees.
    setBoard((current) =>
      current
        ? {
            ...current,
            prospects: current.prospects.map((p) =>
              p.id === prospect.id ? { ...p, contact_status: to } : p,
            ),
          }
        : current,
    );

    try {
      // Moving out of "new" means somebody actually reached out, so stamp it.
      const updated = await updatePipeline(prospect.id, {
        contact_status: to,
        touch: to === "contacted" || to === "invited",
      });
      setBoard((current) =>
        current
          ? {
              ...current,
              prospects: current.prospects.map((p) =>
                p.id === prospect.id ? { ...p, ...updated } : p,
              ),
            }
          : current,
      );
    } catch (e: any) {
      setBoard((current) =>
        current
          ? {
              ...current,
              prospects: current.prospects.map((p) =>
                p.id === prospect.id ? { ...p, contact_status: from } : p,
              ),
            }
          : current,
      );
      toast({ title: "Could not move that card", description: e?.message });
    }
  };

  const claim = async (prospect: Prospect, take: boolean) => {
    try {
      const updated = await updatePipeline(prospect.id, { owner_user_id: take ? "me" : "" });
      setBoard((current) =>
        current
          ? {
              ...current,
              prospects: current.prospects.map((p) =>
                p.id === prospect.id ? { ...p, ...updated } : p,
              ),
            }
          : current,
      );
    } catch (e: any) {
      toast({ title: "Could not update the owner", description: e?.message });
    }
  };

  const convert = async (prospect: Prospect) => {
    try {
      await updatePipeline(prospect.id, { stage: "pnm" });
      setBoard((current) =>
        current
          ? {
              ...current,
              prospects: current.prospects.filter((p) => p.id !== prospect.id),
              counts: {
                ...current.counts,
                prospects: Math.max(0, (current.counts.prospects ?? 1) - 1),
                pnms: (current.counts.pnms ?? 0) + 1,
              },
            }
          : current,
      );
      toast({
        title: `${prospect.name} is in rush`,
        description: "Their notes, tags and photo carried over.",
      });
    } catch (e: any) {
      toast({ title: "Could not convert", description: e?.message });
    }
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-heading-1 font-heading-1 text-default-font">Pipeline</span>
          <span className="text-body font-body text-subtext-color">
            Everyone you&apos;re talking to before rush starts. Convert them when they&apos;re in.
          </span>
        </div>
        <Link href="/pnms">
          <Button variant="neutral-secondary" icon={<FeatherUsers />}>
            {board?.counts.pnms ?? 0} in rush
          </Button>
        </Link>
      </div>

      {chapterId && <SharePanel chapterId={chapterId} />}

      {board && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <Chip active={!mine && !unownedOnly} onClick={() => { setMine(false); setUnownedOnly(false); }}>
            Everyone · {board.counts.prospects ?? 0}
          </Chip>
          <Chip active={mine} onClick={() => { setMine(true); setUnownedOnly(false); }}>
            Mine
          </Chip>
          <Chip active={unownedOnly} onClick={() => { setMine(false); setUnownedOnly(true); }}>
            Nobody&apos;s on it · {board.counts.unowned ?? 0}
          </Chip>
        </div>
      )}

      {loading && (
        <div className="flex h-48 w-full items-center justify-center text-subtext-color">
          <span className="text-body font-body">Loading…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex h-48 w-full items-center justify-center text-subtext-color">
          <span className="text-body font-body">{error}</span>
        </div>
      )}

      {board && !loading && !error && (
        <>
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) =>
              setDragging(visible.find((p) => p.id === e.active.id) ?? null)
            }
            onDragEnd={(e: DragEndEvent) => {
              setDragging(null);
              const prospect = visible.find((p) => p.id === e.active.id);
              const target = e.over?.id as ContactStatus | undefined;
              if (prospect && target) void move(prospect, target);
            }}
            onDragCancel={() => setDragging(null)}
          >
            <div className="flex w-full gap-4 overflow-x-auto pb-2">
              {CONTACT_STATUSES.map((status) => (
                <Column
                  key={status.key}
                  status={status}
                  prospects={columns[status.key]}
                  onClaim={claim}
                  onConvert={convert}
                />
              ))}
            </div>
            <DragOverlay>
              {dragging && <Card prospect={dragging} dragging />}
            </DragOverlay>
          </DndContext>

          {board.prospects.length === 0 && (
            <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-border py-16 text-center">
              <FeatherUserPlus className="h-6 w-6 text-subtext-color" />
              <span className="text-heading-3 font-heading-3 text-default-font">
                Nobody in the pipeline yet
              </span>
              <span className="max-w-sm text-body font-body text-subtext-color">
                Share the link above in your Instagram bio, or reply to a DM with it. Anyone who
                fills it in lands here.
              </span>
            </div>
          )}

          {board.by_source.length > 0 && <SourceBreakdown board={board} />}
        </>
      )}
    </div>
  );
}

function Column({
  status,
  prospects,
  onClaim,
  onConvert,
}: {
  status: { key: ContactStatus; label: string; hint: string };
  prospects: Prospect[];
  onClaim: (p: Prospect, take: boolean) => void;
  onConvert: (p: Prospect) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[260px] flex-1 flex-col gap-3 rounded-lg border border-solid p-3 transition",
        isOver ? "border-brand-600 bg-brand-50" : "border-neutral-border bg-neutral-50",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-body-bold font-body-bold text-default-font">{status.label}</span>
        <span className="text-caption font-caption text-subtext-color">{prospects.length}</span>
      </div>
      <span className="text-caption font-caption text-subtext-color">{status.hint}</span>

      <div className="flex flex-col gap-2">
        {prospects.map((prospect) => (
          <Card
            key={prospect.id}
            prospect={prospect}
            onClaim={onClaim}
            onConvert={status.key === "invited" || status.key === "responded" ? onConvert : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Card({
  prospect,
  dragging,
  onClaim,
  onConvert,
}: {
  prospect: Prospect;
  dragging?: boolean;
  onClaim?: (p: Prospect, take: boolean) => void;
  onConvert?: (p: Prospect) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospect.id });

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-solid border-neutral-border bg-white p-3 shadow-sm",
        isDragging && "opacity-40",
        dragging && "rotate-2 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2" {...(dragging ? {} : { ...listeners, ...attributes })}>
        <Avatar size="small" image={prospect.photo_url || undefined}>
          {prospect.name.slice(0, 2).toUpperCase()}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-bold font-body-bold text-default-font">
            {prospect.name}
          </span>
          {prospect.instagram_handle && (
            <a
              href={`https://instagram.com/${prospect.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 truncate text-caption font-caption text-subtext-color hover:text-brand-600"
            >
              <FeatherInstagram className="h-3 w-3 shrink-0" />@{prospect.instagram_handle}
            </a>
          )}
          {!prospect.instagram_handle && (prospect.email || prospect.phone) && (
            <span className="truncate text-caption font-caption text-subtext-color">
              {prospect.email || prospect.phone}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {prospect.source && (
          <Badge variant="neutral">{SOURCE_LABELS[prospect.source] ?? prospect.source}</Badge>
        )}
        {prospect.year && <Badge variant="neutral">{prospect.year}</Badge>}
      </div>

      {!dragging && (
        <div className="flex items-center justify-between gap-2 border-t border-solid border-neutral-border pt-2">
          {prospect.owner_user_id ? (
            <button
              onClick={() => onClaim?.(prospect, false)}
              className="truncate text-caption font-caption text-subtext-color hover:text-default-font"
              title="Hand back to the pool"
            >
              {prospect.owner_name ?? "Claimed"}
            </button>
          ) : (
            <button
              onClick={() => onClaim?.(prospect, true)}
              className="text-caption-bold font-caption-bold text-brand-600 hover:text-brand-700"
            >
              I&apos;ll take this
            </button>
          )}

          {onConvert && (
            <button
              onClick={() => onConvert(prospect)}
              className="flex shrink-0 items-center gap-1 text-caption-bold font-caption-bold text-success-700 hover:text-success-800"
              title="Move into formal rush"
            >
              To rush <FeatherArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The link that goes in the Instagram bio, and a QR for the tabling sign. */
function SharePanel({ chapterId }: { chapterId: string }) {
  const { toast } = useToast();
  const [source, setSource] = useState("instagram");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/interest?chapter=${chapterId}&source=${source}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Select the link and copy it manually." });
    }
  };

  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <span className="text-heading-3 font-heading-3 text-default-font">Your interest link</span>
        <span className="text-body font-body text-subtext-color">
          Put it in your Instagram bio, or send it as the reply when someone DMs about rush.
          Anyone who fills it in shows up here, tagged with where they came from.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-lg border border-solid border-neutral-border bg-white px-3 text-body font-body text-default-font"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="instagram">Instagram</option>
          <option value="tabling">Tabling</option>
          <option value="referral">Brother referral</option>
          <option value="interest_form">General</option>
        </select>
        <code className="min-w-[240px] flex-1 truncate rounded-lg border border-solid border-neutral-border bg-neutral-50 px-3 py-2 text-caption font-monospace-body text-subtext-color">
          {link}
        </code>
        <Button
          variant="neutral-secondary"
          icon={copied ? <FeatherCheck /> : <FeatherCopy />}
          onClick={copy}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <a href={link} target="_blank" rel="noreferrer">
          <Button variant="neutral-tertiary" icon={<FeatherLink />}>Preview</Button>
        </a>
      </div>
    </section>
  );
}

/** Which channel actually works — the reason source is tracked at all. */
function SourceBreakdown({ board }: { board: PipelineBoard }) {
  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-5 shadow-sm">
      <span className="text-heading-3 font-heading-3 text-default-font">Where they come from</span>
      <div className="flex flex-col gap-2">
        {board.by_source.map((row) => {
          const rate = row.total ? Math.round((row.converted / row.total) * 100) : 0;
          return (
            <div key={row.source} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-body font-body text-default-font">
                {SOURCE_LABELS[row.source] ?? row.source}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${rate}%` }} />
              </div>
              <span className="w-32 shrink-0 text-right text-caption font-caption text-subtext-color">
                {row.converted}/{row.total} reached rush
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-solid px-4 py-1.5 text-body font-body transition",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-neutral-border bg-white text-subtext-color hover:text-default-font",
      )}
    >
      {children}
    </button>
  );
}
