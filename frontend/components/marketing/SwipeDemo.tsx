"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { DEMO_PNMS, type DemoPnm } from "@/lib/demo-data";

type Decision = "up" | "down" | "star";

function Card({
  pnm,
  onDecide,
  isTop,
}: {
  pnm: DemoPnm;
  onDecide: (d: Decision) => void;
  isTop: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const upOpacity = useTransform(x, [40, 140], [0, 1]);
  const downOpacity = useTransform(x, [-140, -40], [1, 0]);

  return (
    <motion.div
      style={{ x, rotate }}
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

  const deck = useMemo(() => DEMO_PNMS, []);
  const visible = deck.slice(index, index + 3);

  function decide(d: Decision) {
    setTally((t) => ({ ...t, [d]: t[d] + 1 }));
    setIndex((i) => Math.min(i + 1, deck.length));
  }

  function reset() {
    setIndex(0);
    setTally({ up: 0, down: 0, star: 0 });
  }

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
            className="mt-6 text-sm text-muted-foreground underline hover:text-fg"
          >
            Reset demo
          </button>
        </div>

        <div className="relative mx-auto h-[460px] w-[320px]">
          <AnimatePresence>
            {visible.length === 0 ? (
              <div className="grid h-full place-items-center rounded-3xl border border-border bg-surface text-muted-foreground">
                Deck cleared. <button onClick={reset} className="ml-2 underline">Reset</button>
              </div>
            ) : (
              visible.reverse().map((pnm, i) => {
                const isTop = i === visible.length - 1;
                return <Card key={pnm.id} pnm={pnm} isTop={isTop} onDecide={decide} />;
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
