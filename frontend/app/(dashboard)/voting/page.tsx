"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, PanInfo, motion } from "framer-motion";
import {
  BarChart2,
  Check,
  Clock,
  HelpCircle,
  Loader2,
  Lock,
  ShieldCheck,
  SkipForward,
  Star,
  Unlock,
  Users,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useSessionWebSocket } from "@/hooks/useSessionWebSocket";
import { Tabs } from "@/ui/components/Tabs";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { Progress } from "@/ui/components/Progress";
import { IconButton } from "@/ui/components/IconButton";
import { Avatar } from "@/ui/components/Avatar";
import { cn } from "@/lib/utils";

type PNM = {
  id: string;
  name: string;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  tags?: string[];
};

type Session = {
  id: string;
  round_id: string;
  join_code: string;
  locked?: boolean;
  votes_collected?: number;
  total_voters?: number;
  is_chair?: boolean;
};

type VoteChoice = "YES" | "NO" | "UNKNOWN";

const swipeThreshold = 80;

export default function VotingPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  // Redirect if voting is disabled
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_VOTING !== "true") {
      router.push("/");
      toast({ 
        title: "Voting page disabled", 
        description: "The voting feature is currently disabled. See docs/VOTING_PAGE_REIMPLEMENTATION.md for details." 
      });
    }
  }, [router, toast]);
  
  const [activeTab, setActiveTab] = useState<"open" | "session">("open");
  const [chapterId, setChapterId] = useState<string | null | undefined>(undefined);

  // Open voting
  const [openRoundId, setOpenRoundId] = useState<string | null>(null);
  const [openPNM, setOpenPNM] = useState<PNM | null>(null);
  const [openLoading, setOpenLoading] = useState(true);
  const [openDone, setOpenDone] = useState(false);

  // Session voting
  const [session, setSession] = useState<Session | null>(null);
  const [sessionPNM, setSessionPNM] = useState<PNM | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [startTimer, setStartTimer] = useState(180);
  const [startAnonymous, setStartAnonymous] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isChair, setIsChair] = useState(false);

  // Shared UI state
  const [dragDirection, setDragDirection] = useState<"left" | "right" | "up" | null>(null);
  const [voteStats, setVoteStats] = useState({ yes: 0, no: 0, unknown: 0, favorites: 0 });

  // Load chapter ID on mount
  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        if (cid) {
          setChapterId(cid);
        } else {
          toast({ title: "No chapters found", description: "You need to be a member of a chapter to vote" });
          setChapterId(null);
        }
      } catch (e: any) {
        console.error("Failed to load chapters:", e);
        toast({ title: "Failed to load chapter", description: e?.message || "Please refresh the page" });
        setChapterId(null);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (activeTab === "open") {
      if (chapterId === undefined) {
        // Still loading chapter - keep loading state
        setOpenLoading(true);
      } else if (chapterId === null) {
        // Chapter loading failed or no chapter - stop loading
        setOpenLoading(false);
      } else if (chapterId) {
        // Chapter loaded - start open round
        ensureOpenRound();
      }
    } else if (activeTab === "session") {
      // Load session (will skip loading state if session already exists)
      loadActiveSession(!!session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, chapterId]);

  const ensureOpenRound = async () => {
    if (!chapterId) {
      setOpenLoading(false);
      return;
    }
    setOpenLoading(true);
    try {
      const result = await api(`/rounds/open?chapter_id=${chapterId}`, { method: "POST" });
      console.log("Open round created/retrieved:", result);
      await fetchNextOpenPNM();
    } catch (e: any) {
      console.error("Failed to ensure open round:", e);
      toast({ title: "Failed to start open voting", description: e?.message || "Please try again" });
      setOpenLoading(false);
      setOpenPNM(null);
      setOpenDone(false);
    }
  };

  const fetchNextOpenPNM = async () => {
    setOpenLoading(true);
    try {
      const res = await api<{ round_id: string | null; pnm: PNM | null; no_round?: boolean; no_pnms?: boolean; all_voted?: boolean } | null>(`/rounds/open/current`);
      console.log("Fetched next open PNM:", res);

      if (!res) {
        // Legacy null response - treat as all voted
        setOpenDone(true);
        setOpenPNM(null);
        setOpenRoundId(null);
      } else if (res.no_round) {
        // No round exists - should not happen after ensureOpenRound, but handle gracefully
        setOpenDone(false);
        setOpenPNM(null);
        setOpenRoundId(null);
        toast({ title: "No open round found", description: "Please try starting a new round" });
      } else if (res.no_pnms) {
        // Round exists but has no PNMs
        setOpenDone(false);
        setOpenPNM(null);
        setOpenRoundId(res.round_id || null);
        toast({ title: "No PNMs in round", description: "Add PNMs to start voting" });
      } else if (res.all_voted || !res.pnm) {
        // All PNMs have been voted on
        setOpenDone(true);
        setOpenPNM(null);
        setOpenRoundId(res.round_id || null);
      } else {
        // PNM available for voting
        setOpenDone(false);
        setOpenPNM(res.pnm);
        setOpenRoundId(res.round_id || null);
      }
    } catch (e: any) {
      console.error("Failed to fetch next open PNM:", e);
      toast({ title: "Failed to load next PNM", description: e?.message || "Please try again" });
      setOpenDone(false);
      setOpenPNM(null);
    } finally {
      setOpenLoading(false);
    }
  };

  const loadActiveSession = async (skipLoadingState = false) => {
    if (!skipLoadingState) {
      setSessionLoading(true);
    }
    try {
      const active = await api<Session | null>(`/sessions/active`);
      if (active) {
        setSession(active);
        setIsChair(active.is_chair || false);
        await fetchSessionCurrent(active.id);
      } else {
        // Only clear session if this is the initial load (not a refresh)
        if (!skipLoadingState) {
          setSession(null);
          setSessionPNM(null);
          setIsChair(false);
        }
      }
    } catch (e: any) {
      // If 404 or null response, no active session - that's fine
      if (e?.status !== 404) {
        toast({ title: "Unable to load session", description: e?.message });
      }
      // Only clear session if this is the initial load (not a refresh)
      if (!skipLoadingState) {
        setSession(null);
        setSessionPNM(null);
        setIsChair(false);
      }
    } finally {
      if (!skipLoadingState) {
        setSessionLoading(false);
      }
    }
  };

  const fetchSessionCurrent = async (id: string) => {
    try {
      const res = await api<{ pnm: PNM | null; locked?: boolean }>(`/sessions/${id}/current`);
      setSessionPNM(res?.pnm || null);
      if (res?.locked !== undefined) {
        setSession((prev) => (prev ? { ...prev, locked: res.locked } : prev));
      }
    } catch {
      // ignore
    }
  };

  const submitVote = async (mode: "open" | "session", choice: VoteChoice, favorite = false) => {
    const target = mode === "open" ? openPNM : sessionPNM;
    const roundId = mode === "open" ? openRoundId : session?.round_id;
    if (!target || !roundId) return;

    try {
      await api(`/votes`, {
        method: "POST",
        body: {
          round_id: roundId,
          pnm_id: target.id,
          choice,
          favorite,
        },
      });
      setVoteStats((prev) => ({
        yes: choice === "YES" ? prev.yes + 1 : prev.yes,
        no: choice === "NO" ? prev.no + 1 : prev.no,
        unknown: choice === "UNKNOWN" ? prev.unknown + 1 : prev.unknown,
        favorites: favorite ? prev.favorites + 1 : prev.favorites,
      }));
      const choiceLabel = choice === "UNKNOWN" ? "Don't Know" : choice;
      toast({ title: `Voted ${choiceLabel}${favorite ? " + Favorite" : ""}` });
      if (mode === "open") {
        await fetchNextOpenPNM();
      }
    } catch (e: any) {
      toast({ title: "Vote failed", description: e?.message });
    }
  };

  const handleFavorite = async (mode: "open" | "session") => {
    const target = mode === "open" ? openPNM : sessionPNM;
    const roundId = mode === "open" ? openRoundId : session?.round_id;
    if (!target || !roundId) return;

    try {
      await api(`/votes`, {
        method: "POST",
        body: {
          round_id: roundId,
          pnm_id: target.id,
          favorite: true,
        },
      });
      setVoteStats((prev) => ({
        ...prev,
        favorites: prev.favorites + 1,
      }));
      toast({ title: "Added to favorites" });
    } catch (e: any) {
      toast({ title: "Failed to favorite", description: e?.message });
    }
  };

  const startSession = async () => {
    if (!chapterId) {
      toast({
        title: "No chapter found",
        description: chapterId === null
          ? "You need to be a member of a chapter to start a session"
          : "Please wait for chapter to load"
      });
      return;
    }
    try {
      const created = await api<Session>(`/sessions`, {
        method: "POST",
        body: {
          chapter_id: chapterId,
          timer_seconds: startTimer,
          anonymous: startAnonymous,
          swipe_mode: true,
        },
      });
      setSession(created);
      setIsChair(created.is_chair || true);
      toast({ title: "Session started", description: `Join code: ${created.join_code}` });
      await fetchSessionCurrent(created.id);
    } catch (e: any) {
      console.error("Failed to start session:", e);
      toast({ title: "Could not start session", description: e?.message || "Please try again" });
    }
  };

  const joinSession = async () => {
    if (!joinCode.trim()) return;
    try {
      const joined = await api<Session & { current_pnm?: PNM; pnm_ids?: string[]; user_votes?: Record<string, { choice: string; favorite: boolean }> }>(`/sessions/join`, {
        method: "POST",
        body: { join_code: joinCode.trim() },
      });
      setSession(joined);
      setIsChair(joined.is_chair || false);
      // Use current_pnm from join response if available
      if (joined.current_pnm) {
        setSessionPNM(joined.current_pnm);
      } else {
        await fetchSessionCurrent(joined.id);
      }
      toast({ title: "Joined session" });
    } catch (e: any) {
      toast({ title: "Join failed", description: e?.message });
    }
  };

  const toggleLock = async () => {
    if (!session) return;
    const nextLocked = !session.locked;
    try {
      await api(`/sessions/${session.id}/lock`, { method: "POST", body: { locked: nextLocked } });
      setSession({ ...session, locked: nextLocked });
      toast({ title: nextLocked ? "Session locked" : "Session unlocked" });
    } catch (e: any) {
      toast({ title: "Lock toggle failed", description: e?.message });
    }
  };

  const advanceSession = async () => {
    if (!session) return;
    try {
      const result = await api<{ success: boolean; current_pnm_id?: string | null; session_ended?: boolean; round_id?: string }>(`/sessions/${session.id}/advance`, { method: "POST" });

      if (result.session_ended) {
        // Session ended - redirect to results page
        const roundId = result.round_id || session.round_id;
        toast({
          title: "Session completed!",
          description: "All PNMs have been voted on. Redirecting to results..."
        });
        // Small delay to show toast, then redirect
        setTimeout(() => {
          router.push(`/results?roundId=${roundId}`);
        }, 1500);
      } else {
        // Session continues - fetch new current PNM
        await fetchSessionCurrent(session.id);
      }
    } catch (e: any) {
      // Check if error is because session already ended
      if (e?.message?.includes("ended") || e?.message?.includes("not found")) {
        const roundId = session.round_id;
        toast({
          title: "Session completed",
          description: "Redirecting to results..."
        });
        setTimeout(() => {
          router.push(`/results?roundId=${roundId}`);
        }, 1500);
      } else {
        toast({ title: "Advance failed", description: e?.message });
      }
    }
  };

  // WebSocket for real-time session updates
  const handleWsPnmAdvance = useCallback((pnmId: string | null, pnm: PNM | null) => {
    if (pnm) {
      setSessionPNM(pnm);
    } else if (pnmId) {
      // Fallback: fetch PNM if not included in message
      fetchSessionCurrent(session?.id || "");
    } else {
      setSessionPNM(null);
    }
  }, [session?.id]);

  const handleWsLockChange = useCallback((locked: boolean) => {
    if (session) {
      setSession({ ...session, locked });
    }
  }, [session]);

  const handleWsSessionEnd = useCallback((roundId: string) => {
    toast({
      title: "Session completed!",
      description: "All PNMs have been voted on. Redirecting to results..."
    });
    setTimeout(() => {
      router.push(`/results?roundId=${roundId}`);
    }, 1500);
  }, [router, toast]);

  const { connected: wsConnected } = useSessionWebSocket({
    sessionId: session?.id || null,
    onPnmAdvance: handleWsPnmAdvance,
    onLockChange: handleWsLockChange,
    onSessionEnd: handleWsSessionEnd,
    enabled: activeTab === "session" && !!session?.id,
  });

  // Fallback polling for when WebSocket is not connected (every 5 seconds)
  useEffect(() => {
    if (!session?.id || activeTab !== "session" || wsConnected) return;

    const interval = setInterval(() => {
      // Only refresh current PNM, don't reload entire session (avoids state resets)
      fetchSessionCurrent(session.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.id, activeTab, wsConnected]);

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setDragDirection(info.offset.y < 0 ? "up" : null);
    } else {
      setDragDirection(info.offset.x > 0 ? "right" : "left");
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > swipeThreshold) {
      submitVote(activeTab, info.offset.x > 0 ? "YES" : "NO");
    } else if (Math.abs(info.offset.y) > swipeThreshold && info.offset.y < 0) {
      submitVote(activeTab, "UNKNOWN");
    }
    setDragDirection(null);
  };

  const activePNM = activeTab === "open" ? openPNM : sessionPNM;

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs>
        <Tabs.Item active={activeTab === "open"} onClick={() => setActiveTab("open")}>
          Open Voting
        </Tabs.Item>
        <Tabs.Item active={activeTab === "session"} onClick={() => setActiveTab("session")}>
          Live Session
        </Tabs.Item>
      </Tabs>

      <div className="flex w-full flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          {activeTab === "open" && (
            <>
              {openLoading ? (
                <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-beta-gray/30 bg-white">
                  <Loader2 className="h-8 w-8 animate-spin text-beta-navy" />
                  <div className="text-sm font-medium text-beta-gray">Loading open round...</div>
                </div>
              ) : openDone ? (
                <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-beta-gray/30 bg-white p-8">
                  <ShieldCheck className="h-16 w-16 text-green-600" />
                  <div className="text-xl font-semibold text-beta-navy">All caught up</div>
                  <div className="text-center text-sm text-beta-gray">You've voted on every PNM in this round.</div>
                </div>
              ) : (
                <VoteCard
                  pnm={activePNM}
                  dragDirection={dragDirection}
                  onFavorite={() => handleFavorite("open")}
                  onVote={(choice) => submitVote("open", choice)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                />
              )}
            </>
          )}

          {activeTab === "session" && (
            <>
              {sessionLoading ? (
                <div className="flex h-96 flex-col items-center justify-center gap-4 rounded-xl border border-beta-gray/30 bg-white">
                  <Loader2 className="h-8 w-8 animate-spin text-beta-navy" />
                  <div className="text-sm font-medium text-beta-gray">Loading active session...</div>
                </div>
              ) : !session ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
                    <div className="mb-4 text-xl font-semibold text-beta-navy">Start Session</div>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 text-sm text-beta-gray">
                        <input
                          type="checkbox"
                          checked={startAnonymous}
                          onChange={(e) => setStartAnonymous(e.target.checked)}
                          className="h-4 w-4 rounded border-beta-gray/60 text-beta-navy focus:ring-beta-navy"
                        />
                        <span>Anonymous votes</span>
                      </label>
                      <div className="flex items-center gap-3 text-sm text-beta-gray">
                        <Clock className="h-5 w-5 text-beta-navy" />
                        <input
                          type="number"
                          min={30}
                          value={startTimer}
                          onChange={(e) => setStartTimer(Number(e.target.value))}
                          className="h-10 w-28 rounded-lg border border-beta-gray/60 px-3 text-sm font-medium text-beta-navy focus:ring-2 focus:ring-beta-navy"
                        />
                        <span>seconds per PNM</span>
                      </div>
                      <Button className="mt-2 w-full" onClick={startSession}>
                        Start Session
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
                    <div className="mb-4 text-xl font-semibold text-beta-navy">Join Session</div>
                    <div className="space-y-4">
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Enter join code"
                        maxLength={6}
                        className="h-12 w-full rounded-lg border border-beta-gray/60 px-4 text-center text-lg font-mono font-semibold tracking-widest text-beta-navy placeholder:text-beta-gray/50 focus:ring-2 focus:ring-beta-navy"
                      />
                      <Button className="w-full" onClick={joinSession} disabled={!joinCode.trim()}>
                        Join Session
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (

                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl border border-beta-gray/30 bg-white p-5 shadow-sm">
                    <div className="space-y-1">
                      <div className="text-xl font-semibold text-beta-navy">Live Voting Session</div>
                      <div className="flex items-center gap-2 text-sm text-beta-gray">
                        <span>Join Code:</span>
                        <span className="font-mono font-semibold tracking-widest text-beta-navy">{session.join_code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                    <Badge variant={session.locked ? "warning" : "success"} className="text-sm">
                      {session.locked ? "Locked" : "Active"}
                    </Badge>
                      <div 
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2 py-1 text-xs",
                          wsConnected 
                            ? "bg-green-100 text-green-700" 
                            : "bg-yellow-100 text-yellow-700"
                        )}
                        title={wsConnected ? "Real-time connected" : "Using fallback polling"}
                      >
                        {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {wsConnected ? "Live" : "Polling"}
                      </div>
                    </div>
                  </div>
                  {sessionPNM ? (
                    <>
                      <VoteCard
                        pnm={sessionPNM}
                        dragDirection={dragDirection}
                        disabled={session.locked}
                        onFavorite={() => handleFavorite("session")}
                        onVote={(choice) => submitVote("session", choice)}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                      />
                      {isChair && (
                        <div className="flex gap-3">
                          <Button
                            variant="neutral-secondary"
                            icon={session.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            onClick={toggleLock}
                            className="flex-1"
                          >
                            {session.locked ? "Unlock Voting" : "Lock Voting"}
                          </Button>
                          <Button
                            variant="neutral-secondary"
                            icon={<SkipForward className="h-4 w-4" />}
                            onClick={advanceSession}
                            className="flex-1"
                          >
                            Next PNM
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-beta-gray/40 bg-white">
                      <Clock className="h-10 w-10 text-beta-gray/60" />
                      <div className="text-center">
                        <div className="font-medium text-beta-navy">Waiting for chair to start voting</div>
                        <div className="mt-1 text-sm text-beta-gray">The session will begin when the chair advances to the first PNM</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="w-full space-y-4 lg:max-w-sm">
          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-beta-navy" />
              <span className="text-lg font-semibold text-beta-navy">
                {activeTab === "session" ? "Session Status" : "Round Status"}
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-beta-gray/40" />
            {activeTab === "session" && session ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-beta-gray">Votes Collected</span>
                    <span className="font-semibold text-beta-navy">
                      {session.votes_collected || 0} / {session.total_voters || 0}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, ((session.votes_collected || 0) / (session.total_voters || 1)) * 100)}
                    className="h-2"
                  />
                </div>
                <StatLine
                  label="Lock State"
                  value={session.locked ? "Locked" : "Open"}
                  icon={session.locked ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-green-600" />}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <StatLine
                  label="Status"
                  value={openDone ? "Complete" : "Open"}
                  icon={openDone ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-beta-navy" />}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <BarChart2 className="h-5 w-5 text-beta-navy" />
              <span className="text-lg font-semibold text-beta-navy">Your Progress</span>
            </div>
            <div className="mt-4 h-px w-full bg-beta-gray/40" />
            <div className="mt-4 space-y-3">
              <StatLine
                label="Yes"
                value={voteStats.yes.toString()}
                icon={<Check className="h-4 w-4 text-green-600" />}
              />
              <StatLine
                label="No"
                value={voteStats.no.toString()}
                icon={<X className="h-4 w-4 text-red-600" />}
              />
              <StatLine
                label="Don't Know"
                value={voteStats.unknown.toString()}
                icon={<HelpCircle className="h-4 w-4 text-amber-600" />}
              />
              <StatLine
                label="Favorites"
                value={voteStats.favorites.toString()}
                icon={<Star className="h-4 w-4 text-beta-navy" />}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteCard({
  pnm,
  dragDirection,
  disabled,
  onFavorite,
  onVote,
  onDrag,
  onDragEnd,
}: {
  pnm: PNM | null;
  dragDirection: "left" | "right" | "up" | null;
  disabled?: boolean;
  onFavorite: () => void;
  onVote: (choice: VoteChoice) => void;
  onDrag: (event: any, info: PanInfo) => void;
  onDragEnd: (event: any, info: PanInfo) => void;
}) {
  if (!pnm) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6 rounded-xl border border-beta-gray/30 bg-white p-6 shadow-lg">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-xl bg-beta-surface shadow-lg">
        <AnimatePresence>
          <motion.div
            key={pnm.id}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            onDrag={onDrag}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: dragDirection === "right" ? 200 : dragDirection === "left" ? -200 : 0, y: dragDirection === "up" ? -200 : 0 }}
            className="relative"
          >
            {pnm.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pnm.photo_url} alt={pnm.name} className="h-[500px] w-full object-cover" />
            ) : (
              <div className="flex h-[500px] w-full items-center justify-center bg-gradient-to-br from-beta-navy/10 to-beta-navy/5 text-6xl font-bold text-beta-navy">
                {pnm.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#162238] via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 px-6 py-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold leading-tight">{pnm.name}</h2>
                  {pnm.bio && <p className="mt-2 text-sm leading-relaxed text-white/90">{pnm.bio}</p>}
                </div>
                <IconButton
                  variant="inverse"
                  size="large"
                  icon={<Star />}
                  onClick={onFavorite}
                  className="shrink-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pnm.major && (
                  <Badge variant="neutral" className="bg-white/20 text-white backdrop-blur-sm">
                    {pnm.major}
                  </Badge>
                )}
                {pnm.hometown && (
                  <Badge variant="neutral" className="bg-white/20 text-white backdrop-blur-sm">
                    {pnm.hometown}
                  </Badge>
                )}
                {pnm.year && (
                  <Badge variant="neutral" className="bg-white/20 text-white backdrop-blur-sm">
                    {pnm.year}
                  </Badge>
                )}
                {pnm.tags && pnm.tags.length > 0 && (
                  <>
                    {pnm.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="neutral" className="bg-white/20 text-white backdrop-blur-sm">
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full items-center justify-center gap-3">
          <Button
            variant="destructive-secondary"
            size="large"
            icon={<X className="h-5 w-5" />}
            onClick={() => onVote("NO")}
            disabled={disabled}
            className="flex-1"
          >
            No
          </Button>
          <Button
            variant="neutral-secondary"
            size="large"
            icon={<HelpCircle className="h-5 w-5" />}
            onClick={() => onVote("UNKNOWN")}
            disabled={disabled}
            className="flex-1"
          >
            Don't Know
          </Button>
          <Button
            variant="brand-secondary"
            size="large"
            icon={<Check className="h-5 w-5" />}
            onClick={() => onVote("YES")}
            disabled={disabled}
            className="flex-1"
          >
            Yes
          </Button>
        </div>
        <div className="flex w-full flex-col items-center gap-2 text-center text-xs text-beta-gray">
          <span>Swipe right for Yes, left for No, up for Don't Know</span>
          {disabled && (
            <span className="text-xs font-medium text-amber-600">Voting is currently locked</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-beta-gray">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-beta-navy">{value}</span>
    </div>
  );
}
