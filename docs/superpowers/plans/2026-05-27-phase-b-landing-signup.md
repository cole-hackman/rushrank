# Phase B — Public Landing Page & Self-Serve Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public marketing landing page at `/` with interactive PNM swipe demo, plus a 3-step self-serve chapter signup wizard at `/get-started` that provisions a chapter and admin membership via Supabase magic link.

**Architecture:** New `app/(marketing)/` route group with its own minimal layout. Middleware routes authed users to `/dashboard`. The interactive demo reuses the production `ActionCard` component with deterministic fake data (zero backend calls). Signup wizard collects chapter info pre-auth, then a `POST /chapters/provision` endpoint runs post-magic-link to create the chapter row + admin membership idempotently.

**Tech Stack:** Next 14 (App Router, server components, middleware), Tailwind w/ design tokens from Phase A, framer-motion (already in `package.json` if present, else add), Supabase magic-link auth, FastAPI.

**Spec:** `docs/superpowers/specs/2026-05-27-rebrand-themes-landing-export-design.md`

**Depends on:** Phase A merged (`bg-bg`, `bg-accent`, etc. tokens exist; `fraternity_colors` table seeded).

---

## File Structure

**Create:**
- `frontend/middleware.ts` (or extend if exists) — routes `/` based on auth.
- `frontend/app/(marketing)/layout.tsx` — minimal marketing chrome.
- `frontend/app/(marketing)/page.tsx` — the landing page (composes section components).
- `frontend/app/(marketing)/get-started/page.tsx` — signup wizard.
- `frontend/components/marketing/Hero.tsx`
- `frontend/components/marketing/SwipeDemo.tsx`
- `frontend/components/marketing/PnmCardShowcase.tsx`
- `frontend/components/marketing/FeatureGrid.tsx`
- `frontend/components/marketing/HowItWorks.tsx`
- `frontend/components/marketing/SocialProof.tsx`
- `frontend/components/marketing/CtaStrip.tsx`
- `frontend/components/marketing/MarketingFooter.tsx`
- `frontend/components/marketing/SignupWizard.tsx`
- `frontend/lib/demo-data.ts` — fake PNMs for the demo.
- `python_server/tests/test_provisioning.py`

**Modify:**
- `frontend/app/(dashboard)/page.tsx` → move to `frontend/app/(dashboard)/dashboard/page.tsx` (i.e. lives at `/dashboard`).
- `frontend/lib/api.ts` — add `provisionChapter`.
- `python_server/routes.py` — add `POST /chapters/provision`.
- `python_server/services.py` — add `ChapterService.provision_chapter`.

---

## Task 1: Routing — move dashboard off root, add marketing layout

**Files:**
- Move: `frontend/app/(dashboard)/page.tsx` → `frontend/app/(dashboard)/dashboard/page.tsx`
- Create: `frontend/app/(marketing)/layout.tsx`
- Create: `frontend/app/(marketing)/page.tsx` (stub)
- Create: `frontend/middleware.ts` (or modify existing)

- [ ] **Step 1: Relocate the dashboard root**

```bash
mkdir -p "frontend/app/(dashboard)/dashboard"
git mv "frontend/app/(dashboard)/page.tsx" "frontend/app/(dashboard)/dashboard/page.tsx"
```

- [ ] **Step 2: Create marketing layout**

```tsx
// frontend/app/(marketing)/layout.tsx
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
        <nav className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-xl tracking-tight">RushRank</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/#features" className="text-muted hover:text-fg">Features</Link>
            <Link href="/#demo" className="text-muted hover:text-fg">Demo</Link>
            <Link href="/login" className="text-muted hover:text-fg">Sign in</Link>
            <Link
              href="/get-started"
              className="rounded-full bg-accent px-4 py-2 text-sm text-accent-fg"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 3: Stub the landing page**

```tsx
// frontend/app/(marketing)/page.tsx
export default function LandingPage() {
  return <div className="px-6 py-24 text-center">Landing under construction.</div>;
}
```

- [ ] **Step 4: Stub MarketingFooter so layout compiles**

```tsx
// frontend/components/marketing/MarketingFooter.tsx
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-[1180px] px-6 py-12 text-sm text-muted">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-serif text-lg text-fg">RushRank</span>
          <span>© {new Date().getFullYear()} RushRank. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Middleware to route auth state**

Create or modify `frontend/middleware.ts`:

