"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  X,
  Check,
  HelpCircle,
  Star,
  Users,
  Clock,
  BarChart3,
  Lock,
  Unlock,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/subframe/Avatar";
import { Badge } from "@/components/subframe/Badge";
import { Button } from "@/components/subframe/Button";
import { IconButton } from "@/components/subframe/IconButton";
import { Progress } from "@/components/subframe/Progress";
import { Tabs } from "@/components/subframe/Tabs";

type PNM = {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  photo_url?: string | null;
  tags?: string[];
  weirdest_talent?: string;
};

type VoteMode = "open" | "session";
type SwipeDirection = "left" | "right" | "up" | null;

type VoteStats = {
  yes: number;
  no: number;
  unknown: number;
  favorites: number;
};

type Session = {
  id: string;
  join_code: string;
  locked: boolean;
  current_pnm_id?: string;
  votes_collected: number;
  total_voters: number;
};

export default function VotingPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<VoteMode>("open");
  
  // Open Voting State
  const [unvotedPNMs, setUnvotedPNMs] = useState<PNM[]>([]);
  const [currentPNM, setCurrentPNM] = useState<PNM | null>(null);
  const [openRoundId, setOpenRoundId] = useState<string | null>(null);
  
  // Live Session State
  const [session, setSession] = useState<Session | null>(null);
  const [sessionPNM, setSessionPNM] = useState<PNM | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [isChair, setIsChair] = useState(false);
  
  // UI State
  const [dragDirection, setDragDirection] = useState<SwipeDirection>(null);
  const [voteStats, setVoteStats] = useState<VoteStats>({ yes: 0, no: 0, unknown: 0, favorites: 0 });
  const [chapterId, setChapterId] = useState<string | null>(null);
  const swipeThreshold = 100;

  // Initialize - get chapter
  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string }[]>("/chapters");
        const cid = chapters[0]?.id;
        setChapterId(cid || null);
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e.message });
      }
    })();
  }, [toast]);

  // Open Voting - Load unvoted PNMs
  useEffect(() => {
    if (mode !== "open" || !chapterId) return;
    
    (async () => {
      try {
        // Ensure open round exists
        await api(`/rounds/open`, { method: "POST", body: { chapter_id: chapterId } });
        
        // Get current unvoted PNM
        const current = await api<{ pnm: PNM; round_id: string } | null>(`/rounds/open/current`);
        if (current) {
          setCurrentPNM(current.pnm);
          setOpenRoundId(current.round_id);
        } else {
          setCurrentPNM(null);
        }
      } catch (e: any) {
        toast({ title: "Failed to load voting", description: e.message });
      }
    })();
  }, [mode, chapterId, toast]);

  // Live Session - Poll for updates
  useEffect(() => {
    if (mode !== "session" || !session?.id) return;
    
    const interval = setInterval(async () => {
      try {
        const active = await api<Session>(`/sessions/active`);
        if (active) {
          setSession(active);
          if (active.current_pnm_id) {
            const pnm = await api<PNM>(`/pnms/${active.current_pnm_id}`);
            setSessionPNM(pnm);
          }
        }
      } catch (e) {
        // Silently fail
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [mode, session?.id]);

  const vote = useCallback(
    async (choice: "YES" | "NO" | "UNKNOWN", favorite = false) => {
      const pnm = mode === "open" ? currentPNM : sessionPNM;
      const roundId = mode === "open" ? openRoundId : session?.id;
      
      if (!pnm || !roundId) return;
      
      try {
        const score = choice === "YES" ? 9 : choice === "NO" ? 2 : 5;
        await api(`/votes`, {
          method: "POST",
          body: {
            round_id: roundId,
            pnm_id: pnm.id,
            score,
            is_favorite: favorite,
          },
        });
        
        setVoteStats((prev) => ({
          yes: choice === "YES" ? prev.yes + 1 : prev.yes,
          no: choice === "NO" ? prev.no + 1 : prev.no,
          unknown: choice === "UNKNOWN" ? prev.unknown + 1 : prev.unknown,
          favorites: favorite ? prev.favorites + 1 : prev.favorites,
        }));
        
        toast({ title: `Voted ${choice}${favorite ? " + Favorite" : ""}` });
        
        // Open mode: fetch next PNM
        if (mode === "open") {
          const next = await api<{ pnm: PNM; round_id: string } | null>(`/rounds/open/current`);
          setCurrentPNM(next?.pnm || null);
        }
        // Session mode: session will auto-advance or chair controls it
      } catch (e: any) {
        toast({ title: "Vote failed", description: e.message });
      }
    },
    [mode, currentPNM, sessionPNM, openRoundId, session, toast]
  );

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (direction === "right") vote("YES");
      else if (direction === "left") vote("NO");
      else if (direction === "up") vote("UNKNOWN");
      
      setDragDirection(direction);
      setTimeout(() => setDragDirection(null), 300);
    },
    [vote]
  );

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setDragDirection(info.offset.y < 0 ? "up" : null);
    } else {
      setDragDirection(info.offset.x > 0 ? "right" : "left");
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > swipeThreshold) {
      handleSwipe(info.offset.x > 0 ? "right" : "left");
    } else if (Math.abs(info.offset.y) > swipeThreshold && info.offset.y < 0) {
      handleSwipe("up");
    } else {
      setDragDirection(null);
    }
  };

  const startSession = async () => {
    if (!chapterId) return;
    try {
      const newSession = await api<Session>(`/sessions`, {
        method: "POST",
        body: { chapter_id: chapterId, anonymous: false, swipe_mode: true, timer_seconds: 30 },
      });
      setSession(newSession);
      setIsChair(true);
      toast({ title: "Session created", description: `Join code: ${newSession.join_code}` });
    } catch (e: any) {
      toast({ title: "Failed to create session", description: e.message });
    }
  };

  const joinSession = async () => {
    if (!joinCode.trim()) return;
    try {
      // Find session by join code
      const active = await api<Session>(`/sessions/active`);
      if (active && active.join_code === joinCode) {
        setSession(active);
        setIsChair(false);
        
        // Join the session
        await api(`/sessions/${active.id}/join`, { method: "POST" });
        
        toast({ title: "Joined session" });
      } else {
        throw new Error("Invalid join code");
      }
    } catch (e: any) {
      toast({ title: "Failed to join", description: e.message });
    }
  };

  const toggleLock = async () => {
    if (!session?.id || !isChair) return;
    try {
      await api(`/sessions/${session.id}/lock`, {
        method: "POST",
        body: { locked: !session.locked },
      });
      setSession((prev) => (prev ? { ...prev, locked: !prev.locked } : null));
    } catch (e: any) {
      toast({ title: "Failed to toggle lock", description: e.message });
    }
  };

  const advanceSession = async () => {
    if (!session?.id || !isChair) return;
    try {
      await api(`/sessions/${session.id}/advance`, { method: "POST" });
      toast({ title: "Advanced to next PNM" });
    } catch (e: any) {
      toast({ title: "Failed to advance", description: e.message });
    }
  };

  const activePNM = mode === "open" ? currentPNM : sessionPNM;

  return (
    <div className="flex w-full gap-6 mobile:flex-col">
      {/* Main Voting Area */}
      <div className="flex-1 space-y-6">
        {/* Mode Tabs */}
        <Tabs>
          <Tabs.Item active={mode === "open"} onClick={() => setMode("open")}>
            Open Voting
          </Tabs.Item>
          <Tabs.Item active={mode === "session"} onClick={() => setMode("session")}>
            Live Session
          </Tabs.Item>
        </Tabs>

        {/* Open Voting Mode */}
        {mode === "open" && (
          <>
            {!activePNM ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Check className="w-16 h-16 text-green-500" />
                <p className="text-xl font-semibold text-beta-navy dark:text-white">All caught up!</p>
                <p className="text-muted-foreground">You've voted on all PNMs. Great work!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-beta-navy dark:text-white">Open Voting</h1>
                    <p className="text-sm text-muted-foreground mt-1">Vote at your own pace</p>
                  </div>
                </div>

                {/* Swipe Card */}
                <div className="relative w-full max-w-[448px] mx-auto" style={{ height: "600px" }}>
                  <AnimatePresence>
                    <motion.div
                      key={activePNM.id}
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      dragElastic={0.5}
                      onDrag={(e, i) => handleDrag(e as any, i)}
                      onDragEnd={(e, i) => handleDragEnd(e as any, i)}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{
                        x: dragDirection === "right" ? 400 : dragDirection === "left" ? -400 : 0,
                        y: dragDirection === "up" ? -400 : 0,
                        rotate: dragDirection === "right" ? 20 : dragDirection === "left" ? -20 : 0,
                        opacity: 0,
                        transition: { duration: 0.3 },
                      }}
                      className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-beta-gray/30 dark:border-neutral-800 cursor-grab active:cursor-grabbing shadow-2xl bg-white dark:bg-neutral-900"
                    >
                      <div className="relative w-full h-full">
                        {activePNM.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activePNM.photo_url}
                            alt={activePNM.name}
                            className="w-full h-2/3 object-cover"
                          />
                        ) : (
                          <div className="w-full h-2/3 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center">
                            <span className="text-6xl font-bold text-neutral-300 dark:text-neutral-700">
                              {activePNM.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-beta-navy via-beta-navy/80 to-transparent p-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-2xl font-bold text-white">{activePNM.name}</h3>
                            <IconButton
                              variant="inverse"
                              size="large"
                              icon={<Star className="w-5 h-5" />}
                              onClick={() => vote("YES", true)}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {activePNM.major && (
                              <Badge variant="neutral">{activePNM.major}</Badge>
                            )}
                            {activePNM.hometown && (
                              <Badge variant="neutral">{activePNM.hometown}</Badge>
                            )}
                            {activePNM.year && <Badge variant="neutral">{activePNM.year}</Badge>}
                          </div>
                          {activePNM.weirdest_talent && (
                            <p className="text-sm text-white/90 mt-2">{activePNM.weirdest_talent}</p>
                          )}
                        </div>

                        {dragDirection && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div
                              className={cn(
                                "absolute inset-0 transition-opacity duration-200",
                                dragDirection === "right" && "bg-green-500/20",
                                dragDirection === "left" && "bg-red-500/20",
                                dragDirection === "up" && "bg-yellow-500/20"
                              )}
                            />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                              {dragDirection === "right" && (
                                <Check className="w-24 h-24 text-green-500 drop-shadow-lg" />
                              )}
                              {dragDirection === "left" && (
                                <X className="w-24 h-24 text-red-500 drop-shadow-lg" />
                              )}
                              {dragDirection === "up" && (
                                <HelpCircle className="w-24 h-24 text-yellow-500 drop-shadow-lg" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Vote Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="destructive-secondary"
                    size="large"
                    icon={<X className="w-5 h-5" />}
                    onClick={() => vote("NO")}
                  >
                    No
                  </Button>
                  <Button
                    variant="neutral-secondary"
                    size="large"
                    icon={<HelpCircle className="w-5 h-5" />}
                    onClick={() => vote("UNKNOWN")}
                  >
                    Don't Know
                  </Button>
                  <Button size="large" icon={<Check className="w-5 h-5" />} onClick={() => vote("YES")}>
                    Yes
                  </Button>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Swipe right for Yes • left for No • up for Don't Know
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the star for favorites
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* Live Session Mode */}
        {mode === "session" && (
          <>
            {!session ? (
              <div className="flex flex-col items-center justify-center gap-6 py-12">
                <h2 className="text-xl font-semibold text-beta-navy dark:text-white">No Active Session</h2>
                
                {/* Chair: Start Session */}
                <div className="w-full max-w-md space-y-4">
                  <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 p-6 space-y-4">
                    <h3 className="font-semibold text-beta-navy dark:text-white">Start a Session (Chair)</h3>
                    <Button className="w-full" onClick={startSession}>
                      Start Live Session
                    </Button>
                  </div>

                  {/* Member: Join Session */}
                  <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 p-6 space-y-4">
                    <h3 className="font-semibold text-beta-navy dark:text-white">Join Session</h3>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Enter join code..."
                      className="w-full h-10 rounded-lg border border-beta-gray/50 bg-white dark:bg-neutral-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-beta-navy"
                    />
                    <Button className="w-full" onClick={joinSession}>
                      Join Session
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-beta-navy dark:text-white">Live Voting Session</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isChair ? "You are the chair" : `Code: ${session.join_code}`}
                    </p>
                  </div>
                  <Badge>{session.locked ? "Locked" : "Active"}</Badge>
                </div>

                {sessionPNM ? (
                  <>
                    {/* Same swipe card as open mode */}
                    <div className="relative w-full max-w-[448px] mx-auto" style={{ height: "600px" }}>
                      <div className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-beta-navy/20 shadow-2xl bg-white dark:bg-neutral-900">
                        <div className="relative w-full h-full">
                          {sessionPNM.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sessionPNM.photo_url}
                              alt={sessionPNM.name}
                              className="w-full h-2/3 object-cover"
                            />
                          ) : (
                            <div className="w-full h-2/3 bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
                              <span className="text-6xl font-bold text-neutral-300">
                                {sessionPNM.name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-beta-navy p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-2xl font-bold text-white">{sessionPNM.name}</h3>
                              <IconButton
                                variant="inverse"
                                icon={<Star className="w-5 h-5" />}
                                onClick={() => vote("YES", true)}
                              />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {sessionPNM.major && <Badge variant="neutral">{sessionPNM.major}</Badge>}
                              {sessionPNM.hometown && <Badge variant="neutral">{sessionPNM.hometown}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="destructive-secondary"
                        size="large"
                        icon={<X className="w-5 h-5" />}
                        onClick={() => vote("NO")}
                        disabled={session.locked}
                      >
                        No
                      </Button>
                      <Button
                        variant="neutral-secondary"
                        size="large"
                        icon={<HelpCircle className="w-5 h-5" />}
                        onClick={() => vote("UNKNOWN")}
                        disabled={session.locked}
                      >
                        Don't Know
                      </Button>
                      <Button
                        size="large"
                        icon={<Check className="w-5 h-5" />}
                        onClick={() => vote("YES")}
                        disabled={session.locked}
                      >
                        Yes
                      </Button>
                    </div>

                    {/* Chair Controls */}
                    {isChair && (
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="neutral-secondary"
                          size="small"
                          icon={session.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          onClick={toggleLock}
                        >
                          {session.locked ? "Unlock" : "Lock"}
                        </Button>
                        <Button
                          variant="neutral-secondary"
                          size="small"
                          icon={<SkipForward className="w-4 h-4" />}
                          onClick={advanceSession}
                        >
                          Next PNM
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-96">
                    <p className="text-muted-foreground">Waiting for chair to start voting...</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Sidebar - Stats */}
      <div className="w-80 flex-none space-y-4 mobile:w-full">
        {/* Round Status */}
        <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-beta-navy dark:text-white" />
            <h3 className="font-semibold text-beta-navy dark:text-white">
              {mode === "session" ? "Session Status" : "Round Status"}
            </h3>
          </div>
          <div className="h-px bg-beta-gray/30" />
          {mode === "session" && session && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Votes Collected</span>
                <span className="text-sm font-semibold text-beta-navy dark:text-white">
                  {session.votes_collected} / {session.total_voters}
                </span>
              </div>
              <Progress value={(session.votes_collected / session.total_voters) * 100} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={session.locked ? "warning" : "success"}>
                  {session.locked ? "Locked" : "Active"}
                </Badge>
              </div>
            </div>
          )}
          {mode === "open" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="success">Open</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Your Progress */}
        <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-beta-navy dark:text-white" />
            <h3 className="font-semibold text-beta-navy dark:text-white">Your Progress</h3>
          </div>
          <div className="h-px bg-beta-gray/30" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Yes</span>
              </div>
              <span className="text-sm font-semibold text-beta-navy dark:text-white">{voteStats.yes}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-sm text-muted-foreground">No</span>
              </div>
              <span className="text-sm font-semibold text-beta-navy dark:text-white">{voteStats.no}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Don't Know</span>
              </div>
              <span className="text-sm font-semibold text-beta-navy dark:text-white">{voteStats.unknown}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-beta-navy" />
                <span className="text-sm text-muted-foreground">Favorites</span>
              </div>
              <span className="text-sm font-semibold text-beta-navy dark:text-white">{voteStats.favorites}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
