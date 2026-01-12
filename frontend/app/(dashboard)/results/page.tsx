"use client";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import {
  Download,
  Users,
  TrendingUp,
  Star,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  CheckCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/subframe/Avatar";
import { Badge } from "@/components/subframe/Badge";
import { Button } from "@/components/subframe/Button";
import { IconWithBackground } from "@/components/subframe/IconWithBackground";
import { Progress } from "@/components/subframe/Progress";
import { Table } from "@/components/subframe/Table";
import { TextField } from "@/components/subframe/TextField";
import { Checkbox } from "@/components/subframe/Checkbox";

type Round = { id: string; created_at: string; type?: string };
type PNMResult = {
  id: string;
  name: string;
  major?: string;
  yes_percentage: number;
  vote_count: number;
  yes_count?: number;
  no_count?: number;
  dont_know_count?: number;
  favorite_count: number;
  photo_url?: string | null;
};

type Stats = {
  total_pnms: number;
  avg_yes_percentage: number;
  favorites: number;
  controversial: number;
};

export default function ResultsPage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState<string>("");
  const [results, setResults] = useState<PNMResult[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minYesPercent, setMinYesPercent] = useState(false); // ≥ 70%
  const [stats, setStats] = useState<Stats>({ total_pnms: 0, avg_yes_percentage: 0, favorites: 0, controversial: 0 });

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);
        if (cid) {
          const r = await api<any[]>(`/rounds?chapter_id=${cid}`);
          setRounds(r.map((x) => ({ id: x.id, created_at: x.created_at, type: x.type })));
        }
      } catch (e: any) {
        toast({ title: "Failed to load rounds", description: e.message });
      }
    })();
  }, [toast]);

  async function loadResults(id: string) {
    setRoundId(id);
    try {
      const res = await api<PNMResult[]>(`/rounds/${id}/results`);
      setResults(res);
      
      const total = res.length;
      const avgYes = total > 0 ? res.reduce((sum, r) => sum + r.yes_percentage, 0) / total : 0;
      const favs = res.filter((r) => r.favorite_count && r.favorite_count > 0).length;
      const controversial = res.filter(
        (r) => r.yes_percentage >= 40 && r.yes_percentage <= 60 && r.vote_count >= 5
      ).length;
      
      setStats({
        total_pnms: total,
        avg_yes_percentage: Math.round(avgYes),
        favorites: favs,
        controversial,
      });
    } catch (e: any) {
      toast({ title: "Failed to load results", description: e.message });
    }
  }

  const filteredResults = useMemo(() => {
    let result = results;
    
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.name.toLowerCase().includes(s) || r.major?.toLowerCase().includes(s)
      );
    }
    
    if (favoritesOnly) {
      result = result.filter((r) => r.favorite_count > 0);
    }
    
    if (minYesPercent) {
      result = result.filter((r) => r.yes_percentage >= 70);
    }
    
    return result;
  }, [results, search, favoritesOnly, minYesPercent]);

  return (
    <div className="flex h-full w-full flex-col gap-8">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <h1 className="text-3xl font-bold text-beta-navy dark:text-white">Round Results</h1>
        {roundId && (
          <Button
            icon={<Download className="w-4 h-4" />}
            onClick={() => {
              window.open(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/export/csv?entity=results&roundId=${roundId}`,
                "_blank"
              );
            }}
          >
            Export CSV
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      {roundId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-6 py-6">
            <div className="flex items-center gap-2">
              <IconWithBackground variant="neutral" size="small" icon={<Users className="w-4 h-4" />} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Total PNMs
              </span>
            </div>
            <span className="text-3xl font-bold text-beta-navy dark:text-white">{stats.total_pnms}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-green-100 dark:bg-green-900/30 px-6 py-6">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="small"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                Avg Yes %
              </span>
            </div>
            <span className="text-3xl font-bold text-green-700 dark:text-green-300">
              {stats.avg_yes_percentage}%
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 px-6 py-6">
            <div className="flex items-center gap-2">
              <IconWithBackground size="small" icon={<Star className="w-4 h-4" />} />
              <span className="text-xs font-semibold text-beta-navy dark:text-blue-300 uppercase tracking-wide">
                Favorites
              </span>
            </div>
            <span className="text-3xl font-bold text-beta-navy dark:text-blue-300">{stats.favorites}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 px-6 py-6">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="small"
                icon={<AlertTriangle className="w-4 h-4" />}
              />
              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
                Controversial
              </span>
            </div>
            <span className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
              {stats.controversial}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</span>
        </div>
        <div className="flex w-full items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <select
              className="h-10 w-full rounded-lg border border-beta-gray/50 bg-white dark:bg-neutral-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-beta-navy"
              value={roundId}
              onChange={(e) => loadResults(e.target.value)}
            >
              <option value="">Select a round...</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.type || r.id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          {roundId && (
            <>
              <TextField icon={<Search className="w-4 h-4" />} className="flex-1 min-w-[200px]">
                <TextField.Input
                  placeholder="Search PNMs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </TextField>
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Favorites only"
                  checked={favoritesOnly}
                  onCheckedChange={setFavoritesOnly}
                />
                <Checkbox
                  label="Yes % ≥ 70%"
                  checked={minYesPercent}
                  onCheckedChange={setMinYesPercent}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="flex w-full flex-col rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 shadow-sm overflow-auto">
        <Table
          header={
            <thead>
              <Table.HeaderRow>
                <Table.HeaderCell>Rank</Table.HeaderCell>
                <Table.HeaderCell>PNM</Table.HeaderCell>
                <Table.HeaderCell>Score</Table.HeaderCell>
                <Table.HeaderCell>Yes</Table.HeaderCell>
                <Table.HeaderCell>No</Table.HeaderCell>
                <Table.HeaderCell>Unknown</Table.HeaderCell>
                <Table.HeaderCell>Favorites</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.HeaderRow>
            </thead>
          }
        >
          {filteredResults.map((pnm, index) => {
            const isTopChoice = pnm.yes_percentage >= 85;
            const isStrong = pnm.yes_percentage >= 70 && pnm.yes_percentage < 85;
            const isControversial = pnm.yes_percentage >= 40 && pnm.yes_percentage <= 60;

            return (
              <Table.Row key={pnm.id}>
                <Table.Cell>
                  <span className="font-bold text-beta-navy dark:text-white">{index + 1}</span>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Avatar size="small" image={pnm.photo_url || undefined}>
                      {pnm.name.slice(0, 2).toUpperCase()}
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold text-beta-navy dark:text-white whitespace-nowrap">
                        {pnm.name}
                      </span>
                      {pnm.major && (
                        <span className="text-xs text-muted-foreground">{pnm.major}</span>
                      )}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Progress value={pnm.yes_percentage} className="w-16" />
                    <span
                      className={cn(
                        "font-semibold whitespace-nowrap",
                        pnm.yes_percentage >= 80
                          ? "text-green-600"
                          : pnm.yes_percentage >= 60
                          ? "text-beta-navy"
                          : "text-muted-foreground"
                      )}
                    >
                      {Math.round(pnm.yes_percentage)}%
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    <span>{pnm.yes_count || 0}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <ThumbsDown className="w-4 h-4 text-red-600" />
                    <span>{pnm.no_count || 0}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <HelpCircle className="w-4 h-4 text-neutral-400" />
                    <span>{pnm.dont_know_count || 0}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-beta-navy" />
                    <span className="font-semibold text-beta-navy dark:text-blue-300">
                      {pnm.favorite_count || 0}
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {isTopChoice && (
                    <Badge variant="success" icon={<CheckCircle className="w-3 h-3" />}>
                      Top Choice
                    </Badge>
                  )}
                  {isStrong && <Badge variant="success">Strong</Badge>}
                  {isControversial && (
                    <Badge variant="warning" icon={<AlertTriangle className="w-3 h-3" />}>
                      Controversial
                    </Badge>
                  )}
                  {!isTopChoice && !isStrong && !isControversial && (
                    <Badge variant="neutral">Moderate</Badge>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
          {filteredResults.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                {roundId ? "No PNMs match your filters." : "Select a round to view results."}
              </td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}
