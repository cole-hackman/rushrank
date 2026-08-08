"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { FeatherArrowUpDown } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherHelpCircle } from "@subframe/core";
import { FeatherScissors } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherThumbsDown } from "@subframe/core";
import { FeatherThumbsUp } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherX } from "@subframe/core";
import {
  api,
  API_BASE,
  applyCutoff,
  getChapterId,
  type CutoffMode,
  type CutoffResult,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Badge } from "@/ui/components/Badge";
import { Progress } from "@/ui/components/Progress";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { Checkbox } from "@/ui/components/Checkbox";
import { Avatar } from "@/ui/components/Avatar";
import { cn } from "@/lib/utils";

type Round = { id: string; created_at: string; name?: string };
type PNMResult = {
  id: string;
  name: string;
  major?: string | null;
  yes_percentage: number;
  vote_count: number;
  yes_count?: number;
  no_count?: number;
  dont_know_count?: number;
  favorite_count: number;
  photo_url?: string | null;
};

type SortKey = "rank" | "name" | "yes_percentage" | "favorites";

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [results, setResults] = useState<PNMResult[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [highYesOnly, setHighYesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showCutoff, setShowCutoff] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e?.message });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (chapterId) {
      (async () => {
        try {
          const roundData = await api<Round[]>(`/rounds?chapter_id=${chapterId}`);
          setRounds(roundData);

          // Check if roundId is in URL query params
          const roundIdFromUrl = searchParams.get("roundId");
          if (roundIdFromUrl && roundData.some(r => r.id === roundIdFromUrl)) {
            // Auto-select the round from URL
            setSelectedRound(roundIdFromUrl);
            fetchResults(roundIdFromUrl);
          }
        } catch (e: any) {
          toast({ title: "Unable to load rounds", description: e?.message });
        }
      })();
    }
  }, [chapterId, toast, searchParams]);

  const fetchResults = async (roundId: string) => {
    setSelectedRound(roundId);
    if (!roundId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<PNMResult[]>(`/rounds/${roundId}/results`);
      setResults(data);
    } catch (e: any) {
      const message = e?.message || "Failed to load results";
      setError(message);
      toast({ title: "Failed to load results", description: message });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = results.length;
    const avgYes =
      total > 0
        ? Math.round(results.reduce((sum, r) => sum + (r.yes_percentage || 0), 0) / total)
        : 0;
    const favorites = results.filter((r) => (r.favorite_count || 0) > 0).length;
    const controversial = results.filter(
      (r) => r.yes_percentage >= 40 && r.yes_percentage <= 60 && (r.vote_count || 0) >= 5
    ).length;
    return { total, avgYes, favorites, controversial };
  }, [results]);

  const filteredResults = useMemo(() => {
    let data = [...results];
    const term = search.trim().toLowerCase();
    if (term) {
      data = data.filter(
        (r) => r.name.toLowerCase().includes(term) || r.major?.toLowerCase().includes(term)
      );
    }
    if (favoritesOnly) data = data.filter((r) => r.favorite_count > 0);
    if (highYesOnly) data = data.filter((r) => r.yes_percentage >= 70);

    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "yes_percentage")
        return ((a.yes_percentage || 0) - (b.yes_percentage || 0)) * dir;
      if (sortKey === "favorites")
        return ((a.favorite_count || 0) - (b.favorite_count || 0)) * dir;
      return dir; // rank is just array order
    });
    return data;
  }, [results, search, favoritesOnly, highYesOnly, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    if (!selectedRound) return;
    router.push(`/exports?roundId=${selectedRound}`);
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Results
        </span>
        <span className="text-body font-body text-subtext-color">
          View voting results and analytics for each round
        </span>
      </div>

      <div className="flex w-full flex-wrap items-center gap-3">
        <Button icon={<FeatherDownload />} onClick={handleExport} disabled={!selectedRound}>
          Export CSV
        </Button>
        <Button
          variant="destructive-secondary"
          icon={<FeatherScissors />}
          disabled={!selectedRound || results.length === 0}
          onClick={() => setShowCutoff(true)}
        >
          Make cuts
        </Button>
      </div>

      {showCutoff && selectedRound && (
        <CutoffModal
          roundId={selectedRound}
          results={results}
          onClose={() => setShowCutoff(false)}
          onDone={(next) => {
            setShowCutoff(false);
            toast({
              title: "Cuts applied",
              description: `${next.advanced_count} advanced to the next round.`,
            });
            router.push(`/results?roundId=${next.next_round_id}`);
          }}
        />
      )}

      <div className="w-full items-start gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total PNMs" value={stats.total} icon={<FeatherUsers />} tone="neutral" />
        <StatCard label="Avg Yes %" value={`${stats.avgYes}%`} icon={<FeatherTrendingUp />} tone="success" />
        <StatCard label="Favorites" value={stats.favorites} icon={<FeatherStar />} tone="brand" />
        <StatCard label="Controversial" value={stats.controversial} icon={<FeatherAlertTriangle />} tone="warning" />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <select
              className="h-10 w-full rounded-lg border border-solid border-neutral-border bg-white px-3 text-body font-body text-default-font focus:outline-none focus:ring-2 focus:ring-brand-600"
              value={selectedRound}
              onChange={(e) => fetchResults(e.target.value)}
            >
              <option value="">Select a round...</option>
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name || `Round ${round.id.slice(0, 6)}`} ·{" "}
                  {new Date(round.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          {selectedRound && (
            <>
              <div className="min-w-[220px] flex-1">
                <TextField icon={<FeatherSearch />}>
                  <TextField.Input
                    placeholder="Search PNMs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </TextField>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox label="Favorites only" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
                <Checkbox label="Yes % ≥ 70%" checked={highYesOnly} onCheckedChange={setHighYesOnly} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col rounded-lg border border-solid border-neutral-border bg-white shadow-sm">
        {loading && (
          <div className="flex h-48 items-center justify-center text-subtext-color">
            <span className="text-body font-body">Loading results...</span>
          </div>
        )}
        {error && !loading && (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-subtext-color">
            <span className="text-body font-body">{error}</span>
            <Button variant="neutral-secondary" onClick={() => fetchResults(selectedRound)}>
              Retry
            </Button>
          </div>
        )}
        {!loading && !error && (
          <Table
            header={
              <thead>
                <Table.HeaderRow>
                  <Table.HeaderCell onClick={() => toggleSort("rank")} className="cursor-pointer">
                    Rank <FeatherArrowUpDown className="ml-1 inline h-3 w-3" />
                  </Table.HeaderCell>
                  <Table.HeaderCell onClick={() => toggleSort("name")} className="cursor-pointer">
                    PNM
                  </Table.HeaderCell>
                  <Table.HeaderCell onClick={() => toggleSort("yes_percentage")} className="cursor-pointer">
                    Score
                  </Table.HeaderCell>
                  <Table.HeaderCell>Yes</Table.HeaderCell>
                  <Table.HeaderCell>No</Table.HeaderCell>
                  <Table.HeaderCell>Unknown</Table.HeaderCell>
                  <Table.HeaderCell onClick={() => toggleSort("favorites")} className="cursor-pointer">
                    Favorites
                  </Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.HeaderRow>
              </thead>
            }
          >
            {filteredResults.map((pnm, index) => {
              const yes = pnm.yes_percentage || 0;
              const isTop = yes >= 85;
              const isStrong = yes >= 70 && yes < 85;
              const isControversial = yes >= 40 && yes <= 60;
              return (
                <Table.Row key={pnm.id}>
                  <Table.Cell className="text-body-bold font-body-bold text-default-font">{index + 1}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="small" image={pnm.photo_url || undefined}>
                        {pnm.name.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-body-bold font-body-bold text-default-font">{pnm.name}</span>
                        {pnm.major && <span className="text-caption font-caption text-subtext-color">{pnm.major}</span>}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Progress value={yes} className="w-16" />
                      <span
                        className={cn(
                          "text-caption-bold font-caption-bold",
                          yes >= 80 ? "text-success-600" : yes >= 60 ? "text-default-font" : "text-subtext-color"
                        )}
                      >
                        {Math.round(yes)}%
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1 text-success-700">
                      <FeatherThumbsUp className="h-4 w-4" />
                      <span className="text-body font-body">{pnm.yes_count || 0}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1 text-error-600">
                      <FeatherThumbsDown className="h-4 w-4" />
                      <span className="text-body font-body">{pnm.no_count || 0}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1 text-subtext-color">
                      <FeatherHelpCircle className="h-4 w-4" />
                      <span className="text-body font-body">{pnm.dont_know_count || 0}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-body-bold font-body-bold text-default-font">
                    {pnm.favorite_count || 0}
                  </Table.Cell>
                  <Table.Cell>
                    {isTop && <Badge variant="success">Top Choice</Badge>}
                    {isStrong && !isTop && <Badge variant="success">Strong</Badge>}
                    {isControversial && <Badge variant="warning">Controversial</Badge>}
                    {!isTop && !isStrong && !isControversial && <Badge variant="neutral">Moderate</Badge>}
                  </Table.Cell>
                </Table.Row>
              );
            })}
            {filteredResults.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-subtext-color">
                  <span className="text-body font-body">
                    {selectedRound ? "No PNMs match your filters." : "Select a round to view results."}
                  </span>
                </td>
              </tr>
            )}
          </Table>
        )}
      </div>
    </div>
  );
}

/**
 * Advance the top of this round into the next one.
 *
 * The preview is computed twice on purpose. Locally, so moving the slider is
 * instant and the chair can feel where the line falls; then again on the server
 * as a dry run before anything is written, because the server's split is the
 * one that will execute. If the two ever disagree, the server's number is what
 * the confirm button shows.
 */
function CutoffModal({
  roundId,
  results,
  onClose,
  onDone,
}: {
  roundId: string;
  results: PNMResult[];
  onClose: () => void;
  onDone: (result: CutoffResult) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<CutoffMode>("top_n");
  const [value, setValue] = useState<number>(Math.max(1, Math.ceil(results.length / 2)));
  const [archiveCut, setArchiveCut] = useState(false);
  const [confirming, setConfirming] = useState<CutoffResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Mirrors the server's rule, ties included: everyone level with the boundary
  // advances. Cutting one of three identical scores is a person, not a rounding
  // detail.
  const localSplit = useMemo(() => {
    const ranked = [...results].sort((a, b) => (b.yes_percentage || 0) - (a.yes_percentage || 0));
    if (mode === "top_n") {
      const n = Math.max(1, Math.floor(value));
      if (n >= ranked.length) return { advanced: ranked, cut: [] as PNMResult[] };
      const threshold = ranked[n - 1].yes_percentage || 0;
      return {
        advanced: ranked.filter((r) => (r.yes_percentage || 0) >= threshold),
        cut: ranked.filter((r) => (r.yes_percentage || 0) < threshold),
      };
    }
    return {
      advanced: ranked.filter((r) => (r.yes_percentage || 0) >= value),
      cut: ranked.filter((r) => (r.yes_percentage || 0) < value),
    };
  }, [results, mode, value]);

  const tied = mode === "top_n" && localSplit.advanced.length > Math.floor(value);

  const preview = async () => {
    setBusy(true);
    try {
      const result = await applyCutoff(roundId, { mode, value, dry_run: true });
      setConfirming(result);
    } catch (e: any) {
      toast({ title: "Could not preview the cut", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const result = await applyCutoff(roundId, {
        mode,
        value,
        archive_cut: archiveCut,
        dry_run: false,
      });
      onDone(result);
    } catch (e: any) {
      toast({ title: "Could not apply the cut", description: e?.message });
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-solid border-neutral-border px-6 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-heading-2 font-heading-2 text-default-font">
              {confirming ? "Confirm cuts" : "Make cuts"}
            </span>
            <span className="text-body font-body text-subtext-color">
              {confirming
                ? "This ends the round and starts a new one with everyone who advances."
                : "Everyone who advances is carried into a new round."}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm p-1 text-subtext-color hover:text-default-font"
          >
            <FeatherX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {!confirming && (
            <>
              <div className="flex gap-2">
                {([
                  { key: "top_n" as const, label: "Advance top N" },
                  { key: "min_yes_pct" as const, label: "Cut below a %" },
                ]).map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setMode(option.key);
                      setValue(option.key === "top_n" ? Math.max(1, Math.ceil(results.length / 2)) : 50);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border border-solid px-4 py-2 text-body font-body transition",
                      mode === option.key
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-neutral-border bg-white text-subtext-color hover:text-default-font",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  {mode === "top_n" ? "How many advance" : "Minimum yes percentage"}
                </span>
                <input
                  type="range"
                  min={mode === "top_n" ? 1 : 0}
                  max={mode === "top_n" ? results.length : 100}
                  step={mode === "top_n" ? 1 : 5}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <span className="text-heading-2 font-heading-2 text-default-font">
                  {mode === "top_n" ? `Top ${Math.floor(value)}` : `${value}% yes or better`}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-solid border-success-200 bg-success-50 px-4 py-3">
                  <span className="text-caption-bold font-caption-bold text-success-700">Advancing</span>
                  <div className="text-heading-1 font-heading-1 text-success-700">
                    {localSplit.advanced.length}
                  </div>
                </div>
                <div className="rounded-lg border border-solid border-neutral-border bg-neutral-50 px-4 py-3">
                  <span className="text-caption-bold font-caption-bold text-subtext-color">Cut</span>
                  <div className="text-heading-1 font-heading-1 text-default-font">
                    {localSplit.cut.length}
                  </div>
                </div>
              </div>

              {tied && (
                <div className="flex items-start gap-2 rounded-lg border border-solid border-warning-200 bg-warning-50 p-3">
                  <FeatherAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
                  <span className="text-body font-body text-warning-700">
                    {localSplit.advanced.length - Math.floor(value)} extra PNM(s) are tied at the
                    cutoff score and advance too, rather than being split arbitrarily.
                  </span>
                </div>
              )}

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={archiveCut}
                  onChange={(e) => setArchiveCut(e.target.checked)}
                  className="mt-1 accent-brand-600"
                />
                <span className="text-body font-body text-subtext-color">
                  Also archive the {localSplit.cut.length} PNM(s) who are cut, hiding them from the
                  main list. You can unarchive them later.
                </span>
              </label>
            </>
          )}

          {confirming && (
            <>
              <div className="rounded-lg border border-solid border-neutral-border bg-neutral-50 p-4">
                <span className="text-body font-body text-default-font">
                  <span className="text-body-bold font-body-bold">{confirming.advanced_count}</span>{" "}
                  advance to a new round.{" "}
                  <span className="text-body-bold font-body-bold">{confirming.cut_count}</span> are
                  cut{archiveCut ? " and archived" : ""}.
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  Being cut
                </span>
                <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-solid border-neutral-border p-3">
                  {confirming.cut.map((pnm) => (
                    <li
                      key={pnm.id}
                      className="flex items-center justify-between text-body font-body text-default-font"
                    >
                      <span>{pnm.name}</span>
                      <span className="text-subtext-color">
                        {Math.round(pnm.yes_percentage)}%
                      </span>
                    </li>
                  ))}
                  {confirming.cut.length === 0 && (
                    <li className="text-body font-body text-subtext-color">Nobody.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-solid border-neutral-border px-6 py-4">
          {confirming ? (
            <>
              <Button variant="neutral-secondary" onClick={() => setConfirming(null)} disabled={busy}>
                Back
              </Button>
              <Button variant="destructive-primary" loading={busy} onClick={commit}>
                Cut {confirming.cut_count} and start next round
              </Button>
            </>
          ) : (
            <>
              <Button variant="neutral-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                loading={busy}
                disabled={localSplit.advanced.length === 0}
                onClick={preview}
              >
                Review
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "neutral" | "success" | "brand" | "warning";
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <IconWithBackground
          size="medium"
          variant={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "brand" ? "brand" : "neutral"}
          icon={icon}
        />
        <span className="text-caption-bold font-caption-bold text-subtext-color">{label}</span>
      </div>
      <span className="text-heading-1 font-heading-1 text-default-font">{value}</span>
    </div>
  );
}
