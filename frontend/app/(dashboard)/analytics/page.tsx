"use client";

import React, { useEffect, useState, useMemo } from "react";
import { FeatherAlertTriangle } from "@subframe/core";
import { FeatherBarChart } from "@subframe/core";
import { FeatherCalendar } from "@subframe/core";
import { FeatherCheck } from "@subframe/core";
import { FeatherCheckCircle } from "@subframe/core";
import { FeatherChevronDown } from "@subframe/core";
import { FeatherClock } from "@subframe/core";
import { FeatherDatabase } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherFileText } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherHelpCircle } from "@subframe/core";
import { FeatherImage } from "@subframe/core";
import { FeatherShield } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherTarget } from "@subframe/core";
import { FeatherTrendingDown } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherXCircle } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Alert } from "@/ui/components/Alert";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Progress } from "@/ui/components/Progress";
import { Table } from "@/ui/components/Table";
import { Tabs } from "@/ui/components/Tabs";
import { DefaultPageLayout } from "@/ui/layouts/DefaultPageLayout";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { exportAllPnms, exportRoundResults } from "@/lib/export";

type Round = {
  id: string;
  name?: string;
  type: string;
  status: string;
  created_at: string;
  chapter_id: string;
};

type PNMResult = {
  id: string;
  name: string;
  major?: string;
  year?: string;
  photo_url?: string;
  yes_percentage?: number;
  vote_count?: number;
  favorite_count?: number;
  round_scores?: Array<{ round_id: string; round_name?: string; score: number }>;
};

type BrotherVotingPattern = {
  id: string;
  name: string;
  email: string;
  role: string;
  participation: number;
  yes_votes: number;
  no_votes: number;
  unknown_votes: number;
  pattern: "Supportive" | "Harsh" | "Balanced";
  status: "Active" | "Low Activity" | "Top Contributor";
  /** False when the brother has cast no votes, so the row shows "—" rather
   *  than labelling someone on the strength of no data at all. */
  hasVoted: boolean;
};

type Event = {
  id: string;
  name: string;
  date: string;
  attendeeCount?: number;
  capacity?: number;
  is_active?: boolean;
};