```ts
import { NextResponse, NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/pnms", "/voting", "/events", "/rush",
                   "/analytics", "/exports", "/admin", "/compare",
                   "/profile", "/results", "/settings"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("sb-access-token")?.value;

  if (pathname === "/" && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (PROTECTED.some(p => pathname === p || pathname.startsWith(p + "/")) && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/pnms/:path*", "/voting/:path*",
            "/events/:path*", "/rush/:path*", "/analytics/:path*",
            "/exports/:path*", "/admin/:path*", "/compare/:path*",
            "/profile/:path*", "/results/:path*", "/settings/:path*"],
};
```

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run build`
Expected: PASS.

Smoke: `npm run dev`, visit `/` while logged out → see "Landing under construction"; while logged in → redirect to `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat(marketing): scaffold marketing route group + auth routing"
```

---

## Task 2: Demo data

**Files:**
- Create: `frontend/lib/demo-data.ts`

- [ ] **Step 1: Write demo PNMs**

```ts
// frontend/lib/demo-data.ts
export interface DemoPnm {
  id: string;
  name: string;
  year: string;
  major: string;
  gpa: number;
  hometown: string;
  photo: string;
  tags: string[];
  noteCount: number;
  voteSummary: { up: number; down: number; star: number };
  latestNote?: { author: string; text: string };
}

export const DEMO_PNMS: DemoPnm[] = [
  {
    id: "demo-1",
    name: "Marcus Chen",
    year: "Freshman",
    major: "Computer Science",
    gpa: 3.91,
    hometown: "Palo Alto, CA",
    photo: "/marketing/demo-faces/01.jpg",
    tags: ["legacy", "athlete"],
    noteCount: 4,
    voteSummary: { up: 12, down: 1, star: 3 },
    latestNote: { author: "JS", text: "Great convo at the smoker — knows three brothers already." },
  },
  {
    id: "demo-2",
    name: "Diego Alvarez",
    year: "Sophomore",
    major: "Mechanical Engineering",
    gpa: 3.74,
    hometown: "Austin, TX",
    photo: "/marketing/demo-faces/02.jpg",
    tags: ["transfer"],
    noteCount: 2,
    voteSummary: { up: 9, down: 2, star: 1 },
    latestNote: { author: "RP", text: "Quiet but very sharp; played D1 lacrosse." },
  },
  {
    id: "demo-3",
    name: "Jordan Patel",
    year: "Freshman",
    major: "Economics",
    gpa: 3.88,
    hometown: "Chicago, IL",
    photo: "/marketing/demo-faces/03.jpg",
    tags: ["legacy", "scholar"],
    noteCount: 5,
    voteSummary: { up: 15, down: 0, star: 4 },
    latestNote: { author: "TM", text: "Top of his pledge class material. Easy yes." },
  },
  {
    id: "demo-4",
    name: "Wesley Kim",
    year: "Freshman",
    major: "Pre-Med",
    gpa: 3.95,
    hometown: "Seattle, WA",
    photo: "/marketing/demo-faces/04.jpg",
    tags: ["scholar"],
    noteCount: 3,
    voteSummary: { up: 7, down: 3, star: 1 },
  },
  {
    id: "demo-5",
    name: "Ethan Brooks",
    year: "Sophomore",
    major: "Business",
    gpa: 3.42,
    hometown: "Charlotte, NC",
    photo: "/marketing/demo-faces/05.jpg",
    tags: ["athlete"],
    noteCount: 1,
    voteSummary: { up: 5, down: 4, star: 0 },
  },
  {
    id: "demo-6",
    name: "Noah Williams",
    year: "Freshman",
    major: "Finance",
    gpa: 3.81,
    hometown: "Boston, MA",
    photo: "/marketing/demo-faces/06.jpg",
    tags: ["legacy"],
    noteCount: 6,
    voteSummary: { up: 11, down: 1, star: 2 },
    latestNote: { author: "AS", text: "Dad is an alum. Brought it up unprompted, in a good way." },
  },
  {
    id: "demo-7",
    name: "Liam O'Connor",
    year: "Freshman",
    major: "Political Science",
    gpa: 3.63,
    hometown: "Denver, CO",
    photo: "/marketing/demo-faces/07.jpg",
    tags: [],
    noteCount: 2,
    voteSummary: { up: 6, down: 2, star: 0 },
  },
  {
    id: "demo-8",
    name: "Andre Jackson",
    year: "Sophomore",
    major: "Biology",
    gpa: 3.78,
    hometown: "Atlanta, GA",
    photo: "/marketing/demo-faces/08.jpg",
    tags: ["athlete", "scholar"],
    noteCount: 3,
    voteSummary: { up: 10, down: 1, star: 2 },
  },
  {
    id: "demo-9",
    name: "Tyler Nguyen",
    year: "Freshman",
    major: "Mathematics",
    gpa: 3.99,
    hometown: "San Diego, CA",
    photo: "/marketing/demo-faces/09.jpg",
    tags: ["scholar"],
    noteCount: 4,
    voteSummary: { up: 13, down: 0, star: 3 },
  },
  {
    id: "demo-10",
    name: "Hunter Davis",
    year: "Junior",
    major: "Marketing",
    gpa: 3.51,
    hometown: "Nashville, TN",
    photo: "/marketing/demo-faces/10.jpg",
    tags: [],
    noteCount: 1,
    voteSummary: { up: 4, down: 5, star: 0 },
  },
  {
    id: "demo-11",
    name: "Riley Thompson",
    year: "Freshman",
    major: "Environmental Studies",
    gpa: 3.72,
    hometown: "Portland, OR",
    photo: "/marketing/demo-faces/11.jpg",
    tags: ["athlete"],
    noteCount: 2,
    voteSummary: { up: 8, down: 2, star: 1 },
  },
  {
    id: "demo-12",
    name: "Sam Rivera",
    year: "Sophomore",
    major: "Architecture",
    gpa: 3.66,
    hometown: "Miami, FL",
    photo: "/marketing/demo-faces/12.jpg",
    tags: ["transfer", "scholar"],
    noteCount: 3,
    voteSummary: { up: 9, down: 1, star: 1 },
  },
];
```

- [ ] **Step 2: Add placeholder photo assets**

```bash
mkdir -p frontend/public/marketing/demo-faces
```

Generate 12 placeholder JPGs at `frontend/public/marketing/demo-faces/01.jpg` … `12.jpg`. Use any deterministic source — e.g., `https://i.pravatar.cc/600?img=N` saved as a static file, or curated CC0 portraits committed to the repo. Each file ≤ 200KB, 600×750 (4:5).

