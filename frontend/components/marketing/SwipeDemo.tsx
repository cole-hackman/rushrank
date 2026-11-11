"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { DEMO_PNMS, type DemoPnm } from "@/lib/demo-data";

type Decision = "up" | "down";

// Which way the last card left, so the exit animation follows the swipe.
// 1 = right (bid), -1 = left (pass).
type ExitDirection = 1 | -1;

const cardVariants = {
  exit: (dir: ExitDirection) => ({
    x: dir * 420,
    rotate: dir * 18,
    opacity: 0,
    transition: { duration: 0.28, ease: "easeIn" as const },
  }),
};

function Card({
  pnm,
  onDecide,
  isTop,
  starred,
}: {
  pnm: DemoPnm;
  onDecide: (d: Decision) => void;
  isTop: boolean;
  starred: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const upOpacity = useTransform(x, [40, 140], [0, 1]);
  const downOpacity = useTransform(x, [-140, -40], [1, 0]);

  return (
    <motion.div
      style={{ x, rotate }}
      // Cards used to vanish the instant they were decided: AnimatePresence
      // was there but no card had an exit. Now they fly off the way they went.
      variants={cardVariants}
      exit="exit"
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onDecide("up");
        else if (info.offset.x < -120) onDecide("down");
      }}
      className="absolute inset-0 select-none rounded-3xl border border-border bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(10,10,10,0.25)]"
    >
      <div className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-surface-muted">
        <Image src={pnm.photo} alt={pnm.name} fill className="object-cover" />
        <motion.div
          style={{ opacity: upOpacity }}
          className="absolute left-4 top-4 rounded-md border-2 border-success px-2 py-1 text-sm font-semibold text-success"
        >
          BID
        </motion.div>
        <motion.div
          style={{ opacity: downOpacity }}
          className="absolute right-4 top-4 rounded-md border-2 border-danger px-2 py-1 text-sm font-semibold text-danger"
        >
          PASS
        </motion.div>
        {starred && (
          <div
            className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-surface text-lg text-fg shadow"
            aria-label="Starred"
          >
            ★
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="font-serif text-2xl text-fg">{pnm.name}</div>
        <div className="text-sm text-muted-foreground">
          {pnm.year} · {pnm.major} · GPA {pnm.gpa.toFixed(2)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {pnm.tags.map((t) => (
            <span key={t} className="rounded-full bg-accent-soft px-2 py-1 text-xs text-accent-text">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function SwipeDemo() {
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState({ up: 0, down: 0, star: 0 });
  const [direction, setDirection] = useState<ExitDirection>(1);
  // Starring marks a favourite without deciding, as it does in the real app,
  // so it is per card and does not advance the deck.
  const [starred, setStarred] = useState<Set<string>>(() => new Set());

  const deck = useMemo(() => DEMO_PNMS, []);
  const visible = deck.slice(index, index + 3);

  function decide(d: Decision) {
    setDirection(d === "up" ? 1 : -1);
    setTally((t) => ({ ...t, [d]: t[d] + 1 }));
    setIndex((i) => Math.min(i + 1, deck.length));
  }

  function toggleStar() {
    const top = deck[index];
    if (!top) return;
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(top.id)) next.delete(top.id);
      else next.add(top.id);
      setTally((t) => ({ ...t, star: next.size }));
      return next;
    });
  }

  function reset() {
    setIndex(0);
    setTally({ up: 0, down: 0, star: 0 });
    setStarred(new Set());
  }

  const topStarred = deck[index] ? starred.has(deck[index].id) : false;

  return (
    <section id="demo" className="border-t border-border bg-bg py-24">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-serif text-4xl text-fg md:text-5xl">Swipe through your rush class.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            This is the actual voting UI — drag a card right to bid, left to pass.
            In a live session, every brother sees the same PNM at the same time and
            their votes stream in over WebSockets.
          </p>
          <div className="mt-8 flex items-center gap-6 text-fg">
            <div><span className="font-mono text-2xl">{tally.up}</span><span className="text-muted-foreground"> bids</span></div>
            <div><span className="font-mono text-2xl">{tally.down}</span><span className="text-muted-foreground"> passes</span></div>
            <div><span className="font-mono text-2xl">{tally.star}</span><span className="text-muted-foreground"> stars</span></div>
          </div>
          <button
            onClick={reset}
            className="mt-6 text-sm text-muted-foreground underline hover:text-fg touch:min-h-[44px]"
          >
            Reset demo
          </button>
        </div>

        <div className="relative mx-auto mb-20 h-[460px] w-[320px]">
          <AnimatePresence custom={direction}>
            {visible.length === 0 ? (
              <div className="grid h-full place-items-center rounded-3xl border border-border bg-surface text-muted-foreground">
                Deck cleared. <button onClick={reset} className="ml-2 underline">Reset</button>
              </div>
            ) : (
              visible.reverse().map((pnm, i) => {
                const isTop = i === visible.length - 1;
                return (
                  <Card
                    key={pnm.id}
                    pnm={pnm}
                    isTop={isTop}
                    onDecide={decide}
                    starred={starred.has(pnm.id)}
                  />
                );
              })
            )}
          </AnimatePresence>
          {/* Buttons as well as dragging: the star had no control at all, and
              a drag-only demo cannot be used from a keyboard. */}
          {index < deck.length && (
            <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-center gap-3">
              <button
                onClick={() => decide("down")}
                className="min-h-[44px] rounded-full border border-border bg-surface px-5 text-sm font-medium text-fg hover:bg-surface-muted"
              >
                Pass
              </button>
              <button
                onClick={toggleStar}
                aria-pressed={topStarred}
                aria-label={topStarred ? "Remove star" : "Star"}
                className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-lg text-fg hover:bg-surface-muted"
              >
                {topStarred ? "★" : "☆"}
              </button>
              <button
                onClick={() => decide("up")}
                className="min-h-[44px] rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
              >
                Bid
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