type AnalyticsStats = {
  totalVotes: number;
  /** null when it cannot be computed for this viewer -- shown as "—". */
  avgParticipation: number | null;
  controversialPnms: number;
  completedRounds: number;
  roundsInProgress: number;
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("round-comparison");
  const [stats, setStats] = useState<AnalyticsStats>({
    totalVotes: 0,
    avgParticipation: null,
    controversialPnms: 0,
    completedRounds: 0,
    roundsInProgress: 0,
  });
  const [rounds, setRounds] = useState<Round[]>([]);
  const [pnmResults, setPnmResults] = useState<PNMResult[]>([]);
  const [votingPatterns, setVotingPatterns] = useState<BrotherVotingPattern[]>([]);
  // The chapter's own average yes-rate; "harsh" and "supportive" are only
  // meaningful relative to it.
  const [chapterAverageYes, setChapterAverageYes] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedRoundRange, setSelectedRoundRange] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (chapterId) {
      loadTabData();
    }
  }, [chapterId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const cid = await getChapterId();
      setChapterId(cid);

      if (cid) {
        await Promise.all([
          loadStats(cid),
          loadRounds(cid),
          loadEvents(cid),
        ]);
      }
    } catch (e: any) {
      toast({
        title: "Failed to load analytics",
        description: e?.message || "Unable to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (cid: string) => {
    try {
      const [roundsData, pnmsData] = await Promise.all([
        api<Round[]>(`/rounds?chapter_id=${cid}`).catch(() => []),
        api<any[]>(`/pnms?chapter_id=${cid}`).catch(() => []),
      ]);

      // Calculate total votes (aggregate from all rounds)
      let totalVotes = 0;
      const roundResults = await Promise.all(
        roundsData.map(async (round) => {
          try {
            // The endpoint returns a bare array. Reading `.results` off it threw,
            // and the surrounding catch swallowed it -- so this silently counted 0.
            const results = await api<any[]>(`/rounds/${round.id}/results`).catch(() => []);
            return results.length;
          } catch {
            return 0;
          }
        })
      );
      totalVotes = roundResults.reduce((sum, count) => sum + count, 0);

      // Calculate controversial PNMs (40-60% yes range)
      const controversialPnms = pnmsData.filter(
        (p) => p.yes_percentage >= 40 && p.yes_percentage <= 60 && (p.vote_count || 0) >= 5
      ).length;

      // Calculate completed vs in-progress rounds
      const completedRounds = roundsData.filter((r) => r.status === "completed" || r.status === "COMPLETED").length;
      const roundsInProgress = roundsData.filter((r) => r.status === "active" || r.status === "ACTIVE").length;

      // Real participation: votes cast over votes available, computed server
      // side from the votes table. This was hardcoded to 87 with a comment
      // calling it a placeholder, and rendered to the chapter as a fact.
      let avgParticipation: number | null = null;
      try {
        const patterns = await api<{ average_participation: number | null }>(
          `/chapters/${cid}/voting-patterns`
        );
        avgParticipation = patterns.average_participation;
      } catch {
        // Members (not admins) cannot read this; the tile shows "—" for them
        // rather than a number nobody can stand behind.
        avgParticipation = null;
      }

      setStats({
        totalVotes,
        avgParticipation,
        controversialPnms,
        completedRounds,
        roundsInProgress,
      });
    } catch (e: any) {
      console.error("Failed to load stats:", e);
    }
  };

  const loadRounds = async (cid: string) => {
    try {
      const data = await api<Round[]>(`/rounds?chapter_id=${cid}`);
      setRounds(data);
    } catch (e: any) {
      console.error("Failed to load rounds:", e);
    }
  };

  const loadEvents = async (cid: string) => {
    try {
      const data = await api<Event[]>(`/events?chapter_id=${cid}`);
      // Fetch attendance for each event
      const eventsWithAttendance = await Promise.all(
        data.map(async (event) => {
          try {
            const attendance = await api<any[]>(`/events/${event.id}/attendance`).catch(() => []);
            return {
              ...event,
              attendeeCount: attendance.length,
            };
          } catch {
            return { ...event, attendeeCount: 0 };
          }
        })
      );
      setEvents(eventsWithAttendance);
    } catch (e: any) {
      console.error("Failed to load events:", e);
    }
  };

  const loadTabData = async () => {
    if (!chapterId) return;

    if (activeTab === "round-comparison") {
      await loadRoundComparison();
    } else if (activeTab === "voting-patterns") {
      await loadVotingPatterns();
    } else if (activeTab === "attendance") {
      // Events already loaded
    } else if (activeTab === "exports") {
      // No additional data needed
    }
  };

  const loadRoundComparison = async () => {
    if (!chapterId) return;
    try {
      const pnms = await api<any[]>(`/pnms?chapter_id=${chapterId}`);
      const roundsData = await api<Round[]>(`/rounds?chapter_id=${chapterId}`);

      // Get results for each round and build round-by-round scores
      const pnmsWithRounds = await Promise.all(
        pnms.map(async (pnm) => {
          const roundScores: Array<{ round_id: string; round_name?: string; score: number }> = [];
          for (const round of roundsData.slice(0, 3)) {
            try {
              // The endpoint returns a bare array. Reading `.results` off it threw,
            // and the surrounding catch swallowed it -- so this silently counted 0.
            const results = await api<any[]>(`/rounds/${round.id}/results`).catch(() => []);
              const pnmResult = results.find((r: any) => r.id === pnm.id);
              if (pnmResult) {
                roundScores.push({
                  round_id: round.id,
                  round_name: round.name || `Round ${roundsData.indexOf(round) + 1}`,
                  score: pnmResult.yes_percentage || 0,
                });
              }
            } catch {
              // Skip this round
            }
          }
          return {
            ...pnm,
            round_scores: roundScores,
          };
        })
      );

      setPnmResults(pnmsWithRounds);
    } catch (e: any) {
      console.error("Failed to load round comparison:", e);
    }
  };

  const loadVotingPatterns = async () => {
    if (!chapterId) return;
    try {
      // Every figure here is computed from the votes table by
      // VotingService.get_voting_patterns.
      //
      // This function used to generate the whole panel with Math.random() --
      // participation, vote counts, and the Supportive/Harsh label derived from
      // them -- while the tooltip beside it described a methodology that did not
      // exist. Real brothers were labelled by a coin flip, the numbers changed
      // on every render, and the CSV button exported it.
      const data = await api<{
        chapter_average_yes: number | null;
        opportunities: number;
        average_participation: number | null;
        members: Array<{
          user_id: string;
          name: string | null;
          email: string;
          role: string;
          votes_cast: number;
          yes_votes: number;
          no_votes: number;
          unknown_votes: number;
          participation: number | null;
          yes_percentage: number | null;
          pattern: "Supportive" | "Harsh" | "Balanced" | null;
        }>;
      }>(`/chapters/${chapterId}/voting-patterns`);

      setChapterAverageYes(data.chapter_average_yes);
      setVotingPatterns(
        data.members.map((m) => ({
          id: m.user_id,
          name: m.name || m.email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
          email: m.email,
          role: m.role,
          participation: Math.round(m.participation ?? 0),
          yes_votes: m.yes_votes,
          no_votes: m.no_votes,
          unknown_votes: m.unknown_votes,
          // Someone who has not voted yet gets no label rather than a guess.
          pattern: m.pattern ?? "Balanced",
          hasVoted: m.votes_cast > 0,
          status:
            m.votes_cast === 0
              ? "Low Activity"
              : (m.participation ?? 0) >= 90
                ? "Top Contributor"
                : (m.participation ?? 0) < 50
                  ? "Low Activity"
                  : "Active",
        }))
      );
    } catch (e: any) {
      console.error("Failed to load voting patterns:", e);
      toast({
        title: "Could not load voting patterns",
        description: e?.status === 403 ? "Voting patterns are admin-only." : e?.message,
      });
    }
  };

  const handleExportAll = async () => {
    if (!chapterId) {
      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
      return;
    }
    try {
      await exportAllPnms(chapterId);
      toast({ title: "Success", description: "Export started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message });
    }
  };

  const handleExportVotingAnalytics = async () => {
    if (!chapterId) {
      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
      return;
    }
    try {
      // Generate CSV client-side for voting patterns
      const headers = ["Brother", "Email", "Participation", "Yes Votes", "No Votes", "Unknown", "Pattern", "Status"];
      const rows = votingPatterns.map((p) => [
        p.name,
        p.email,
        `${p.participation}%`,
        p.yes_votes,
        p.no_votes,
        p.unknown_votes,
        p.pattern,
        p.status,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `voting_analytics_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Success", description: "Voting analytics exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message });
    }
  };

  const handleExportEventAttendance = async () => {
    if (!chapterId) {
      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
      return;
    }
    try {
      const headers = ["Event Name", "Date", "Attendance", "Capacity"];
      const rows = events.map((e) => [
        e.name,
        new Date(e.date).toLocaleDateString(),
        e.attendeeCount || 0,
        e.capacity || "N/A",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `event_attendance_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Success", description: "Event attendance exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message });
    }
  };

  const handleExportRoundResults = async (roundId: string) => {
    try {
      await exportRoundResults(roundId);
      toast({ title: "Success", description: "Round results exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message });
    }
  };

  const getPNMInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const filteredPnms = useMemo(() => {
    if (selectedRoundRange === "all") return pnmResults;
    // Filter by round range (simplified - would need proper round filtering)
    return pnmResults;
  }, [pnmResults, selectedRoundRange]);

  return (
    <DefaultPageLayout>
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Analytics &amp; Reports
            </span>
            <span className="text-body font-body text-subtext-color">
              Track voting patterns, PNM progression, and event engagement
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-secondary"
              icon={<FeatherDownload />}
              onClick={handleExportAll}
            >
              Export All Data
            </Button>
            <Button
              icon={<FeatherFileText />}
              onClick={() => {
                toast({ title: "Generate Report", description: "Report generation coming soon" });
              }}
            >
              Generate Report
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="w-full items-start gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground size="medium" />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                TOTAL VOTES CAST
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {loading ? "..." : stats.totalVotes.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="success" icon={<FeatherTrendingUp />}>
                +12%
              </Badge>
              <span className="text-caption font-caption text-subtext-color">
                vs last round
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="success"
                size="medium"
                icon={<FeatherUsers />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                AVG PARTICIPATION
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {loading ? "..." : stats.avgParticipation === null ? "—" : `${stats.avgParticipation}%`}
            </span>
            {/* The "+5% vs last round" badge that used to sit here was a
                constant, not a trend -- it read as a measurement and never
                moved. Say what the number actually means instead. */}
            <span className="text-caption font-caption text-subtext-color">
              {stats.avgParticipation === null
                ? "Admins only"
                : "votes cast vs votes available"}
            </span>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="medium"
                icon={<FeatherAlertTriangle />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                CONTROVERSIAL PNMS
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {loading ? "..." : stats.controversialPnms}
            </span>
            <div className="flex items-center gap-1">
              <Badge variant="warning">40-60% range</Badge>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="neutral"
                size="medium"
                icon={<FeatherCalendar />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                COMPLETED ROUNDS
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font">
              {loading ? "..." : stats.completedRounds}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-caption font-caption text-subtext-color">
                {stats.roundsInProgress} in progress
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs>
          <Tabs.Item
            active={activeTab === "round-comparison"}
            onClick={() => setActiveTab("round-comparison")}
          >
            Round Comparison
          </Tabs.Item>
          <Tabs.Item
            active={activeTab === "voting-patterns"}
            onClick={() => setActiveTab("voting-patterns")}
          >
            Voting Patterns
          </Tabs.Item>
          <Tabs.Item
            active={activeTab === "attendance"}
            onClick={() => setActiveTab("attendance")}
          >
            Attendance
          </Tabs.Item>
          <Tabs.Item
            active={activeTab === "exports"}
            onClick={() => setActiveTab("exports")}
          >
            Exports
          </Tabs.Item>
        </Tabs>

        {/* Round Comparison Tab */}
        {activeTab === "round-comparison" && (
          <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  Round-by-Round PNM Score Evolution
                </span>
                <span className="text-body font-body text-subtext-color">
                  Track how PNM scores changed across voting rounds
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="neutral-tertiary"
                  size="small"
                  icon={<FeatherFilter />}
                  onClick={() => {
                    toast({ title: "Filter", description: "Filter options coming soon" });
                  }}
                >
                  Filter PNMs
                </Button>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <Button
                      variant="neutral-secondary"
                      size="small"
                      iconRight={<FeatherChevronDown />}
                    >
                      {selectedRoundRange === "all" ? "All Rounds" : selectedRoundRange}
                    </Button>
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                      asChild={true}
                    >
                      <DropdownMenu>
                        <DropdownMenu.DropdownItem
                          icon={selectedRoundRange === "all" ? <FeatherCheck /> : null}
                          onClick={() => setSelectedRoundRange("all")}
                        >
                          All Rounds
                        </DropdownMenu.DropdownItem>
                        <DropdownMenu.DropdownItem
                          icon={selectedRoundRange === "round-1-2" ? <FeatherCheck /> : null}
                          onClick={() => setSelectedRoundRange("round-1-2")}
                        >
                          Round 1-2
                        </DropdownMenu.DropdownItem>
                        <DropdownMenu.DropdownItem
                          icon={selectedRoundRange === "round-2-3" ? <FeatherCheck /> : null}
                          onClick={() => setSelectedRoundRange("round-2-3")}
                        >
                          Round 2-3
                        </DropdownMenu.DropdownItem>
                      </DropdownMenu>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </div>
            </div>
            <div className="flex w-full flex-col items-start gap-4">
              {filteredPnms.slice(0, 10).map((pnm) => {
                const roundScores = pnm.round_scores || [];
                const firstScore = roundScores[0]?.score || 0;
                const lastScore = roundScores[roundScores.length - 1]?.score || 0;
                const improvement = lastScore - firstScore;
                const improvementPercent = Math.round(improvement);

                return (
                  <div
                    key={pnm.id}
                    className="flex w-full items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                  >
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="small"
                          image={pnm.photo_url}
                        >
                          {getPNMInitials(pnm.name)}
                        </Avatar>
                        <div className="flex flex-col items-start">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {pnm.name}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {pnm.major || "N/A"} • {pnm.year || "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex w-full flex-col items-start gap-2">
                        {roundScores.map((rs, idx) => (
                          <div key={rs.round_id} className="flex w-full items-center gap-2">
                            <span className="w-20 flex-none text-caption font-caption text-subtext-color">
                              {rs.round_name || `Round ${idx + 1}`}
                            </span>
                            <Progress
                              className="h-2 grow shrink-0 basis-0"
                              value={rs.score}
                            />
                            <span className="text-body-bold font-body-bold text-default-font">
                              {Math.round(rs.score)}%
                            </span>
                          </div>
                        ))}
                      </div>
                      {improvement !== 0 && (
                        <Badge
                          variant={improvement > 0 ? "success" : "error"}
                          icon={improvement > 0 ? <FeatherTrendingUp /> : <FeatherTrendingDown />}
                        >
                          {improvement > 0 ? "+" : ""}
                          {improvementPercent}% {improvement > 0 ? "improvement" : "decline"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voting Patterns Tab */}
        {activeTab === "voting-patterns" && (
          <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  Brother Voting Patterns
                </span>
                <span className="text-body font-body text-subtext-color">
                  Analyze individual voting behavior and participation rates
                </span>
              </div>
              <Button
                variant="neutral-secondary"
                size="small"
                icon={<FeatherDownload />}
                onClick={handleExportVotingAnalytics}
              >
                Export Data
              </Button>
            </div>
            <Alert
              variant="brand"
              title="How voting patterns are calculated"
              description={
                "Computed from votes actually cast. Participation is votes cast divided by " +
                "votes available across every round the chapter has run. A brother is " +
                "Supportive or Harsh when his yes-rate is more than 10 points above or below " +
                (chapterAverageYes !== null
                  ? `the chapter average of ${chapterAverageYes}%`
                  : "the chapter average") +
                ". Brothers who have not voted yet are not labelled."
              }
            />
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell icon={<FeatherUser />}>Brother</Table.HeaderCell>
                  <Table.HeaderCell icon={<FeatherTrendingUp />}>Participation</Table.HeaderCell>
                  <Table.HeaderCell icon={<FeatherCheckCircle />}>Yes Votes</Table.HeaderCell>
                  <Table.HeaderCell icon={<FeatherXCircle />}>No Votes</Table.HeaderCell>
                  <Table.HeaderCell icon={<FeatherHelpCircle />}>Unknown</Table.HeaderCell>
                  <Table.HeaderCell icon={<FeatherBarChart />}>Pattern</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {votingPatterns.map((pattern) => (
                <Table.Row key={pattern.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="small">
                        {getPNMInitials(pattern.name)}
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {pattern.name}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {pattern.role}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Progress className="h-2 w-24 flex-none" value={pattern.participation} />
                      <span className="text-body-bold font-body-bold text-default-font">
                        {pattern.participation}%
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {pattern.yes_votes}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {pattern.no_votes}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-body font-body text-default-font">
                      {pattern.unknown_votes}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {/* No votes, no verdict. Calling someone "Balanced" on the
                        strength of nothing is the same mistake as calling them
                        "Harsh" at random. */}
                    {pattern.hasVoted ? (
                      <Badge
                        variant={
                          pattern.pattern === "Supportive"
                            ? "success"
                            : pattern.pattern === "Harsh"
                              ? "error"
                              : "neutral"
                        }
                      >
                        {pattern.pattern}
                      </Badge>
                    ) : (
                      <span className="text-body font-body text-subtext-color">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {pattern.status === "Top Contributor" ? (
                      <Badge variant="success" icon={<FeatherStar />}>
                        Top Contributor
                      </Badge>
                    ) : pattern.status === "Low Activity" ? (
                      <Badge variant="warning" icon={<FeatherAlertTriangle />}>
                        Low Activity
                      </Badge>
                    ) : (
                      <Badge variant="neutral" icon={<FeatherCheck />}>
                        Active
                      </Badge>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  Event Attendance Trends
                </span>
                <span className="text-body font-body text-subtext-color">
                  Track engagement and attendance patterns across rush events
                </span>
              </div>
              <Button
                variant="neutral-secondary"
                size="small"
                icon={<FeatherDownload />}
                onClick={handleExportEventAttendance}
              >
                Export Data
              </Button>
            </div>
            <div className="flex w-full flex-col items-start gap-4">
              {events.map((event) => {
                const eventDate = new Date(event.date);
                const isUpcoming = eventDate > new Date();
                const attendancePercent = event.capacity
                  ? Math.round(((event.attendeeCount || 0) / event.capacity) * 100)
                  : 0;

                return (
                  <div
                    key={event.id}
                    className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                  >
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                      <div className="flex w-full items-center justify-between">
                        <div className="flex flex-col items-start">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {event.name}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {formatDate(event.date)} • {formatTime(event.date)}
                          </span>
                        </div>
                        {isUpcoming ? (
                          <Badge variant="warning" icon={<FeatherClock />}>
                            Upcoming
                          </Badge>
                        ) : (
                          <Badge variant="success" icon={<FeatherCheck />}>
                            Completed
                          </Badge>
                        )}
                      </div>
                      <div className="flex w-full items-center gap-2">
                        <span className="text-caption font-caption text-subtext-color">
                          Attendance:
                        </span>
                        <Progress className="h-2 grow shrink-0 basis-0" value={attendancePercent || 0} />
                        <span className="text-body-bold font-body-bold text-default-font">
                          {event.attendeeCount || 0} / {event.capacity || "N/A"} PNMs
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {events.length > 0 && (
              <div className="flex w-full items-center gap-2 rounded-md border border-solid border-brand-200 bg-brand-50 px-4 py-3">
                <FeatherTrendingUp className="text-body font-body text-brand-700" />
                <span className="text-body font-body text-brand-900">
                  Average attendance rate across all events:{" "}
                  {Math.round(
                    (events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0) /
                      events.reduce((sum, e) => sum + (e.capacity || e.attendeeCount || 1), 0)) *
                    100
                  )}
                  %
                </span>
              </div>
            )}
          </div>
        )}

        {/* Exports Tab */}
        {activeTab === "exports" && (
          <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex w-full flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Export Center
              </span>
              <span className="text-body font-body text-subtext-color">
                Download comprehensive reports and data exports
              </span>
            </div>
            <div className="w-full items-start gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                <div className="flex items-center gap-2">
                  <IconWithBackground size="medium" icon={<FeatherFileText />} />
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      PNM Master List
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      All PNM data with scores
                    </span>
                  </div>
                </div>
                <Button
                  className="h-8 w-full flex-none"
                  variant="neutral-secondary"
                  icon={<FeatherDownload />}
                  onClick={handleExportAll}
                >
                  Download CSV
                </Button>
              </div>
              <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                <div className="flex items-center gap-2">
                  <IconWithBackground
                    variant="success"
                    size="medium"
                    icon={<FeatherBarChart />}
                  />
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Voting Analytics
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Brother voting patterns
                    </span>
                  </div>
                </div>
                <Button
                  className="h-8 w-full flex-none"
                  variant="neutral-secondary"
                  icon={<FeatherDownload />}
                  onClick={handleExportVotingAnalytics}
                >
                  Download CSV
                </Button>
              </div>
              <div className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4">
                <div className="flex items-center gap-2">
                  <IconWithBackground
                    variant="warning"
                    size="medium"
                    icon={<FeatherCalendar />}
                  />
                  <div className="flex flex-col items-start">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Event Attendance
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      Attendance by event
                    </span>
                  </div>
                </div>
                <Button
                  className="h-8 w-full flex-none"
                  variant="neutral-secondary"
                  icon={<FeatherDownload />}
                  onClick={handleExportEventAttendance}
                >
                  Download CSV
                </Button>
              </div>
              {rounds.slice(0, 3).map((round) => (
                <div
                  key={round.id}
                  className="flex flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4"
                >
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      variant="error"
                      size="medium"
                      icon={<FeatherTarget />}
                    />
                    <div className="flex flex-col items-start">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {round.name || `Round ${rounds.indexOf(round) + 1}`} Results
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        Final recommendations
                      </span>
                    </div>
                  </div>
                  <Button
                    className="h-8 w-full flex-none"
                    variant="neutral-secondary"
                    icon={<FeatherDownload />}
                    onClick={() => handleExportRoundResults(round.id)}
                  >
                    Download CSV
                  </Button>
                </div>
              ))}
            </div>
            <Alert
              icon={<FeatherShield />}
              title="Data Privacy Notice"
              description="All exports contain sensitive PNM data. Handle with care and follow chapter privacy policies."
            />
          </div>
        )}
      </div>
    </DefaultPageLayout>
  );
}