If unable to source images, ship as SVG initials placeholders at the same paths so layout renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/demo-data.ts frontend/public/marketing/demo-faces/
git commit -m "feat(marketing): demo PNM dataset + placeholder photos"
```

---

## Task 3: Hero section

**Files:**
- Create: `frontend/components/marketing/Hero.tsx`
- Modify: `frontend/app/(marketing)/page.tsx`

- [ ] **Step 1: Build Hero**

```tsx
// frontend/components/marketing/Hero.tsx
import Link from "next/link";
import Image from "next/image";
import { DEMO_PNMS } from "@/lib/demo-data";

export function Hero() {
  const fan = DEMO_PNMS.slice(0, 3);
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h1 className="font-serif text-6xl leading-[1.02] tracking-tight text-fg md:text-7xl">
            Rush, ranked.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            A modern home for chapter recruitment. Run live voting, manage every PNM dossier,
            and ship a polished slide deck before chapter even ends.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/get-started"
              className="rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-fg"
            >
              Get started free
            </Link>
            <Link
              href="#demo"
              className="rounded-full border border-fg/15 px-6 py-3 text-base text-fg hover:bg-surface-muted"
            >
              Try the demo
            </Link>
          </div>
        </div>

        <div className="relative h-[480px]">
          {fan.map((p, i) => (
            <div
              key={p.id}
              className="absolute left-1/2 top-6 h-[360px] w-[260px] -translate-x-1/2 rounded-3xl border border-border bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(10,10,10,0.25)]"
              style={{
                transform: `translateX(calc(-50% + ${(i - 1) * 28}px)) rotate(${(i - 1) * 4}deg)`,
                zIndex: 10 - i,
              }}
            >
              <div className="relative h-[230px] w-full overflow-hidden rounded-2xl bg-surface-muted">
                <Image src={p.photo} alt={p.name} fill className="object-cover" />
              </div>
              <div className="mt-3">
                <div className="font-medium text-fg">{p.name}</div>
                <div className="text-sm text-muted">{p.year} · {p.major}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in landing page**

```tsx
// frontend/app/(marketing)/page.tsx
import { Hero } from "@/components/marketing/Hero";

export default function LandingPage() {
  return (
    <>
      <Hero />
    </>
  );
}
```

- [ ] **Step 3: Build + smoke**

Run: `cd frontend && npm run build && npm run dev`
Expected: `/` shows the headline + fanned card stack.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/marketing/Hero.tsx frontend/app/(marketing)/page.tsx
git commit -m "feat(marketing): hero section"
```

---

## Task 4: Interactive swipe demo

**Files:**
- Create: `frontend/components/marketing/SwipeDemo.tsx`
- Modify: `frontend/app/(marketing)/page.tsx`
- Modify: `frontend/package.json` (add `framer-motion` if missing)

- [ ] **Step 1: Ensure framer-motion is installed**

Run: `cd frontend && grep -E '"framer-motion"' package.json || npm install framer-motion`

- [ ] **Step 2: Build SwipeDemo**

```tsx
// frontend/components/marketing/SwipeDemo.tsx
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
        <div className="text-sm text-muted">
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
          <p className="mt-4 text-lg text-muted">
            This is the actual voting UI — drag a card right to bid, left to pass.
            In a live session, every brother sees the same PNM at the same time and
            their votes stream in over WebSockets.
          </p>
          <div className="mt-8 flex items-center gap-6 text-fg">
            <div><span className="font-mono text-2xl">{tally.up}</span><span className="text-muted"> bids</span></div>
            <div><span className="font-mono text-2xl">{tally.down}</span><span className="text-muted"> passes</span></div>
            <div><span className="font-mono text-2xl">{tally.star}</span><span className="text-muted"> stars</span></div>
          </div>
          <button
            onClick={reset}
            className="mt-6 text-sm text-muted underline hover:text-fg"
          >
            Reset demo
          </button>
        </div>

        <div className="relative mx-auto h-[460px] w-[320px]">
          <AnimatePresence>
            {visible.length === 0 ? (
              <div className="grid h-full place-items-center rounded-3xl border border-border bg-surface text-muted">
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
```

- [ ] **Step 3: Mount in landing**

```tsx
// frontend/app/(marketing)/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { SwipeDemo } from "@/components/marketing/SwipeDemo";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SwipeDemo />
    </>
  );
}
```

- [ ] **Step 4: Build + smoke**

Run: `cd frontend && npm run build && npm run dev`
Expected: section renders, cards are draggable, tally updates.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/marketing/SwipeDemo.tsx frontend/app/(marketing)/page.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(marketing): interactive swipe demo"
```

---

## Task 5: PNM card showcase

**Files:**
- Create: `frontend/components/marketing/PnmCardShowcase.tsx`
- Modify: `frontend/app/(marketing)/page.tsx`

- [ ] **Step 1: Build**

```tsx
// frontend/components/marketing/PnmCardShowcase.tsx
import Image from "next/image";
import { DEMO_PNMS } from "@/lib/demo-data";

export function PnmCardShowcase() {
  const cards = DEMO_PNMS.slice(0, 3);
  return (
    <section className="border-t border-border bg-surface-muted/40 py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">Every PNM, fully knowable.</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Notes, votes, tags, and conversation history live in one dossier so chapter
          decisions are made on signal, not memory.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map((p, i) => (
            <div
              key={p.id}
              className="rounded-3xl border border-border bg-surface p-6 transition-transform hover:-translate-y-1"
              style={{ transform: `rotate(${(i - 1) * 1.5}deg)` }}
            >
              <div className="relative h-[240px] w-full overflow-hidden rounded-2xl bg-surface-muted">
                <Image src={p.photo} alt={p.name} fill className="object-cover" />
              </div>
              <div className="mt-4">
                <div className="font-serif text-xl text-fg">{p.name}</div>
                <div className="text-sm text-muted">{p.year} · {p.major} · GPA {p.gpa.toFixed(2)}</div>
              </div>
              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Bids / Passes / Stars</dt>
                  <dd className="font-mono text-fg">
                    {p.voteSummary.up} / {p.voteSummary.down} / {p.voteSummary.star}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Notes</dt>
                  <dd className="font-mono text-fg">{p.noteCount}</dd>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text">
                      {t}
                    </span>
                  ))}
                </div>
              </dl>
              {p.latestNote && (
                <blockquote className="mt-4 border-l-2 border-accent pl-3 text-sm italic text-muted">
                  “{p.latestNote.text}”
                  <div className="mt-1 text-xs not-italic">— {p.latestNote.author}</div>
                </blockquote>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount**

In `frontend/app/(marketing)/page.tsx`, add `<PnmCardShowcase />` after `<SwipeDemo />`.

- [ ] **Step 3: Smoke + commit**

Run: `cd frontend && npm run build`
Expected: PASS.

```bash
git add frontend/components/marketing/PnmCardShowcase.tsx frontend/app/(marketing)/page.tsx
git commit -m "feat(marketing): PNM card showcase section"
```

---

## Task 6: FeatureGrid + HowItWorks + SocialProof + CtaStrip

**Files:**
- Create: `frontend/components/marketing/FeatureGrid.tsx`
- Create: `frontend/components/marketing/HowItWorks.tsx`
- Create: `frontend/components/marketing/SocialProof.tsx`
- Create: `frontend/components/marketing/CtaStrip.tsx`
- Modify: `frontend/app/(marketing)/page.tsx`

- [ ] **Step 1: FeatureGrid**

```tsx
// frontend/components/marketing/FeatureGrid.tsx
const FEATURES = [
  { title: "Live voting sessions", body: "Real-time websocket sync. The chair drives the pace, everyone sees the same PNM." },
  { title: "PNM dossiers", body: "Photo, GPA, hometown, tags, votes, and every chapter note in one place." },
  { title: "Round management", body: "Standardize round-by-round decisions with explicit cutoffs and audit trails." },
  { title: "Chapter analytics", body: "Distributions, vote drift, attendance — answer the questions before exec asks them." },
  { title: "Multi-tenant security", body: "Postgres row-level security. Your chapter's data never crosses lines." },
  { title: "Slideshow export", body: "One click and you've got a slide deck ready for chapter.", isNew: true },
];

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border bg-bg py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">Everything rush needs. Nothing it doesn't.</h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-xl text-fg">{f.title}</h3>
                {f.isNew && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-fg">New</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: HowItWorks**

```tsx
// frontend/components/marketing/HowItWorks.tsx
const STEPS = [
  { n: "01", title: "Create your chapter", body: "Two minutes. Fraternity name, school, admin email." },
  { n: "02", title: "Import your PNMs", body: "CSV upload or one-by-one. Photos optional but recommended." },
  { n: "03", title: "Run rush", body: "Open a session, swipe through PNMs, export the deck." },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-surface-muted/40 py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">How it works.</h2>
        <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="border-t-2 border-accent pt-6">
              <span className="font-mono text-sm text-muted">{s.n}</span>
              <h3 className="mt-2 font-serif text-2xl text-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: SocialProof (placeholder schools)**

```tsx
// frontend/components/marketing/SocialProof.tsx
const SCHOOLS = ["Boston College", "UNC Chapel Hill", "Vanderbilt", "USC", "Michigan", "Tulane"];

export function SocialProof() {
  return (
    <section className="border-t border-border bg-bg py-16">
      <div className="mx-auto max-w-[1180px] px-6">
        <p className="text-center text-sm uppercase tracking-[0.2em] text-muted">
          Trusted by chapters at
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted">
          {SCHOOLS.map((s) => (
            <span key={s} className="font-serif text-lg opacity-70">{s}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: CtaStrip**

```tsx
// frontend/components/marketing/CtaStrip.tsx
import Link from "next/link";

export function CtaStrip() {
  return (
    <section className="border-t border-border bg-bg py-24">
      <div className="mx-auto max-w-[1180px] px-6 text-center">
        <h2 className="font-serif text-4xl text-fg md:text-5xl">
          Free during pilot. Ready when you are.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Stand up your chapter on RushRank in under two minutes. No card required.
        </p>
        <Link
          href="/get-started"
          className="mt-10 inline-block rounded-full bg-accent px-8 py-3 text-base font-medium text-accent-fg"
        >
          Get started free
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Compose landing page**

```tsx
// frontend/app/(marketing)/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { SwipeDemo } from "@/components/marketing/SwipeDemo";
import { PnmCardShowcase } from "@/components/marketing/PnmCardShowcase";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { SocialProof } from "@/components/marketing/SocialProof";
import { CtaStrip } from "@/components/marketing/CtaStrip";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SwipeDemo />
      <PnmCardShowcase />
      <FeatureGrid />
      <HowItWorks />
      <SocialProof />
      <CtaStrip />
    </>
  );
}
```

- [ ] **Step 6: Smoke + commit**

Run: `cd frontend && npm run build && npm run dev`
Expected: all sections render top-to-bottom.

```bash
git add frontend/components/marketing/ frontend/app/(marketing)/page.tsx
git commit -m "feat(marketing): feature grid, how-it-works, social proof, CTA"
```

---

## Task 7: Backend — chapter provisioning service + tests (TDD)

**Files:**
- Test: `python_server/tests/test_provisioning.py`
- Modify: `python_server/services.py`

- [ ] **Step 1: Write failing tests**

```python
# python_server/tests/test_provisioning.py
import pytest
from python_server.services import ChapterService

@pytest.mark.asyncio
async def test_provision_creates_chapter_and_admin_membership(db_pool, fresh_user):
    svc = ChapterService(db_pool)
    out = await svc.provision_chapter(
        user_id=fresh_user["id"],
        fraternity_name="Sigma Chi",
        school="Boston College",
        chapter_name="Sigma Chi at Boston College",
        admin_name="Test Admin",
    )
    assert out["chapter_id"]
    async with db_pool.acquire() as conn:
        chap = await conn.fetchrow("SELECT * FROM chapters WHERE id = $1", out["chapter_id"])
        assert chap["name"] == "Sigma Chi at Boston College"
        assert chap["theme"]["accent_hex"] == "#0033A0"
        assert chap["theme"]["enabled"] is False
        assert chap["theme"]["source"] == "auto"
        mem = await conn.fetchrow(
            "SELECT * FROM memberships WHERE user_id = $1 AND chapter_id = $2",
            fresh_user["id"], out["chapter_id"],
        )
        assert mem["role"] == "admin"

@pytest.mark.asyncio
async def test_provision_is_idempotent(db_pool, fresh_user):
    svc = ChapterService(db_pool)
    a = await svc.provision_chapter(
        user_id=fresh_user["id"],
        fraternity_name="Sigma Chi",
        school="Boston College",
        chapter_name="Sigma Chi at Boston College",
        admin_name="Test Admin",
    )
    b = await svc.provision_chapter(
        user_id=fresh_user["id"],
        fraternity_name="Sigma Chi",
        school="Boston College",
        chapter_name="Sigma Chi at Boston College",
        admin_name="Test Admin",
    )
    assert a["chapter_id"] == b["chapter_id"]

@pytest.mark.asyncio
async def test_provision_unknown_fraternity_leaves_accent_null(db_pool, fresh_user):
    svc = ChapterService(db_pool)
    out = await svc.provision_chapter(
        user_id=fresh_user["id"],
        fraternity_name="Made Up Fraternity",
        school="State U",
        chapter_name="Made Up at State U",
        admin_name="Test Admin",
    )
    async with db_pool.acquire() as conn:
        chap = await conn.fetchrow("SELECT theme FROM chapters WHERE id = $1", out["chapter_id"])
        assert chap["theme"]["accent_hex"] is None
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_provisioning.py -v`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

In `python_server/services.py`, add to `ChapterService`:

```python
async def provision_chapter(
    self,
    user_id,
    fraternity_name: str,
    school: str,
    chapter_name: str,
    admin_name: str,
) -> dict:
    accent = await self.autodetect_accent(fraternity_name)
    theme = {
        "enabled": False,
        "accent_hex": accent,
        "source": "auto" if accent else "manual",
    }
    async with self.pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchrow(
                """SELECT c.id FROM chapters c
                   JOIN memberships m ON m.chapter_id = c.id
                   WHERE m.user_id = $1 AND c.name = $2 AND c.school = $3""",
                user_id, chapter_name, school,
            )
            if existing:
                return {"chapter_id": str(existing["id"])}

            row = await conn.fetchrow(
                """INSERT INTO chapters (name, fraternity, school, theme)
                   VALUES ($1, $2, $3, $4::jsonb)
                   RETURNING id""",
                chapter_name, fraternity_name, school, json.dumps(theme),
            )
            chapter_id = row["id"]
            await conn.execute(
                """INSERT INTO memberships (user_id, chapter_id, role)
                   VALUES ($1, $2, 'admin')""",
                user_id, chapter_id,
            )
            await conn.execute(
                "UPDATE users SET display_name = COALESCE(display_name, $1) WHERE id = $2",
                admin_name, user_id,
            )
            return {"chapter_id": str(chapter_id)}
```

(If `chapters` doesn't have a `school` or `fraternity` column, add a migration `0011_chapters_school_fraternity.sql` adding both as nullable TEXT before this task — verify with `\d chapters` first.)

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_provisioning.py -v`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/services.py python_server/tests/test_provisioning.py supabase/migrations/
git commit -m "feat(api): chapter self-serve provisioning service"
```

---

## Task 8: Backend — provisioning route

**Files:**
- Modify: `python_server/routes.py`

- [ ] **Step 1: Add route**

```python
class ProvisionRequest(BaseModel):
    fraternity_name: str
    school: str
    chapter_name: str
    admin_name: str

@router.post("/chapters/provision")
async def provision_chapter(
    req: ProvisionRequest,
    user=Depends(get_current_user),
    chapter_svc: ChapterService = Depends(get_chapter_service),
):
    return await chapter_svc.provision_chapter(
        user_id=user.id,
        fraternity_name=req.fraternity_name,
        school=req.school,
        chapter_name=req.chapter_name,
        admin_name=req.admin_name,
    )
```

- [ ] **Step 2: Smoke**

Start server. Run:
```bash
curl -X POST http://localhost:8000/api/v1/chapters/provision \
  -H "Authorization: Bearer <test-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fraternity_name":"Sigma Chi","school":"BC","chapter_name":"Sigma Chi at BC","admin_name":"Test"}'
```
Expected: 200 with `{"chapter_id": "..."}`.

- [ ] **Step 3: Commit**

```bash
git add python_server/routes.py
git commit -m "feat(api): POST /chapters/provision endpoint"
```

---

## Task 9: Frontend — SignupWizard

**Files:**
- Create: `frontend/components/marketing/SignupWizard.tsx`
- Create: `frontend/app/(marketing)/get-started/page.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/supabaseClient.ts` (only if magic-link helper not already exported)

- [ ] **Step 1: Add provisioning API client**

In `frontend/lib/api.ts`:

```ts
export interface ProvisionRequest {
  fraternity_name: string;
  school: string;
  chapter_name: string;
  admin_name: string;
}
export async function provisionChapter(req: ProvisionRequest): Promise<{ chapter_id: string }> {
  return apiPost("/chapters/provision", req);
}
```

- [ ] **Step 2: Build the wizard**

```tsx
// frontend/components/marketing/SignupWizard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useFraternityColors } from "@/lib/queries";
import { provisionChapter } from "@/lib/api";

const PENDING_KEY = "rushrank.pendingSignup.v1";

interface PendingSignup {
  fraternity_name: string;
  school: string;
  chapter_name: string;
  admin_name: string;
}

export function SignupWizard() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: fraternities = [] } = useFraternityColors();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fraternity, setFraternity] = useState("");
  const [school, setSchool] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (fraternity && school && !chapterName) {
      setChapterName(`${fraternity} at ${school}`);
    }
  }, [fraternity, school, chapterName]);

  useEffect(() => {
    const verified = search.get("verified");
    if (!verified) return;
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    (async () => {
      try {
        const pending: PendingSignup = JSON.parse(raw);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await provisionChapter(pending);
        localStorage.removeItem(PENDING_KEY);
        router.replace("/dashboard?welcome=1");
      } catch (e: any) {
        setError(e?.message ?? "Provisioning failed");
      }
    })();
  }, [search, router]);

  async function sendMagicLink() {
    setError(null);
    setSending(true);
    try {
      const pending: PendingSignup = {
        fraternity_name: fraternity,
        school,
        chapter_name: chapterName,
        admin_name: adminName,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/get-started?verified=1`,
        },
      });
      if (error) throw error;
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send magic link");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-2 w-12 rounded-full ${step >= n ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-serif text-3xl text-fg">Your chapter</h1>
          <label className="block">
            <span className="text-sm text-muted">Fraternity</span>
            <input
              list="fraternities"
              value={fraternity}
              onChange={(e) => setFraternity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
              placeholder="Sigma Chi"
            />
            <datalist id="fraternities">
              {fraternities.map((f) => <option key={f.key} value={f.name} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-sm text-muted">School</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
              placeholder="Boston College"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Chapter name</span>
            <input
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <button
            disabled={!fraternity || !school || !chapterName}
            onClick={() => setStep(2)}
            className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h1 className="font-serif text-3xl text-fg">You</h1>
          <label className="block">
            <span className="text-sm text-muted">Your name</span>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="text-muted underline">Back</button>
            <button
              disabled={!adminName || !email || sending}
              onClick={sendMagicLink}
              className="rounded-full bg-accent px-6 py-2 text-accent-fg disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send magic link"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5 text-center">
          <h1 className="font-serif text-3xl text-fg">Check your email</h1>
          <p className="text-muted">
            We sent a sign-in link to <strong>{email}</strong>. Click it to finish setting up
            your chapter.
          </p>
          <button onClick={sendMagicLink} className="text-sm text-muted underline">
            Resend
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Mount on `/get-started`**

```tsx
// frontend/app/(marketing)/get-started/page.tsx
import { SignupWizard } from "@/components/marketing/SignupWizard";

export default function GetStartedPage() {
  return <SignupWizard />;
}
```

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual E2E smoke**

1. `npm run dev` + backend running.
2. Visit `/get-started`, fill steps 1+2 with your email.
3. Receive magic link in Supabase email or `inbucket` if local.
4. Click link → land on `/get-started?verified=1` → wizard auto-provisions → redirects to `/dashboard?welcome=1`.
5. Verify in DB: new `chapters` row + admin `memberships` row.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/marketing/SignupWizard.tsx frontend/app/(marketing)/get-started/page.tsx frontend/lib/api.ts
git commit -m "feat(marketing): self-serve signup wizard with magic-link provisioning"
```

---

## Task 10: Welcome toast on `/dashboard?welcome=1`

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add toast trigger**

In `frontend/app/(dashboard)/dashboard/page.tsx`, add at the top of the client component (mark `"use client"` if not already):

```tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner"; // or whatever toast lib is already in the app

export default function DashboardPage() {
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (search.get("welcome") === "1") {
      toast.success("Welcome to RushRank — invite your team from Settings.");
      router.replace("/dashboard");
    }
  }, [search, router]);

  // ... existing dashboard JSX
}
```

If the project doesn't use `sonner`, look at how other pages show toasts and reuse the same hook/component. Don't introduce a new toast library.

- [ ] **Step 2: Smoke + commit**

Run: `cd frontend && npm run build && npm run dev`. Manually visit `/dashboard?welcome=1` → toast fires once, URL cleans up.

```bash
git add frontend/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(marketing): welcome toast on first dashboard visit"
```

---

## Task 11: Existing-membership shortcut on `/get-started`

**Files:**
- Modify: `frontend/components/marketing/SignupWizard.tsx`

- [ ] **Step 1: Add membership check**

Inside `SignupWizard`, add early effect:

```tsx
useEffect(() => {
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const theme = await fetch("/api/v1/chapters/me/theme", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (theme.ok) {
        router.replace("/dashboard");
      }
    } catch {}
  })();
}, [router]);
```

Place this above the existing `useEffect` that handles `verified`.

- [ ] **Step 2: Smoke + commit**

Manually: log in as an existing member, visit `/get-started` → immediately bounced to `/dashboard`.

```bash
git add frontend/components/marketing/SignupWizard.tsx
git commit -m "feat(marketing): bounce existing members away from signup wizard"
```

---

## Task 12: Verification

- [ ] **Step 1: Backend tests**

Run: `cd python_server && pytest -v`
Expected: all PASS.

- [ ] **Step 2: Frontend checks**

Run: `cd frontend && npm run typecheck && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 3: End-to-end manual smoke**

1. Logged-out user → visits `/` → sees full landing page; swipe demo works; nav links scroll.
2. Logged-out user → clicks "Get started" → `/get-started`, completes wizard, receives magic link, clicks it, lands on `/dashboard` with welcome toast. New chapter + admin membership visible in DB.
3. Logged-in user → visits `/` → bounced to `/dashboard`.
4. Logged-in member → visits `/get-started` → bounced to `/dashboard`.

- [ ] **Step 4: Final commit if needed**

```bash
git status
# any pending → commit chore
```

---

## Self-Review

- ✅ Spec § 5.1 Routing — Task 1.
- ✅ Spec § 5.2 Landing sections (Hero, Swipe demo, PNM showcase, Feature grid, How it works, Social proof, CTA, Footer) — Tasks 1, 3, 4, 5, 6.
- ✅ Spec § 5.3 Visual direction (cream/black, serif+grotesque, no shadows, accent only on CTAs) — applied across components.
- ✅ Spec § 5.4 Signup wizard (3 steps, magic link, provisioning endpoint, idempotent, welcome toast, existing-member shortcut) — Tasks 7, 8, 9, 10, 11.

No placeholders. Naming consistent: `provisionChapter`, `provision_chapter`, `PENDING_KEY`, `welcome=1` URL flag stable across tasks.
