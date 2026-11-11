# Proposals: other things worth tackling

**Written 11 November 2026.** None of this has been acted on. Each item is a proposal with its reasoning, for you to accept, defer or reject.

## Verdict

Three proposals should happen before any feature work, because they limit damage rather than add value: close the password-reset hole (P1), find out whether production tables are readable with the public key (P2), and get production and CI running again (P3, P4). Together they are about a day. The rest is ordered by how much it reduces the chance of an unpleasant surprise during a real rush.

Finding numbers (S1, F5 and so on) refer to `02-unfinished-and-broken.md`.

## Do before anything else

### P1. Close the cross-chapter admin endpoints

**What:** remove `POST /admin/reset-password` and `POST /admin/promote-to-admin`, or scope both to "admin of the target user's chapter". Neither has a caller in the frontend.

**Why:** any person who signs up becomes an admin of their own new chapter, and that is all these endpoints check. As written, a stranger can set the password of any account by email address [S1, S2]. This is the most serious finding in the reassessment, and the fix is deleting about 140 lines.

**Effort:** 1 hour, including a test.

### P2. Check row-level security on the production database

**What:** in the Supabase dashboard, look at whether RLS is enabled on `pnms`, `users`, `votes`, `pnm_notes` and the rest. If it is not, either enable it with deny-all policies (the backend uses the service role and is unaffected), or confirm the tables are not exposed through the REST API.

**Why:** no migration enables RLS [S4]. The frontend ships the Supabase anon key to every browser, as it must. If the tables have no RLS, that key can read PNM names, emails, phone numbers and votes directly, bypassing the backend. This cannot be determined from the repository. It takes five minutes to check and matters more than anything else on this page if the answer is bad.

**Also:** the landing page says "Postgres row-level security" (`frontend/components/marketing/FeatureGrid.tsx:6`). Make that true or change the sentence.

**Effort:** 5 minutes to check; 1–2 hours to add a migration with deny-all policies and test that the app still works.

### P3. Find out why production is down, and decide where the backend lives

**What:** open the Render dashboard. Establish whether the service is suspended, crashing at boot, or merely asleep. Then decide: pay for an always-on instance, or accept cold starts and fix the frontend to wait for them.

**Done on this branch:** the frontend now retries a read once, with a "Waking up the server" message, when the backend times out or answers 502–504; `render.yaml` has a database health check; the keep-warm workflow fails visibly when the backend does not answer. What remains is yours: why production is down, the plan, and re-enabling the workflow.

**Why:** three health checks timed out at 120 seconds on 11 Nov [O2]. A free instance with a disabled keep-warm job [O1] means the first brother to open the app at a meeting gets an error toast, because the frontend gives up after 20 seconds. Every performance improvement in `01-tech-stack.md` is moot until this is settled.

**Effort:** 1 hour.

### P4. Turn CI back on

**What:** re-enable the `CI` workflow on GitHub and get it green. Leave `Warm Backend` off unless P3 concludes it is needed, and if so fix it so a failed ping fails the job.

**Why:** the workflow file is good: migrations applied to a real Postgres, 91 unit and 145 integration tests, lint, typecheck, vitest and a build. It has not run since January [O1]. All of those pass locally today, so this should be a matter of clicking Enable and reading the first run.

**Effort:** 30 minutes to 2 hours.

## Do soon

### P5. Authenticate the websocket

**What:** require the access token when the socket opens (as a query parameter or first message), verify it, and check the user is a member of the session's chapter.

**Why:** the socket accepts anyone and broadcasts PNM names, photos and tallies [S3]. The new test shows a tokenless client receiving events. Session ids are UUIDs, so this is hard to exploit by guessing, but the id is visible to every member and never expires within a session.

**Effort:** half a day, including the client hook.

### P6. Put the database guard inside the existing scripts

**What:** make `e2e/seed.py` refuse on its own (import the checks from `guard.py`), and add `await guard()` to `voting.mjs`, `crawl.mjs`, `destructive.mjs` and `verify-changes.mjs`. Remove the hardcoded fallback URL in `voting.mjs`.

**Why:** this reassessment was not allowed to change existing files, so the guard is a wrapper the runbook has to remember to call. `seed.py` on its own still truncates whatever `DATABASE_URL` points at [S18]. One command typed in the wrong terminal would wipe production's `users` and `chapters`. The guard should be impossible to skip.

**Effort:** 1 hour.

### P7. Fix the cross-chapter checks in one pass

**What:** scope tag update and delete, tag-to-PNM, bid-list seeding, bulk card export and attendance writes to the caller's chapter [S5, S6, S7, S8]. Add a second chapter to the e2e seed so these can be tested, and extend `api-contract.mjs` to assert a 403 or 404 for each.

**Why:** they are the same mistake in five places: an id from the request is trusted without checking which chapter owns it. Fixing them together, with a test that would have caught them, costs little more than fixing one. With a single chapter in production they are latent; with a second chapter they are live.

**Effort:** 1 day.

### P8. Add error monitoring and request timing

