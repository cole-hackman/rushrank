# Tech stack critique: performance, speed and latency

**Checked 11 November 2026 against `main` at `bd82ecc`.**

## Verdict

The stack is the right size for this product. Next.js on Vercel, FastAPI on Render and Supabase Postgres can run one chapter's rush, and a 24-voter live session works correctly. Nothing here needs replacing.

The latency problems are in three places, in this order:

1. **Deployment.** The backend is on Render's free plan with nothing keeping it awake, and the frontend gives up after 20 seconds. The first person to open the app after a quiet spell gets an error, not a slow page. On 11 Nov the production backend did not answer at all.
2. **The vote path.** One vote is seven SQL statements, run one after another, each on its own pooled connection. On localhost that costs about 10 ms. Across a network it multiplies by the round-trip time to the database, and the single backend process handles voters one at a time.
3. **The frontend's first paint.** Every signed-in page is a client-rendered shell that shows "Loading..." until JavaScript, the session check and the data fetches finish. PNM photos are served at whatever size they were uploaded.

There are still **no production latency numbers**. Every production figure below is inferred. The measured figures come from a local stack and from the build.

## What was measured, and where

All measurements were taken on 11 Nov 2026 in a Linux container (4 CPUs, 15 GB RAM, Node 22.23, Python 3.13, PostgreSQL 16 on the same machine). Backend: one `uvicorn` process. Database: seeded by `e2e/seed.py` (32 members, 61 PNMs, 2,345 votes). Because the database is on localhost, these numbers contain almost no network time. They show how much work the code does, not what a user on a phone will see.

### Backend, local

| Measurement | Result |
|---|---|
| `POST /votes`, 60 sequential votes in a live session | p50 9.5 ms, p95 16.2 ms |
| `POST /votes`, 24 voters at the same instant | p50 115 ms, p95 120 ms, max 122 ms; all 24 succeeded |
| `GET /pnms` (51 rows, 39 kB of JSON) | p50 13.5 ms, p95 16.9 ms |
| `GET /rounds/{id}/results` | p50 9.6 ms, p95 12.3 ms |
| `GET /sessions/{id}/current` | p50 5.8 ms, p95 8.6 ms |
| `GET /me` | p50 3.7 ms, p95 5.3 ms |
| `POST /pnms/export/pptx` (whole roster, one call) | 598 ms |
| App import time (`import python_server.main`) | 0.67–0.74 s, 83 MB resident |
| Unit tests (`pytest -m "not integration"`) | 91 passed in about 2 s |
| Integration tests against real Postgres | 145 passed in 10.8 s |

The 24-concurrent result is the important one. Sequentially a vote takes about 10 ms; 24 at once take about 120 ms each. The single process is working through them in turn, so the room's wait grows with the number of voters even with a zero-latency database.

### Live session, local

`e2e/ws-voting.mjs` with 1 chair and 24 voters in separate browser contexts, 4 PNMs:

- 24 of 24 concurrent votes stored on every PNM, with the right values.
- Every voter connected over the websocket; none fell back to polling.
- `vote_cast` tallies matched the database after each PNM.
- `pnm_advance`, `lock_change` and `session_ended` reached all 25 clients.
- A voter with the websocket blocked caught up by polling within 9 seconds.

This confirms correctness under concurrency. It says nothing about speed over a real network.

### Frontend build

`next build` (Next 14.2.15) succeeded in 54.7 s; `tsc --noEmit` passed.

| Route | First-load JS |
|---|---|
| Shared by all routes | 87.4 kB |
| `/` (landing) | 141 kB |
| `/login` | 150 kB |
| `/dashboard` | 191 kB |
| `/pnms` | 181 kB |
| `/voting` | 208 kB |
| `/results` | 172 kB |
| `/events/[id]/checkin` | **271 kB** |
| `/rush` | **283 kB** |
| Other dashboard routes | 154–197 kB |

