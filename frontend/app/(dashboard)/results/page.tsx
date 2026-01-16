"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeatherAlertTriangle } from "@subframe/core";
import { FeatherArrowUpDown } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherHelpCircle } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherThumbsDown } from "@subframe/core";
import { FeatherThumbsUp } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { api, API_BASE, getChapterId } from "@/lib/api";
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
  
  // Redirect if voting is disabled
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_VOTING !== "true") {
      router.push("/");
      toast({ 
        title: "Results page disabled", 
        description: "The results feature is currently disabled. See docs/VOTING_PAGE_REIMPLEMENTATION.md for details." 
      });
    }
  }, [router, toast]);
  
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

      <div className="flex w-full items-center justify-between">
        <Button icon={<FeatherDownload />} onClick={handleExport} disabled={!selectedRound}>
          Export CSV
        </Button>
      </div>

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