**What:** Sentry (or equivalent) on the backend and frontend, and a middleware that logs duration per route.

**Done on this branch:** Sentry error reporting on both sides, switched off until `SENTRY_DSN` (Render) and `NEXT_PUBLIC_SENTRY_DSN` (Vercel) are set. Request timing is not done yet.

**Why:** a production 500 is currently invisible [O3], and there is not a single production latency number. The questionnaire save has probably been returning 500 for months [F1] without anyone knowing. Timing is also the first step of the performance work in `01-tech-stack.md`.

**Effort:** half a day.

### P9. Decide what "anonymous" and "exec" mean, then make the product match

**What:** two product decisions, each followed by a small build.

- *Anonymous:* either votes in an anonymous session are stored without the voter (so nobody, including you, can ever attribute them), or the checkbox is removed. A middle option, hiding attribution from admins in the app while keeping it in the database, is weaker and should be described honestly if chosen.
- *Exec:* write down what an exec may do that a member may not, and what an admin may do that an exec may not. Then make it assignable and enforce it in one place.

**Why:** both are on the screen today and neither does what it says [F5, F6, F7]. Both come up in the first conversation with any chapter. The competitor review shows GreekPad already separates member and exec access.

**Effort:** the decisions are yours; the builds are 1–3 days each.

## Housekeeping

### P10. Correct `CLAUDE.md` and prune stale docs

**What:** fix the five stale statements in `CLAUDE.md` [O5] and the Status section of `docs/FEATURES.md` [O6]. Delete or archive the old debugging notes (`docs/DEBUG_EVENTS_ISSUE.md`, `docs/EVENTS_DEBUG_SUMMARY.md`, `docs/VOTING_PAGE_REIMPLEMENTATION.md`, `docs/QR_EMAIL_TROUBLESHOOTING.md`, the two MailerLite HTML templates, `frontend/LAYOUT_COMPARISON.md`, `frontend/TOPBAR_*.md`). Mark `docs/AUDIT-2026-08.md` as superseded by this folder.

**Why:** `CLAUDE.md` is what any tooling or new contributor reads first, and it currently says the app uses RLS and reads its token from `localStorage`. The August audit made the same point about stale status documents; a smaller set has accumulated since.

**Effort:** 1 hour.

### P11. Declare every environment variable in one place

**What:** add `SUPABASE_JWT_SECRET`, `PUBLIC_SITE_URL`, `MAILERLITE_*`, `DEMO_USER_*`, `SUPABASE_EXPORTS_BUCKET` and `LOG_FORMAT` to `.env.example` and `render.yaml`. Replace the hardcoded `https://rushrank.app` in invite and QR links with `PUBLIC_SITE_URL` [F34, O4].

**Why:** invites and QR emails fail silently when `MAILERLITE_API_KEY` is unset, and nothing in the deploy config says it is needed. A second deployment (staging, or a fork) would send links to the wrong domain.

**Effort:** 1–2 hours.

### P12. Remove dead code

**What:** the legacy round endpoints that cannot work [F18] and the legacy vote endpoint that bypasses the lock [S9]; `POST /chapters` [S16]; the unused API wrappers and `useMe`; the unimported playground components under `frontend/components/ui/`; the `console.log` calls in `frontend/lib/api.ts` and the events and voting pages. Then drop the legacy `attendance` and `notes` tables that migration 0013 copied but kept, and stop double-writing `selected_pnm_ids` alongside `round_pnms`.

**Why:** two of these are security findings that exist only because old endpoints were left in place. The rest is surface area that `api-contract.mjs` now has to carry.

**Effort:** half a day for the code; the table drops want a production backup first.

### P13. A staging environment

**What:** a second Supabase project and a second Render service, with the e2e seed loaded, deployed from `main`.

**Why:** the manual checks in the test plan (signup, invites, password reset, photo upload, the demo) need real email and storage and must not be run against production. Today there is nowhere to run them. It is also where a prospect chapter could click around.

**Effort:** half a day, plus whatever the second Render instance costs.

### P14. Back up before the next change to production

**What:** a database dump before applying any migration or fix, kept outside the repo (`.backups/` is already git-ignored), and a note of how to restore it.

**Why:** production holds one chapter's real rush data and the migrations are append-only by convention, not by tooling. Several proposals above change the schema or delete endpoints.

**Effort:** 30 minutes.

### P15. Decide on pricing and licence before the second chapter

**What:** choose free, a flat per-semester price, or free with a paid tier; and add a `LICENSE` file; the repository has none.

**Why:** competitors have set an expectation of roughly $80 to $220 a semester (see `04-competitors.md`). The landing page's footer has a Pricing link that goes nowhere. If the repository is public, the absence of a licence means nobody else may legally run the code, which may or may not be what you intend.

**Effort:** a decision, then an hour.

## Suggested order

| When | Proposals |
|---|---|
| Today, before running tests | P2 (5-minute check), P3, P14 |
| This week | P1, P4, P6, P8 |
| Before inviting a second chapter | P5, P7, P9, P13, P15 |
| When convenient | P10, P11, P12 |