The largest single chunk is 86.5 kB gzipped and contains barcode-decoder strings. It is almost certainly `html5-qrcode`, imported statically at `frontend/components/events/QrScanner.tsx:3` (the attribution is inferred from the chunk's contents).

### Production

| Probe | Result |
|---|---|
| `GET https://rushrank-backend.onrender.com/health`, 3 attempts | All timed out at 120 s with zero bytes. TLS handshake completed in about 0.3 s. |
| GitHub Actions workflow state | `CI` and `Warm Backend` are both `disabled_manually`. The last five keep-warm runs (15–16 Feb 2026) all failed, 22 to 195 minutes apart instead of the scheduled 10. |

No cold-start time or warm response time could be measured.

### Counts from the code

- 24 of 26 pages are client components. The dashboard layout is itself `"use client"` (`frontend/app/(dashboard)/layout.tsx:1`).
- 119 of 210 frontend source files start with `"use client"`.
- react-query has 4 call sites; 26 files call `api()` directly, mostly from `useEffect`.
- SQL statements per request, counted by reading the handlers:

| Request | Statements |
|---|---|
| `POST /votes` in a live session | 7 |
| `POST /sessions` (start) | 9 |
| `POST /sessions/join` | 7 |
| `GET /sessions/active` | 5 |
| `POST /sessions/{id}/advance` | 4 |
| `GET /sessions/{id}/current` (the polling fallback) | 4 |
| `POST /sessions/{id}/lock` | 3 |

---

## Findings by layer

Each finding is marked **[measured]** or **[inferred]**.

### Deployment

1. **[inferred] Render free plan, one process, nothing keeping it warm.** `render.yaml:6` is `plan: free`; the start command has no `--workers` (`render.yaml:8`). Free services sleep when idle. The keep-warm workflow is disabled **[measured]**, and even when enabled it is written so a failed ping cannot fail the job (`.github/workflows/warm-backend.yml:17`).
2. **[inferred] The frontend times out before a cold start finishes.** The default timeout is 20 s (`frontend/lib/api.ts:163`), 15 s for `/chapters` and `/me`. Only the four react-query hooks retry. A sleeping backend therefore shows as an error toast.
3. **[inferred] Render and the database may be on opposite coasts.** `render.yaml:5` is `region: oregon`. The repo does not state the Supabase region. The one Supabase project on the connected account is in `us-east-1`; **confirm whether that is the RushRank database**. If it is, every SQL statement crosses the country, and finding 5 multiplies that.
4. **[inferred] No health check, and startup can block for minutes.** `render.yaml` has no `healthCheckPath`. The pool retries 5 times with a 60 s connect timeout each (`python_server/database.py:28-39`), so a slow database at boot delays the port by up to about 5 minutes 45 seconds.

### Database access

5. **[inferred] Each statement is roughly three network round trips.** `statement_cache_size=0` (`python_server/database.py:40`, required for the transaction pooler) means asyncpg prepares and then executes each query. Every statement also acquires its own pool connection (`database.py:85,90,95`), and asyncpg resets the connection on release. A 7-statement vote is therefore about 21 sequential round trips. On localhost that is the 10 ms measured above. At a 35 ms round trip it would be about 0.7 s per vote, and at 70 ms about 1.5 s. These two figures are arithmetic, not measurements.
6. **[inferred] Pool of 10, minimum 1.** `database.py:36-37`. With 24 or more voters each making 7 sequential acquisitions, requests queue.
7. **[inferred] No transactions on multi-write paths.** Starting, advancing and ending a session are several independent statements. This is a correctness risk first, and it is also why the statements cannot share one connection today.
8. **[inferred] Redundant indexes on `votes`,** the hottest write table: three single- or two-column indexes are prefixes of the unique constraint (`supabase/migrations/0004_add_indexes.sql:9-11`; `0001_init.sql:160`). No missing index was found on any hot path.

### Backend hot paths

9. **[measured + inferred] `POST /votes` does avoidable work.** The round, membership and session lookups could be one join; the existing-vote read is only needed for favourite-only updates; the per-PNM tallies and the distinct-voter count for the whole round are recomputed on every vote (`python_server/routes.py:1731-1806`).
10. **[inferred] The broadcast is awaited inside the voter's request and sent to everyone.** `routes.py:1806` awaits `broadcast_vote_cast`, which sends to each socket in turn (`python_server/websocket.py:49-51`). One slow phone delays the voter's response. Every vote goes to every client, so 24 voters produce about 576 messages per PNM, each causing a re-render. Only the chair's progress bar uses them. **[measured]** locally, `vote_cast` did reach all 24 voters.
11. **[inferred] The membership check is a query on every request,** with no cache, although `SimpleCache` exists and is used for two other auth lookups (`python_server/services.py:128-157`; `python_server/cache.py:15`).
12. **[inferred] `GET /pnms` is unbounded and heavy.** No limit or pagination, a join over votes from every round, and six correlated subqueries per row (`python_server/routes.py:940-1068`). **[measured]** it is 13.5 ms and 39 kB at 51 PNMs, which is fine today. It grows with every season because votes are never scoped to a round.
13. **[inferred] Blocking work runs on the event loop.** Nothing in `python_server` uses `to_thread`. With one process, each of these stalls every other request, votes and websocket sends included: Pillow card rendering with a per-pixel gradient loop (`python_server/graphics.py:303-310`), the PowerPoint build and per-photo re-encode (`python_server/slideshow.py:78-106,262-296`), PDF generation, and synchronous Supabase storage calls (`python_server/services.py:394,2782-2808`). **[measured]** one PowerPoint export held the process for about 0.6 s locally with no remote photos to fetch.
14. **[inferred] All shared state lives in the one process:** websocket rooms, rate-limit counters, the cache. A second worker or instance would silently split the room, because a broadcast only reaches sockets on the process that handled the request. This is the blocker to scaling out, and it is not urgent at one chapter.
15. **[inferred] Websocket lifecycle.** No server heartbeat or send timeout. When the backend restarts or sleeps, every client reconnects after a fixed 3 s with no backoff or jitter (`frontend/hooks/useSessionWebSocket.ts:186-189`).

### Frontend

16. **[measured + inferred] Every signed-in page is a client-rendered shell.** The prerendered HTML is "Loading..." until JavaScript downloads (154–283 kB), hydrates, checks the session and then fetches data (`frontend/components/Protected.tsx:23-55`).
17. **[inferred] Fetch waterfalls with no shared cache.** The dashboard downloads the full `/pnms` list only to read its length (`frontend/app/(dashboard)/dashboard/page.tsx:61-89`). Every navigation refetches.
18. **[inferred] The roster refetches the whole list on every search pause and tag toggle** for nothing: the backend ignores both parameters and the page filters locally anyway (`frontend/app/(dashboard)/pnms/page.tsx:127-175`).
19. **[inferred] Voting is not optimistic.** The card waits for `POST /votes` before changing. In Open Voting it then waits for a second request for the next card (`frontend/app/(dashboard)/voting/page.tsx:272-290`).
20. **[inferred] Every API call is preflighted.** The API is on another origin and every request sends `Authorization` and `Content-Type`, GETs included. Each distinct URL costs an extra round trip the first time.
21. **[inferred] Photos are served as uploaded.** The swipe card is a raw `<img>` at 500 px tall (`voting/page.tsx:853`). There is no resize on upload and no client-side compression. The next PNM's photo is not preloaded. `next.config.mjs:5-7` only allows `i.pravatar.cc`, so `next/image` cannot serve Supabase storage as configured.
22. **[measured] `/rush` and check-in carry about 86 kB gzipped of QR scanner** before the scanner is opened. Nothing in the app uses `next/dynamic`.
23. **[inferred] Polling does not pause when the tab is hidden:** Rush Mode every 5 s, check-in every 3 s (`frontend/app/(dashboard)/rush/page.tsx:87`; `events/[id]/checkin/page.tsx:81`).

### What is fine

- **[measured]** App import is under a second, so cold-start time is Render's, not the code's.
- **[inferred]** JWT verification is not a per-request network call; the key set is cached (`python_server/auth.py:21-28`).
- **[inferred]** Fonts are self-hosted through `next/font` (`frontend/app/layout.tsx:3-26`).
- **[measured]** The websocket path is correct under 24 concurrent voters.

---

## Improvements, ranked by impact against effort

Impact is the effect on what a brother experiences during rush. Effort is working time for one person who knows the code.

| Rank | Change | Impact | Effort | Basis |
|---|---|---|---|---|
| 1 | Find out why production did not answer; move the backend to an always-on instance (or a keep-warm that works) and add `healthCheckPath: /health/db` | High | 1–2 hours | measured |
| 2 | Confirm the Supabase region and put the backend in the same one | High if they differ | 1 hour | inferred |
| 3 | Add request timing: a middleware that logs duration per route, plus Web Vitals on the frontend. Without it every later change is a guess. | Enabler | Half a day | — |
| 4 | Make the vote UI optimistic and preload the next PNM's photo | High (perceived) | Half a day to 1 day | inferred |
| 5 | Collapse `POST /votes` to one or two statements on a single connection | High | Half a day to 1 day | measured locally |
| 6 | Resize photos on upload (about 800 px plus a thumbnail) and compress before upload | High on phones | 1 day | inferred |
| 7 | Send `vote_cast` only to the chair, or throttle it to once a second; do not await it in the voter's request | Medium, high above 40 voters | Half a day | inferred |
| 8 | Stop the roster refetching on search and tag change | Medium | 1 hour | inferred |
| 9 | Load the QR scanner with `next/dynamic` | Medium (about 86 kB off two routes) | 2–3 hours | measured |
| 10 | Cache membership and role per user and chapter for 30–60 s | Medium | 2–3 hours | inferred |
| 11 | Set the CORS `max_age` and stop sending `Content-Type` on GET; later, proxy the API through a Vercel rewrite | Medium | 30 minutes; 2–4 hours for the proxy | inferred |
| 12 | Move image, PowerPoint, PDF and storage work off the event loop | Medium: prevents a stall during a live vote | Half a day to 1 day | measured locally |
| 13 | Acquire one connection per request; wrap multi-write paths in a transaction | High | 1–2 days | inferred |
| 14 | A counts endpoint for the dashboard; paginate and slim `GET /pnms` | Medium, growing | 1 day | measured locally |
| 15 | Move page fetches to react-query with retry and backoff | Medium | 2–4 days | inferred |
| 16 | Pause polling when hidden, or push attendance over the websocket | Low to medium | Half a day to 1 day | inferred |
| 17 | `uvicorn[standard]`; raise pool minimum; drop redundant indexes | Low | 1–2 hours | inferred |
| 18 | Jittered backoff on websocket reconnect; one shared `httpx` client | Low | 2–3 hours | inferred |
| 19 | Move rooms, rate limits and cache to Redis | Low now; required before a second instance | 2–3 days | inferred |
| 20 | Convert the dashboard shell to server components; consolidate UI kits | Low to medium | 3–5 days | measured (bundle sizes) |

Items 1 to 3 cost a morning and decide whether the rest matter. Do them before touching code, then re-measure.

## Not measured

- Any production latency: cold start, warm response, p50 or p95 for any endpoint.
- Anything over a real network or on a real phone.
- More than 24 concurrent voters.
- Vercel project settings and region.
- Round trips per statement (finding 5) were read from the asyncpg source, not traced.
