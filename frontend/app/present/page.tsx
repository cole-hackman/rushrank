"use client";

import { useCallback, useEffect, useState } from "react";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import { useSessionWebSocket, type AdvanceExtra } from "@/hooks/useSessionWebSocket";

/**
 * Projector view for a live session.
 *
 * The room looks at the wall, not at phones. This page is the wall: the PNM on
 * screen, how many votes are in, the clock and the join code. It has no
 * controls, so it is safe to leave on a shared screen, and it never shows how
 * the vote is splitting: a running yes/no count in front of the room would
 * steer the votes still to come.
 */

type Pnm = {
  id: string;
  name: string;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  photo_url?: string | null;
};

type ActiveSession = {
  id: string;
  join_code: string;
  locked?: boolean;
  timer_seconds?: number | null;
};

type Current = {
  pnm: Pnm | null;
  locked?: boolean;
  timer_remaining?: number | null;
  current_votes?: number;
  eligible_voters?: number;
  position?: number | null;
  total?: number;
};

function PresentScreen() {
  const [session, setSession] = useState<ActiveSession | null | undefined>(undefined);
  const [current, setCurrent] = useState<Current | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);

  const loadCurrent = useCallback(async (id: string) => {
    try {
      const res = await api<Current>(`/sessions/${id}/current`);
      setCurrent(res);
      setTimer(res.timer_remaining ?? null);
    } catch (e: any) {
      if (e?.status === 404) {
        setEnded(true);
        setSession(null);
      }
    }
  }, []);

  // Find the chapter's live session, and keep looking while there is none so
  // the screen can be put up before the chair presses Start.
  useEffect(() => {
    if (session) return;
    let live = true;
    const look = async () => {
      try {
        const active = await api<ActiveSession | null>("/sessions/active");
        if (!live) return;
        setSession(active ?? null);
        if (active) {
          setEnded(false);
          loadCurrent(active.id);
        }
      } catch {
        if (live) setSession(null);
      }
    };
    look();
    const interval = setInterval(look, 5000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [session, loadCurrent]);

  const sessionId = session?.id ?? null;

  const { connected } = useSessionWebSocket({
    sessionId,
    enabled: !!sessionId,
    onPnmAdvance: (_id, pnm, extra?: AdvanceExtra) => {
      setCurrent((prev) => ({
        ...(prev ?? { pnm: null }),
        pnm: (pnm as Pnm | null) ?? null,
        current_votes: 0,
        position: extra?.position ?? prev?.position,
        total: extra?.total ?? prev?.total,
      }));
      if (extra?.timer_remaining !== undefined) setTimer(extra.timer_remaining ?? null);
    },
    onVoteCast: (pnmId, tallies) => {
      if (!tallies) return;
      const votes = tallies.yes + tallies.no + tallies.unknown;
      setCurrent((prev) => (prev?.pnm?.id === pnmId ? { ...prev, current_votes: votes } : prev));
    },
    onLockChange: (locked) => {
      setCurrent((prev) => (prev ? { ...prev, locked } : prev));
      if (!locked && sessionId) loadCurrent(sessionId);
    },
    onSessionEnd: () => {
      setEnded(true);
      setSession(null);
      setCurrent(null);
    },
  });

  // The socket carries every change; this is the net under it.
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => loadCurrent(sessionId), connected ? 15000 : 4000);
    return () => clearInterval(interval);
  }, [sessionId, connected, loadCurrent]);

  useEffect(() => {
    if (timer === null || timer <= 0) return;
    const t = setTimeout(() => setTimer((v) => (v === null ? null : Math.max(0, v - 1))), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const pnm = current?.pnm ?? null;
  const votes = current?.current_votes ?? 0;
  const eligible = current?.eligible_voters ?? 0;
  const share = eligible > 0 ? Math.min(100, Math.round((votes / eligible) * 100)) : 0;
  const timeUp = !!session?.timer_seconds && timer === 0;
  const closed = !!current?.locked || timeUp;
  const details = [pnm?.year, pnm?.major, pnm?.hometown].filter(Boolean).join(" · ");

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between gap-6 px-6 py-4 sm:px-10">
        <span className="text-lg font-semibold tracking-wide text-white/80">RushRank</span>
        {session && (
          <div className="flex items-center gap-6 text-right">
            {current?.position && current?.total ? (
              <span className="text-lg text-white/70">
                {current.position} of {current.total}
              </span>
            ) : null}
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Join code</div>
              <div className="font-mono text-3xl font-bold tracking-[0.2em]">{session.join_code}</div>
            </div>
          </div>
        )}
      </header>

      {session === undefined ? (
        <Centered title="Loading" />
      ) : !session ? (
        <Centered
          title={ended ? "The session has ended" : "No live session yet"}
          detail={
            ended
              ? "Results are on the Results page."
              : "This screen will start showing PNMs as soon as the chair starts a session."
          }
        />
      ) : !pnm ? (
        <Centered title="Waiting for the chair" detail="The first PNM will appear here." />
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 lg:flex-row lg:gap-16 lg:px-16">
          <div className="aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl bg-neutral-800 lg:max-h-[72vh] lg:w-auto lg:max-w-none lg:flex-none lg:h-[72vh]">
            {pnm.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pnm.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-8xl font-bold text-white/30">
                {pnm.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
          </div>

          <div className="flex w-full max-w-2xl flex-col gap-8">
            <div>
              <h1 className="text-5xl font-bold leading-tight sm:text-7xl">{pnm.name}</h1>
              {details && <p className="mt-4 text-2xl text-white/70 sm:text-3xl">{details}</p>}
            </div>

            <div aria-live="polite">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl text-white/70">Votes in</span>
                <span className="text-5xl font-bold tabular-nums">
                  {votes}
                  {eligible > 0 && <span className="text-3xl font-medium text-white/50"> of {eligible}</span>}
                </span>
              </div>
              <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500"
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {timer !== null && (
                <span
                  className={`rounded-2xl px-6 py-3 font-mono text-5xl font-bold tabular-nums ${
                    timer <= 15 ? "bg-amber-400 text-neutral-950" : "bg-white/10"
                  }`}
                >
                  {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
                </span>
              )}
              {closed && (
                <span className="rounded-2xl bg-white px-6 py-3 text-2xl font-semibold text-neutral-950">
                  {timeUp && !current?.locked ? "Time is up" : "Voting is locked"}
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Centered({ title, detail }: { title: string; detail?: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold sm:text-6xl">{title}</h1>
      {detail && <p className="max-w-xl text-xl text-white/70 sm:text-2xl">{detail}</p>}
      <p className="max-w-xl text-base text-white/50">
        This screen is for the room. Brothers vote on their own phones, under Voting.
      </p>
    </section>
  );
}

export default function PresentPage() {
  return (
    <Protected>
      <PresentScreen />
    </Protected>
  );
}
