# Test plan and runbook

**Written 11 November 2026 against `main` at `bd82ecc`.**

## Verdict

Before this plan, the e2e harness loaded all 26 pages but only as the admin, asserted 11 of 103 API endpoints, and never looked at a websocket frame. Six new scripts close those gaps: every endpoint is now called as signed-out, member and admin; every page is loaded in four roles; and the live session is driven by a chair plus concurrent voters with all four websocket events checked.

**Status of the new scripts: run once, not on your machine.** Each ran to completion on 11 Nov 2026 in a Linux container against a local Postgres 16, with the backend and a production build of the frontend on localhost (Node 22.23, Python 3.13, Playwright 1.63). They have **not** been run on macOS, against your Postgres, or with the Playwright version pinned in `e2e/package.json`. Treat the first run on your Mac as their real test and expect to adjust a selector or a timeout.

**Safety rule:** nothing that writes may run against production. Production holds real member data. Every writing script calls a guard first that refuses anything except a local database whose name ends in `_e2e`. The runbook in section 4 shows how to confirm the target before each write.

## Contents

1. [What is tested by what](#1-what-is-tested-by-what)
2. [Page inventory and coverage](#2-page-inventory-and-coverage)
3. [Endpoint inventory and coverage](#3-endpoint-inventory-and-coverage)
4. [Runbook](#4-runbook)
5. [Manual checks](#5-manual-checks)
6. [Results from the 11 Nov run](#6-results-from-the-11-nov-run)
7. [Gaps that remain](#7-gaps-that-remain)

---

## 1. What is tested by what

### Existing scripts (unchanged)

| Script | What it does | Writes? |
|---|---|---|
| `e2e/seed.py` | Wipes 18 tables and seeds one chapter: 32 members, 61 PNMs, 6 events, 3 rounds, 2,345 votes, a bid list | **Truncates.** Has no guard of its own; always run it through `guard.py`. |
| `e2e/fixtures.py` | Writes `e2e/fixtures.json` with ids and a 12-hour sign-in token per member | File only |
| `e2e/smoke.mjs` | Signs in as admin, loads `/dashboard`, prints what it sees. No assertions. | No |
| `e2e/voting.mjs [N]` | 1 chair + N voters: concurrent votes land, lock returns 409, re-vote updates in place. Reads the database, not the socket. | Yes |
| `e2e/crawl.mjs` | As admin: loads 26 pages and clicks up to 45 controls on each. Flags 5xx and blank pages. Its toast check never matches. | Yes, incidentally |
| `e2e/destructive.mjs` | As admin: merge, archive, tag delete, end session, each verified with SQL | **Deletes** |
| `e2e/visual.mjs` | Screenshots all 26 pages at desktop and phone width; overflow, tap-target, contrast and alt checks | No |
| `e2e/verify-changes.mjs` | Bottom nav and End Session behaviour | Yes |
| `e2e/probe-*.mjs` | One-off debugging aids | Some |

None of the existing scripts checks which database it is pointed at.

**Changes to existing scripts on this branch** (needed by the application fixes, not new coverage):

- `lib/harness.mjs` gains `acceptConfirm(page)`. Destructive actions now use an in-app dialog instead of `window.confirm()`, so `destructive.mjs` and `verify-changes.mjs` click its confirm button rather than accepting a native dialog.
- `visual.mjs` measures before taking its full-page screenshot (in Playwright's phone emulation the screenshot switches off the coarse-pointer media feature, so touch-sized controls were measured at their desktop size), counts an input's enclosing `<label>` as its tap area, and no longer treats `alt=""` as missing alt text.

### New scripts

| Script | What it does | Writes? |
|---|---|---|
| `e2e/guard.mjs` | Refuses to continue unless the database is local and disposable **and** the running backend is serving that same database. Imported by every new script; also runs alone. | No |
| `e2e/guard.py` | The same database checks for the Python side. `--seed` then runs `seed.py` and `fixtures.py` with the fallback to `DATABASE_URL` closed. | Only with `--seed` |
| `e2e/ws-voting.mjs [N] [pnms]` | 1 chair + N voters in separate browser contexts. Records every websocket frame per client and asserts `pnm_advance`, `lock_change`, `vote_cast` and `session_ended`: delivery to every client, payload shape, and tallies equal to the database. Also: join by code, favourite, a voter with the socket blocked (polling fallback), members refused chair actions, End Session, and whether a socket with no token can listen. | Yes |
| `e2e/api-contract.mjs` | No browser. Reads `/openapi.json`, then calls every operation signed out, as a member and as admin (exec where relevant). Fails if any operation in the API has no case. | **Yes, and deletes** |
| `e2e/roles.mjs` | Loads every page signed out, as member, as exec and as admin. Checks redirects, the admin gate, 4xx/5xx at load, the menus each role sees, and Open Voting as a member. | One rejected request |
| `e2e/flows.mjs` | Real flows through the UI, each verified in the database: interest form, CSV import, create event, check-in, note and "met", cut preview, bid outcome, intake questions and answers, Open Voting as a member. | Yes |

### What the guard checks

1. `E2E_DATABASE_URL` is set. `DATABASE_URL` is never used as a fallback, because that is what the real backend reads.
2. The host is `localhost`, `127.0.0.1` or `::1`.
3. The database name ends in `_e2e` or `_test`.
4. The URL does not mention a hosted provider (supabase, render, pooler, neon, amazonaws and similar).
5. The server agrees: `current_database()` matches and the server address is loopback.
6. Every chapter in the database is the seed chapter. A database containing any other chapter is refused.
7. The running API returns the same chapter id that psql reads locally. Seed chapter ids are random, so a backend pointed at any other database cannot match.

It prints what it verified, for example:

```
guard: database OK -> postgresql://you@localhost:5432/rushrank_e2e (server says db=rushrank_e2e, addr=127.0.0.1, user=you, seed chapters=1)
guard: backend OK  -> http://localhost:8000 serves seed chapter 5b088a54-…
```

Anything else prints `GUARD REFUSED: <reason>` and exits with code 2.

### "Known" findings

The new scripts recognise the defects already listed in `02-unfinished-and-broken.md`. They print them tagged `known` and do not count them as failures. **A non-zero exit therefore always means something new.** When you fix one of those defects, the matching check starts passing on its own, or its `known` line disappears.

---

## 2. Page inventory and coverage

26 pages under `frontend/app`. There is no `middleware.ts` and no `route.ts`; all gating is client-side.

"Existing" is what `crawl.mjs` and `visual.mjs` did before this plan: load the page as admin (or signed out, for public pages). "Asserted flow" names a script that does something deliberate on the page and checks the result.

| # | Page | Access | Existing coverage | New coverage |
|---|---|---|---|---|
| 1 | `/` | Public | crawl, visual | roles (signed out) |
| 2 | `/get-started` | Public | crawl, visual | roles (signed out); wizard itself is manual (M1) |
| 3 | `/login` | Public | crawl, visual | roles (signed out, and as the redirect target); form is manual (M2) |
| 4 | `/demo` | Public; needs server env | crawl, visual | roles (signed out); manual (M8) |
| 5 | `/intake` | Public with `?chapter=` | crawl, visual | roles (with and without `?chapter=`); API by api-contract; form is manual (M4) |
| 6 | `/interest` | Public with `?chapter=` | crawl, visual | roles; **flows 1, 1b** |
| 7 | `/dashboard` | Signed in | crawl, visual, verify-changes (bottom nav) | roles ×4 |
| 8 | `/rush` | Signed in | crawl, visual | roles ×4; Add PNM with photo is manual (M5) |
| 9 | `/pipeline` | Signed in | crawl, visual | roles ×4; API by api-contract |
| 10 | `/pnms` | Signed in; admin actions hidden | crawl, visual, destructive (archive) | roles ×4 |
| 11 | `/pnms/[id]` | Signed in | crawl, visual | roles ×4; **flows 5** |
| 12 | `/pnms/import` | Signed in; API admin-only | crawl, visual | roles ×4; **flows 2** |
| 13 | `/voting` | Signed in; chair controls for admin | crawl, visual, voting, verify-changes, destructive | roles ×4 (incl. Open Voting as member); **ws-voting** |
| 14 | `/results` | Signed in | crawl, visual (redirect target only) | roles ×4; **flows 6**; ws-voting (redirect) |
| 15 | `/compare` | Signed in; nothing links to it | crawl, visual | roles ×4 |
| 16 | `/analytics` | Signed in; one tab admin-only | crawl, visual | roles ×4 |
| 17 | `/events` | Signed in; writes admin-only | crawl, visual | roles ×4; **flows 3, 3b** |
| 18 | `/events/[id]/checkin` | Signed in | crawl, visual | roles ×4; **flows 4** |
| 19 | `/exports` | Signed in | crawl, visual | roles ×4; export endpoints by api-contract |
| 20 | `/bid-list` | Admin or exec | crawl, visual | roles ×4 (member bounced); **flows 7** |
| 21 | `/settings` | Admin or exec | crawl, visual | roles ×4 (member bounced); **flows 8** |
| 22 | `/admin/users` | Admin (exec admitted by the page, refused by the API) | crawl, visual | roles ×4; invites are manual (M3) |
| 23 | `/admin/tags` | Admin | crawl, visual, destructive (delete attempt) | roles ×4; tag CRUD by api-contract |
| 24 | `/admin/duplicates` | Admin | crawl, visual, destructive (merge) | roles ×4; merge by api-contract |
| 25 | `/admin/audit` | Admin or exec | crawl, visual | roles ×4; audit rows checked by flows 2 and 7 |
| 26 | `/profile` | Signed in | crawl, visual | roles ×4; password change is manual (M2) |

Every page now has at least one check in every role. Pages 2, 3, 4, 5 (form), 8 (photo), 22 (invites) and 26 (password) still depend on email or file storage that a local stack does not have; those are the manual checks in section 5.

---

## 3. Endpoint inventory and coverage

104 endpoints in `python_server/routes.py` (103 at the assessment, plus `round-summary` added on this branch), each mounted under `/api/v1` and again under `/api`. `python_server/main.py` adds five HTTP routes and the websocket.

**Legend**

- Role: **U** any signed-in user; **M** member of the chapter; **A** admin only; **A/E** admin or exec; **P** public.
- Existing coverage: **V** `voting.mjs`, **D** `destructive.mjs`, **VC** `verify-changes.mjs` (all asserted). **load** means a crawled page calls it and only a 5xx would be noticed. **click** means it fires only if the crawler happens to press the right button. **none** means no existing e2e script touches it.
- New coverage: every row is called by `api-contract.mjs` signed out, as member and as admin (exec where the role allows). The column lists anything beyond that. **ext** means the admin call needs Supabase or MailerLite, so locally only authentication and role are asserted.

| # | Method and path | Line | Role | Writes | Existing | New (beyond api-contract) |
|---|---|---|---|---|---|---|
| 1 | GET `/me` | 60 | U | | load | |
| 2 | POST `/admin/reset-password` | 67 | A (of any chapter) | yes | none | ext |
| 3 | POST `/admin/promote-to-admin` | 144 | A (of any chapter) | yes | none | |
| 4 | GET `/memberships` | 207 | A | | load | roles |
| 5 | POST `/memberships/invite` | 238 | A | yes | click | ext |
| 6 | PUT `/memberships/{membership_id}` | 335 | A | yes | click | |
| 7 | GET `/chapters` | 398 | U | | load | guard |
| 8 | POST `/chapters` | 412 | U | yes | none | |
| 9 | POST `/chapters/provision` | 428 | U | yes | none | |
| 10 | GET `/chapters/me/theme` | 451 | U | | load | |
| 11 | PATCH `/chapters/me/theme` | 458 | A | yes | click | |
| 12 | GET `/fraternity-colors` | 473 | P | | load | |
| 13 | GET `/chapters/me/bid-list` | 502 | A/E | | load | flows 7 |
| 14 | POST `/chapters/me/bid-list` | 511 | A/E | yes | none | |
| 15 | POST `/chapters/me/bid-list/lock` | 526 | A/E | yes | click | |
| 16 | POST `/chapters/me/bid-list/lock/refresh` | 535 | A/E | yes | none | |
| 17 | DELETE `/chapters/me/bid-list/lock` | 544 | A/E | yes | click | |
| 18 | PATCH `/chapters/me/bid-list/entries/{pnm_id}` | 554 | A/E | yes | none | |
| 19 | PATCH `/chapters/me/bid-list/entries/{pnm_id}/outcome` | 574 | A/E | yes | click | flows 7 |
| 20 | POST `/chapters/me/bid-list/finalize` | 605 | A/E | yes | none | |
| 21 | GET `/chapters/me/bid-list/export/csv` | 620 | A/E | | click | |
| 22 | GET `/chapters/me/bid-list/export/pdf` | 633 | A/E | | click | |
| 23 | GET `/public/chapters/{chapter_id}` | 658 | P | | load | flows 1 |
| 24 | POST `/public/chapters/{chapter_id}/intake` | 675 | P | yes | none | flows 1 |
| 25 | POST `/public/demo-session` | 719 | P | | load | |
| 26 | PATCH `/pnms/{pnm_id}/gpa` | 791 | M | yes | none | |
| 27 | POST `/pnms/{pnm_id}/gpa-waiver` | 810 | A/E | yes | none | |
| 28 | PUT `/chapters/{chapter_id}/min-gpa` | 863 | A | yes | none | |
| 29 | GET `/chapters/{chapter_id}/duplicates` | 898 | A | | load, D | roles |
| 30 | POST `/pnms/{winner_id}/merge` | 908 | A | deletes | D | |
| 31 | GET `/pnms` | 940 | M | | load | |
| 32 | POST `/pnms` | 1070 | M | yes | none | |
| 33 | GET `/chapters/{chapter_id}/pipeline` | 1088 | M | | load | |
| 34 | PATCH `/pnms/{pnm_id}/pipeline` | 1101 | M | yes | click | |
| 35 | GET `/chapters/{chapter_id}/interest-qr` | 1138 | M | | none | |
| 36 | GET `/chapters/{chapter_id}/pipeline/duplicates` | 1163 | M | | none | |
| 37 | POST `/pnms/{pnm_id}/contacts` | 1190 | M | yes | click | flows 5 |
| 38 | DELETE `/pnms/{pnm_id}/contacts` | 1206 | M | deletes | click | |
| 39 | GET `/pnms/{pnm_id}/contacts` | 1220 | M | | load | |
| 40 | POST `/pnms/import` | 1235 | A | yes unless dry run | none | flows 2 |
| 41 | GET `/pnms/{pnm_id}` | 1279 | M | | load | |
| 42 | GET `/pnms/{pnm_id}/qr` | 1325 | M | yes (a GET that writes) | none | ext |
| 43 | PUT `/pnms/{pnm_id}` | 1364 | M | yes | none | |
| 44 | DELETE `/pnms/{pnm_id}` | 1378 | A | deletes | none | |
| 45 | POST `/pnms/bulk-archive` | 1402 | A | yes | D | |
| 46 | POST `/pnms/export/pptx` | 1454 | A/E | | click | |
| 47 | POST `/pnms/upload-url` | 1503 | M | storage | none | ext |
| 48 | POST `/pnms/{pnm_id}/upload-photo` | 1522 | M | storage | none | ext |
| 49 | GET `/pnms/{pnm_id}/notes` | 1565 | M | | load | |
| 50 | POST `/pnms/{pnm_id}/notes` | 1576 | M | yes | click | flows 5 |
| 51 | DELETE `/notes/{note_id}` | 1590 | A | deletes | none | |
| 52 | GET `/chapters/{chapter_id}/voting-patterns` | 1609 | A | | load | roles |
| 53 | GET `/rounds` | 1623 | M | | load | |
| 54 | GET `/rounds/active` | 1636 | M | | none | |
| 55 | POST `/rounds` | 1645 | A | yes | none | |
| 56 | PUT `/rounds/{round_id}/end` | 1661 | A | yes | none | |
| 57 | POST `/rounds/{round_id}/advance` | 1684 | A | yes | none | |
| 58 | POST `/rounds/{round_id}/lock` | 1698 | A | yes | none | |
| 59 | POST `/votes` | 1712 | M | yes | V | ws-voting |
| 60 | POST `/rounds/{round_id}/votes` | 1824 | M | yes | none | ws-voting (lock bypass) |
| 61 | GET `/rounds/{round_id}/results` | 1841 | M | | load | flows 6 |
| 62 | POST `/rounds/{round_id}/cutoff` | 1854 | A | yes unless dry run | click | flows 6 |
| 63 | GET `/chapters/{chapter_id}/audit-log` | 1900 | A/E | | load | |
| 64 | GET `/events` | 1922 | M | | load | |
| 65 | POST `/events` | 1934 | A | yes | click | flows 3 |
| 66 | DELETE `/events/{event_id}` | 1944 | A | deletes | none | |
| 67 | PATCH `/events/{event_id}` | 1962 | A | yes | click | |
| 68 | GET `/events/{event_id}/attendance` | 1976 | M | | load | |
| 69 | POST `/events/{event_id}/attendance` | 2013 | M | yes | click | flows 4 |
| 70 | POST `/events/export` | 2027 | A | | click | |
| 71 | GET `/tags` | 2047 | M | | load | |
| 72 | GET `/tags/stats` | 2055 | M | | load | |
| 73 | POST `/tags` | 2064 | A | yes | click | |
| 74 | PUT `/tags/{tag_id}` | 2077 | A | yes | click | |
| 75 | DELETE `/tags/{tag_id}` | 2091 | A | deletes | D (unconfirmed) | |
| 76 | POST `/pnms/{pnm_id}/tags/{tag_id}` | 2103 | A | yes | click | |
| 77 | DELETE `/pnms/{pnm_id}/tags/{tag_id}` | 2116 | A | deletes | click | |
| 78 | GET `/questionnaires` | 2132 | M | | load | |
| 79 | POST `/questionnaires` | 2140 | A | yes | click | flows 8 |
| 80 | PUT `/questionnaires/{questionnaire_id}` | 2149 | A | yes | click | |
| 81 | POST `/pnms/{pnm_id}/answers` | 2177 | M | yes | none | |
| 82 | GET `/pnms/{pnm_id}/attendance` | 2190 | M | | load | |
| 83 | GET `/pnms/{pnm_id}/questionnaire` | 2227 | M | | none | |
| 84 | GET `/rounds/{round_id}/status` | 2239 | M | | none | |
| 85 | POST `/rounds/open` | 2290 | A | yes | none | roles (member) |
| 86 | GET `/rounds/open/current` | 2403 | U | | none | |
| 87 | POST `/sessions` | 2484 | A | yes | V, D, VC | ws-voting |
| 88 | POST `/sessions/join` | 2604 | M | | V (conditional) | ws-voting |
| 89 | GET `/sessions/active` | 2711 | U | | V, load | ws-voting |
| 90 | POST `/sessions/{session_id}/lock` | 2769 | A | yes | V | ws-voting |
| 91 | POST `/sessions/{session_id}/end` | 2801 | A | yes | D, VC | ws-voting |
| 92 | POST `/sessions/{session_id}/advance` | 2846 | A | yes | V, VC | ws-voting |
| 93 | GET `/sessions/{session_id}/current` | 2937 | M | | V | ws-voting (polling voter) |
| 94 | GET `/export/csv` | 3012 | M | | click | |
| 95 | GET `/pnms/{pnm_id}/share-card` | 3045 | M | storage | none | ext |
| 96 | GET `/exports/pnms.csv` | 3059 | M | | none | |
| 97 | GET `/exports/rounds/{round_id}.csv` | 3073 | M | | none | |
| 98 | GET `/rounds/{round_id}/export` | 3091 | M | | none | |
| 99 | POST `/exports/pnm-card/{pnm_id}` | 3098 | M | storage | click | ext |
| 100 | POST `/exports/pnm-cards/bulk` | 3111 | M | storage | click | ext |
| 101 | GET `/health` (under `/api`) | 3137 | P | | none | |
| 102 | GET `/qr.png` | 3143 | P | | none | |
| 103 | GET `/qr` | 3153 | P | | none | |
| 104 | GET `/chapters/{chapter_id}/round-summary` (added on this branch) | – | M | | none | api-contract (matched against per-round results and the votes table) |

`python_server/main.py`:

| Method and path | Line | Existing | New |
|---|---|---|---|
| GET `/` | 209 | none | api-contract |
| GET `/health` | 214 | none | api-contract |
| GET `/health/db` | 230 | none | api-contract |
| GET `/health/storage` | 243 | none | api-contract (ext) |
| OPTIONS `/{full_path}` | 190 | none | api-contract (allowed origin 200, foreign origin refused) |
| WS `/ws/session/{session_id}` | 287 | voting (connection only) | **ws-voting** (all four events, plus an unauthenticated listener) |

**Summary.** Before: 11 endpoints asserted, about 28 exercised only at page load, about 25 only by a lucky click, about 40 not at all. After: all 104 plus the six in `main.py` are called with an expected status in each role. Nine of them (marked ext) are checked for authentication and role only.

### Websocket contract asserted by `ws-voting.mjs`

| Event | Payload checked | Triggered by | Checked for |
|---|---|---|---|
| `pnm_advance` | `current_pnm_id`; `pnm` with `id`, `name`, `major`, `hometown`, `year`, `photo_url`, `tags` | chair clicks Next PNM | reaches every voter; id and name match the database; every card changes; polling voter catches up |
| `lock_change` | `locked: true` then `false` | chair clicks Lock / Unlock Voting | reaches chair and every voter; buttons disable; direct `POST /votes` returns 409 and writes nothing |
| `vote_cast` | `pnm_id`; `tallies` with `yes`, `no`, `unknown`, `favorites`, `votes_collected` | every `POST /votes` | chair receives them; final tallies equal the database; chair's Votes Collected updates |
| `session_ended` | `round_id` | chair clicks End Session | reaches everyone; session closed in the database; votes kept; all redirected to Results; second end returns 404 |

Any event type other than these four is reported.

---

## 4. Runbook

Run on your Mac, from the repository root unless a step says otherwise. Steps 1 to 6 are setup. Stop at the first step whose result does not match.

### Prerequisites

- PostgreSQL running locally, with `psql` and `createdb` on your `PATH`.
- Node 20 or later. Node 22 or later is needed for one check in `ws-voting.mjs` (the unauthenticated socket); on older versions that check is skipped and says so.
- Python 3.11 (what Render and CI use).
- Ports 3000 and 8000 free.
- Three terminal windows: **A** for the backend, **B** for the frontend, **C** for the tests.

### Step 1. Create the disposable database

```bash
createdb rushrank_e2e
```

```bash
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d rushrank_e2e -f "$f" || break; done
```

```bash
psql -d rushrank_e2e -tAc "select count(*) from information_schema.tables where table_schema='public'"
```

**Expected:** no errors from the loop, and the last command prints `25`.

If the database already exists from August, drop it first with `dropdb rushrank_e2e` so the schema is current.

### Step 2. Python environment

```bash
python3.11 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r python_server/requirements.txt -r python_server/requirements-dev.txt
```

**Expected:** installs without errors. `.venv` is already in `.gitignore`.

### Step 3. Load the e2e environment and confirm the target (terminal C)

```bash
set -a && . ./e2e/env.sh && set +a
```

`e2e/env.sh` sets `E2E_DATABASE_URL` to `postgresql://coleh@localhost:5432/rushrank_e2e`. If your local Postgres user is different, edit that one line in your working copy first.

```bash
python3 e2e/guard.py
```

**Expected:** one line starting `guard: database OK -> postgresql://…@localhost:5432/rushrank_e2e` and then `guard: safe to proceed.`

**If you see `GUARD REFUSED`, stop.** Read the reason. Do not work around it.

### Step 4. Seed

```bash
python3 e2e/guard.py --seed
```

**Expected:** the guard line again, then the seed's table counts ending with `votes 2345`, `bid_lists 1`, `bid_list_entries 24`, then `wrote …/e2e/fixtures.json` with `users 32`.

This is the only command in the runbook that truncates. It runs `seed.py` only after the guard passes, and forces `DATABASE_URL` equal to `E2E_DATABASE_URL` for that process.

### Step 5. Start the backend (terminal A)

```bash
source .venv/bin/activate && set -a && . ./e2e/env.sh && set +a && uvicorn python_server.main:app --host 127.0.0.1 --port 8000
```

In terminal C:

```bash
curl -s http://localhost:8000/health
```

**Expected:** `{"status":"healthy","database":"connected","supabase_configured":true}`

The backend must be started from a shell that has sourced `e2e/env.sh`. If your root `.env` holds production values, that is still safe: `main.py` does not override variables that are already set. Step 7 proves which database it ended up on.

### Step 6. Build and start the frontend (terminal B)

```bash
cd frontend && npm ci
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://e2elocal.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-local-anon NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build
```

```bash
npx next start -p 3000
```

**Expected:** the build ends with a route table of 28 static pages; `next start` prints `Ready`.

Three things matter here:

- The Supabase URL's first label must be exactly `e2elocal`. The harness writes the sign-in session under a storage key derived from it. With any other value every page bounces to `/login`.
- If `frontend/.env.local` exists with real values, move it aside for the build. `NEXT_PUBLIC_*` values are baked in at build time.
- Use a production build, not `npm run dev`. The dev server compiles pages on first visit, which makes the timing-sensitive scripts flaky.

Then, in terminal C:

```bash
cd e2e && npm install && npx playwright install chromium
```

### Step 7. Confirm the backend is on the e2e database (terminal C, in `e2e/`)

```bash
node guard.mjs --api
```

**Expected:**

```
guard: database OK -> postgresql://…@localhost:5432/rushrank_e2e (server says db=rushrank_e2e, addr=127.0.0.1, user=…, seed chapters=1)
guard: backend OK  -> http://localhost:8000 serves seed chapter <uuid>
guard: safe to proceed.
```

This is the check that matters before anything writes. It proves the API on port 8000 returns the chapter that exists only in your local `rushrank_e2e`. **Run it again before any existing script** (`voting.mjs`, `crawl.mjs`, `destructive.mjs`, `verify-changes.mjs`), because those have no guard of their own. The new scripts run it themselves.

### Step 8. Read-only suites

```bash
node smoke.mjs
```

**Expected:** `final url : http://localhost:3000/dashboard`, `redirected to login: false`, `errors : 0`. If it says `redirected to login: true`, the frontend build is wrong; see Troubleshooting.

```bash
node roles.mjs
```

**Expected (about 4 minutes):** `88 page loads`, and `0 new`. Five findings tagged `(known)` are listed in section 6. Exit code 0. It also checks, per role, that Compare opens `/compare` from two ticked rows and that only admin and exec are offered the PowerPoint export.

```bash
node visual.mjs
```

**Expected:** `0 visual finding(s)`, with screenshots in `e2e/screens/` and `e2e/report-visual.json`. It checks horizontal overflow, 44px tap targets on the phone viewport, contrast and alt text on all 26 pages.

### Step 9. Live voting

```bash
node ws-voting.mjs 24 4
```

**Expected (about 1 minute):** `59 checks passed`, `0 new blocker/high`, exit code 0. Four findings tagged `(known)`: the lock bypass on the legacy vote endpoint, the favourite cleared by a later vote, the polling voter not told the session ended, and the unauthenticated websocket.

To push harder, raise the voter count. The seed has 28 members, and one is reserved as the polling voter, so 27 is the ceiling without changing the seed.

```bash
node guard.mjs --api && node voting.mjs 24
```

**Expected:** `0 finding(s)`. One console line about a 409 is the deliberate forced vote.

### Step 10. API sweep (writes and deletes)

```bash
node api-contract.mjs
```

**Expected (about 15 seconds):** `288 assertions over 108 operations`, `FAILED 0`, `uncovered 0`, `external 9`, and eight `known` lines. Exit code 0.

Then reseed, because this script deletes PNMs and finalizes the bid list:

```bash
cd .. && python3 e2e/guard.py --seed && cd e2e
```

### Step 11. UI flows (writes)

```bash
node flows.mjs
```

**Expected (about 2 minutes):** `12 flows: 10 ok, 2 known defect(s), 0 new failure(s)`. Exit code 0. The two known: `/events?action=add` does not open the form, and check-in search lists the whole roster. Flows 8, 8b and 9 cover intake questions (saved in Settings, asked on the public link, shown on the PNM page) and Open Voting for a member.

```bash
cd .. && python3 e2e/guard.py --seed && cd e2e
```

### Step 12. Crawl and destructive (existing scripts; writes and deletes)

```bash
node guard.mjs --api && node crawl.mjs
```

**Expected:** `e2e/report-crawl.json`. In August this pressed 437 controls with no blank page and no bounce to login.

```bash
cd .. && python3 e2e/guard.py --seed && cd e2e
```

```bash
node guard.mjs --api && node destructive.mjs
```

**Expected:** `6/6 checks passed`. The tag-delete step prints "no delete control reachable"; the kebab menu has never been reachable by this script.

```bash
cd .. && python3 e2e/guard.py --seed && cd e2e
```

```bash
node guard.mjs --api && node verify-changes.mjs
```

### Step 13. Backend tests

From `python_server/`, with the virtualenv active:

```bash
pytest -q -m "not integration"
```

**Expected:** `84 passed`.

```bash
TEST_DATABASE_URL=postgresql://$(whoami)@localhost:5432/postgres pytest -q -m integration
```

**Expected:** `159 passed`.

The integration tests create and drop three databases of their own on that server: `rr_it_fresh`, `rr_it_legacy` and `rr_it_demo`. They do not touch `rushrank_e2e`. **Only ever point `TEST_DATABASE_URL` at your local Postgres**, because the suite issues `DROP DATABASE`.

### Step 14. Frontend checks

From `frontend/`:

```bash
npm run lint && npm run typecheck && npm run test
```

**Expected:** lint prints warnings only (`<img>` and hook-dependency warnings), no errors; typecheck is clean; 12 vitest tests pass.

### Step 15. Production: look, do not touch

Run nothing from `e2e/` against production. These read-only checks are safe:

```bash
curl -s -m 60 -o /dev/null -w "%{http_code} %{time_total}s\n" https://rushrank-backend.onrender.com/health
```

**Expected:** `200` and a time. On 11 Nov this timed out three times at 120 s. If it still does, check the service in the Render dashboard before anything else. If the first call is slow and a second is fast, that gap is your cold-start time; write it down.

Then, in a browser on your phone: sign in, open PNMs, open Voting. Do not start a session, import, merge or delete anything.

### When you are done

Stop the backend and frontend. Restore `frontend/.env.local` if you moved it. To remove the test database: `dropdb rushrank_e2e`.

### Troubleshooting

| Symptom | Cause |
|---|---|
| Every page lands on `/login` | The frontend was not built with `NEXT_PUBLIC_SUPABASE_URL=https://e2elocal.supabase.co`, or `frontend/.env.local` overrode it. Rebuild. |
| `guard: … rejected the fixture token (401)` | Tokens last 12 hours: rerun `python3 e2e/guard.py --seed`. Or the backend was not started with `e2e/env.sh` sourced. |
| `guard: … is NOT serving the e2e database` | Another backend is on port 8000. Stop it. |
| `GUARD REFUSED: DATABASE_URL is set to something different` | Your shell exported a real `DATABASE_URL`. Source `e2e/env.sh` again. |
| `psql: command not found` from a script | Put Postgres's `bin` directory on your `PATH`. |
| A voter "could not click Yes" | The page had not settled. Rerun; if it repeats, raise the `settle` delays in the script. |
| `ws-voting`: "star button not found" | The star is located by its icon class. The script falls back to the API and says so. |
| A script hangs at `chromium.launch()` | Run `npx playwright install chromium` in `e2e/`. |

---

## 5. Manual checks

These need real email, real file storage, or a second chapter. Do them on a **staging or throwaway Supabase project**, never the production one.

| # | Check | Expected today |
|---|---|---|
| M1 | Sign up at `/get-started` with a new email; open the magic link in the same browser | Lands on `/dashboard?welcome=1` as admin of a new chapter |
| M1b | Open the magic link in a different browser | Known broken: signed in, no chapter, no error |
| M2 | Sign in at `/login`; Forgot password; set a new one; change it again on `/profile` | Works. Requires the deployed domain in Supabase's redirect allow-list. |
| M3 | Invite one address and three in bulk from `/admin/users`; check the inbox | Depends on the MailerLite automation. Record whether an email arrives. |
| M4 | Open `/intake?chapter=<id>` signed out; submit with and without a photo | Known broken: photo upload fails; ends on `/login` |
| M5 | Rush → Add PNM with a photo taken on a phone | PNM created with photo, checked in to today's event |
| M6 | Scan a PNM's emailed QR with the in-app scanner on `/events/<id>/checkin` | Checks them in |
| M7 | Export a PNM card, the card ZIP and the `.pptx`; open each | Files open and show the right people |
| M8 | Set `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD`; open `/demo` | Signs in read-only. Known gap: the demo user cannot open the bid list. |
| M9 | With two chapters: as admin of A, try to rename a tag of B, and to seed a bid list from B's round | Known holes S5 and S6: both currently succeed. After the fix, both should be refused. |
| M10 | On two phones on mobile data, run a session with the laptop as chair | Subjective: how long a vote takes to register, how long a card takes to change. Write the numbers down; there are none yet. |
| M11 | Kill the backend mid-session and restart it | Clients should show Polling, reconnect within a few seconds, and carry on |

---

## 6. Results from the 11 Nov run

Environment: Linux container, PostgreSQL 16 on localhost, one `uvicorn` process, production build of the frontend, seed 20260903.

| Script | Result |
|---|---|
| `guard.mjs`, `guard.py` | Passed on the local database. Refused, with exit code 2: a hosted-looking URL, a database named `postgres`, an unset `E2E_DATABASE_URL`, and a conflicting `DATABASE_URL`. |
| `ws-voting.mjs 24 4` | 59 checks passed (including End Session's confirm dialog and a PNM added mid-session joining the end of the order). 4 known findings. Exit 0. |
| `api-contract.mjs` | 288 assertions over 108 operations (the new round-summary endpoint is checked against the per-round results and the votes table). 0 failed, 0 uncovered, 9 external, 8 known. Exit 0. |
| `roles.mjs` | 88 page loads. 5 known findings, 0 new. Exit 0. |
| `flows.mjs` | 12 flows: 10 ok, 2 known. Exit 0. |
| `voting.mjs 8` (existing) | 0 findings |
| `pytest -m "not integration"` | 84 passed |
| `pytest -m integration` | 159 passed |
| `smoke.mjs` (existing) | Landed on `/dashboard`, 0 errors |
| `next build`, `tsc --noEmit` | Passed |
| `npm run lint`, `npm run test` | Lint: warnings only. Vitest: 12 passed. |

| `destructive.mjs` (existing) | 6/6 checks passed. The tag-delete step still cannot reach the kebab menu, as in August. |
| `verify-changes.mjs` (existing) | 12 passed |
| `voting.mjs 24` (existing) | 0 findings |
| `visual.mjs` (existing) | 0 findings on all 26 pages at desktop and phone width |

Defects the new scripts confirmed at runtime, all detailed in `02-unfinished-and-broken.md`:

| Finding | Confirmed by |
|---|---|
| S3 websocket accepts a listener with no token | ws-voting |
| S9 legacy vote endpoint ignores the lock | ws-voting |
| S10 vote accepted for a PNM not in the round | api-contract |
| S11 finalized bid list still editable through the API | api-contract |
| S12 anonymous note returns the author id | api-contract |
| S16 any user can create a chapter | api-contract |
| S17 `GET /rounds` returns 500 to a non-member | api-contract |
| F1, F2, F3 questionnaire save, answer save and answer read all return 500 (since fixed) | api-contract, flows |
| F4 Open Voting refused for members (since fixed) | roles |
| F5 anonymous session still stores the voter | api-contract |
| F6 `exec` cannot be assigned | api-contract |
| F7 exec admitted to pages whose API refuses them | roles |
| F10 check-in search lists the whole roster | flows |
| F13 vote after favourite clears the favourite | ws-voting |
| F14 polling voter not told the session ended | ws-voting |
| F18 legacy round advance and lock return 500 | api-contract |
| F19 `/events?action=add` ignored | flows |
| F32 no Results link on a phone | roles |
| F33 chapter names are globally unique | api-contract (first draft of the test) |

---

## 7. Gaps that remain

- **No performance numbers over a real network.** Everything measured was on localhost. See M10 and `01-tech-stack.md`.
- **No test above 27 concurrent voters.** The seed has 28 members. A 60-voter test needs a larger seed.
- **Cross-chapter isolation is not automated.** The seed has one chapter and the guard refuses a second. Findings S5, S6 and S7 are confirmed by reading the code only (M9).
- **Email, storage and the signup wizard are manual.**
- **The UI's swipe gesture is not driven;** votes are cast with the buttons.
- **`crawl.mjs`'s toast check is dead** (`e2e/crawl.mjs:88` looks for attributes the app's toasts do not have), so it cannot see an error toast.
- **None of this runs in CI.** The workflow is disabled, and it has no e2e job.
- **The existing scripts still have no guard.** The runbook puts `node guard.mjs --api &&` in front of each. Adding the import to them is proposal P6 in `07-proposals.md`.
