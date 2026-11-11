# Unfinished and broken work

**Checked 11 November 2026 against `main` at `bd82ecc`.**

## Verdict

The six blockers in the August audit are fixed, and so is everything `e2e/FINDINGS.md` lists as fixed. What is left falls into three groups:

1. **Security holes the August audit did not find.** The worst: any signed-up user can set any other user's password. Fix these before another chapter is invited.
2. **Features that are wired but do not work.** Saving intake questions returns a 500. Open Voting is broken for ordinary members. "Anonymous votes" changes nothing. The `exec` role cannot be assigned. GPA eligibility has no UI.
3. **Operations.** Both GitHub workflows are disabled and the production backend did not answer when probed.

Of the 112 items in the August audit and `e2e/FINDINGS.md`, as first assessed: **51 fixed, 37 still open, 23 changed** (partly fixed, or fixed in a different shape), and 1 that cannot be checked from the repo. Appendices A and B list every item with its file and line.

### Update: fixed on this branch after the assessment

Of the 37 open items, 25 were then fixed on this branch and one ("Warm the backend") was changed as far as code can take it; Appendix A and B rows are marked **Fixed on this branch**. The other 11 were left open on purpose and are listed at the end of this section. Findings fixed along the way:

- **F28** (partly): the roster's PowerPoint button is shown to admin and exec only, and "Export Filtered" now filters.
- **F29** (partly): "Total votes cast" counts votes. The hardcoded "+12%" badge and the two "coming soon" buttons remain.
- **F26** (partly): a magic link opened in another browser now says so instead of doing nothing. The founder still gets no password.
- **F33**: a taken chapter name returns a readable 409 instead of a 500.
- **F1, F2, F3 and F4** (intake questions and Open Voting for members): fixed in a later commit on this branch. F11 is partly fixed.
- **New, found and fixed:** `/analytics` rendered a second, placeholder top bar (a Subframe logo, "Home / Inbox / Reports" and a stock-photo avatar) under the real one.

Still open from the August list, by choice: no chapter switcher; the `.bg-white` dark-mode override; `/login` dark variants, fixed-width card and duplicated reset branch; `/get-started` unstyled inputs and unlabeled stepper; "Add PNM" in two dashboard grids; the native event dropdown on `/rush`; the 1200px roster table on a phone; "Your Progress" resetting on refresh.

Every security finding (section 1) and every other functional finding (section 2) below is unchanged unless listed above.

## How to read this

- **Fixed / Still open / Changed** is the status against the current code.
- **Confirmed at runtime** means a script in `e2e/` reproduced it on 11 Nov 2026 against a local stack (local Postgres 16, backend and frontend on localhost, seeded with `e2e/seed.py`). Everything else was confirmed by reading the code only.
- **Suspected** means the code suggests it but nothing proved it.
- Paths are relative to the repo root. `(dashboard)` paths are under `frontend/app/`.

---

## 1. Fix first: security and data exposure

| # | Finding | Evidence | How confirmed |
|---|---|---|---|
| S1 | **Any signed-up user can reset any other user's password.** `POST /admin/reset-password` only checks that the caller is an admin of *some* chapter. Self-serve signup makes every new user the admin of their own chapter, so the check passes for anyone. The endpoint then sets the password for whatever email is supplied, across all chapters. | `python_server/routes.py:83-88` (check), `:99-130` (reset); `python_server/services.py:299-303` (signup grants admin) | Code read. Role gate confirmed at runtime: member 403, admin passes the gate. |
| S2 | **Any chapter admin can promote a user to admin in every chapter that user belongs to.** Same "admin anywhere" check. | `python_server/routes.py:161-195` | Runtime: admin call returns 200. |
| S3 | **The websocket has no authentication.** Anyone who knows or guesses a session id receives PNM names, photos and live tallies. | `python_server/main.py:287-296`; `python_server/websocket.py:20-26` | **Confirmed at runtime**: a socket with no token received `session_ended` (`e2e/ws-voting.mjs`). |
| S4 | **No row-level security exists in any migration.** The only RLS statements are commented out. The landing page and `CLAUDE.md` both claim RLS. If the production tables also have none, the public anon key can read them through Supabase's REST API. | `supabase/migrations/0002_views_indexes.sql:120-125`; claim at `frontend/components/marketing/FeatureGrid.tsx:6` | Code read. Production state **not checked**; see proposal P2 in `07-proposals.md`. |
| S5 | **Tag update and delete are not scoped to the caller's chapter.** An admin of chapter A can rename or delete chapter B's tag by id. Adding a tag to a PNM does not check the tag's chapter either. | `python_server/routes.py:2077-2114`; `python_server/services.py:2656-2674` | Code read. Needs two chapters to reproduce. |
| S6 | **A bid list can be seeded from another chapter's round**, exposing that chapter's PNM names, photos and vote counts. | `python_server/bid_list.py:48-55,116-128`; `python_server/routes.py:511-523` | Code read. |
| S7 | **Bulk card export skips the per-PNM chapter check** when `pnm_ids` is sent with a `chapter_id`. | `python_server/routes.py:3120-3133`; `python_server/services.py:2466-2478` | Code read. |
| S8 | **Attendance is written with the body's `event_id`, not the one in the path.** Membership is checked for the path event only. | `python_server/routes.py:2020-2025`; `python_server/services.py:2283-2289` | Code read. |
| S9 | **A second vote endpoint ignores the chair's lock.** `POST /rounds/{id}/votes` has no lock check, no rate limit and no broadcast. | `python_server/routes.py:1824-1839` | **Confirmed at runtime**: returned 200 and wrote a vote while the session was locked. |
| S10 | **`POST /votes` accepts a vote for a PNM that is not in the round.** | `python_server/routes.py:1771-1777` | **Confirmed at runtime**: 200. |
| S11 | **A finalized bid list can still be edited through the API.** The UI disables editing; the entry-update path never checks `finalized_at`. | `python_server/bid_list.py:225-256` | **Confirmed at runtime**: 200 after finalize. |
| S12 | **Anonymous notes return the author's id** to every member who loads the PNM. | `python_server/services.py:2581` | **Confirmed at runtime.** |
| S13 | **The public `/qr` page interpolates the PNM's name and email into HTML unescaped.** The name is settable through the public intake form. The two QR routes also reveal whether an email belongs to a PNM, in any chapter. | `python_server/routes.py:3143-3179` | Code read. |
| S14 | **The rate-limit bucket is chosen from an unverified JWT `sub`.** On the public routes a forged token with a fresh `sub` gets a fresh bucket on every request. | `python_server/rate_limit.py:59-69` | Code read. |
| S15 | **No last-admin guard.** An admin can demote the only admin, themselves included. There is also no way to remove a member at all. | `python_server/routes.py:335-372` | Code read. |
| S16 | **Any signed-in user can create chapters** through `POST /chapters`, which has no role check and is not used by the frontend. | `python_server/routes.py:412-426` | **Confirmed at runtime**: member got 200. |
| S17 | **`GET /rounds` returns 500 instead of 403 to a non-member.** A blanket `except Exception` swallows the membership error. | `python_server/routes.py:1629-1634` | **Confirmed at runtime.** |
| S18 | **`e2e/seed.py` truncates whatever database it is given.** It falls back to `DATABASE_URL` and truncates 18 tables, `users` and `chapters` included, with no check. | `e2e/seed.py:117-130` | Code read. `e2e/guard.py` now wraps it; `seed.py` itself is unchanged. |

---

## 2. Broken or half-wired features

| # | Finding | Evidence | How confirmed |
|---|---|---|---|
| F1 | **Fixed on this branch.** Saving intake questions failed with a 500: the service passed a Python dict to asyncpg for a `jsonb` column. It now encodes on write and decodes on read. | `python_server/services.py` QuestionnaireService | Checked by `tests/integration/test_intake_questions_and_open_voting.py` and `e2e/flows.mjs` flow 8. |
| F2 | **Fixed on this branch.** Questionnaire answers were never saved, for the same reason. Blank answers are dropped and each answer is capped at 2,000 characters. | `python_server/services.py` save_pnm_answers | Checked by the integration tests and `e2e/api-contract.mjs`. |
| F3 | **Fixed on this branch.** `GET /pnms/{id}/questionnaire` called a method that did not exist. It now returns each submission with the question text beside each answer, and the PNM page shows them under "Intake answers". An answer to a question since deleted is kept and labelled "(question removed)". | `python_server/services.py` get_pnm_answers; `(dashboard)/pnms/[id]/page.tsx` | Checked by `e2e/flows.mjs` flow 8b. |
| F4 | **Fixed on this branch.** Open Voting failed for members because the tab called the admin-only `POST /rounds/open` on load. The tab now only reads; admins get an explicit "Open a round" button, and members see "No open round right now" instead of an error. The open round is now the newest active round with no live session attached; before, it could be a live session's round, letting a member vote on any PNM in a running session out of turn. | `(dashboard)/voting/page.tsx`; `python_server/routes.py` OPEN_ROUND_SQL, `/rounds/open/current` | Checked by the integration tests, `e2e/flows.mjs` flow 9 and `e2e/roles.mjs`. |
| F5 | **"Anonymous votes" does nothing.** The flag is stored on the session and shown as a badge. Votes are still stored against the voter, the `v_votes_public` view keys on a setting nothing writes, and the admin Voting Patterns page names every brother regardless. | `python_server/routes.py:2500,2560-2565`; `supabase/migrations/0013_reconcile_schema.sql:759-765`; `python_server/services.py:1855-1877` | **Confirmed at runtime**: votes in an anonymous session carry `voter_user_id`. |
| F6 | **The `exec` role cannot be assigned.** The database allows it, but the invite endpoint, the role-update endpoint and the role dropdown accept only admin, member and observer. An exec exists only if someone writes SQL. | `python_server/routes.py:255,350`; `frontend/components/admin/UserRoleEditor.tsx:11,57`; `supabase/migrations/0013_reconcile_schema.sql:264-265` | **Confirmed at runtime**: 400. |
| F7 | **An exec is let into admin pages whose APIs refuse them, and has no menu link to the one page they can use.** The page guard admits exec; the Admin menu shows for admin only; most backend routes require admin. Exec can use only the bid list, GPA waivers, the PowerPoint export and the audit log. | `frontend/components/AdminProtected.tsx:23-25`; `(dashboard)/layout.tsx:75,166`; `python_server/services.py:145-157` | **Confirmed at runtime** (`e2e/roles.mjs`): `/admin/users` and `/admin/duplicates` load and then get 403. |
| F8 | **GPA eligibility has no UI.** Nothing calls the endpoints that set a chapter minimum, enter a GPA or grant a waiver. GPA arrives only through CSV import, and with no minimum set the roster's GPA flag and filter show nothing. | `frontend/lib/api.ts:664,669,681` (unused wrappers); `(dashboard)/pnms/page.tsx:465-466,555,619-632` | Code read. The endpoints themselves work at runtime. |
| F9 | **The CSV import mapping dropdown omits GPA.** A GPA column is auto-detected and imported, but displays as "Ignore this column". | `frontend/lib/api.ts:517-519`; `python_server/csv_import.py:43,79-83` | Code read. Runtime confirms the GPA is imported. |
| F10 | **Check-in search lists the whole roster.** The page sends `?search=`, which the backend ignores. Typing a name and tapping the first "Check In" checks in whoever sorts first. | `(dashboard)/events/[id]/checkin/page.tsx:124`; `python_server/routes.py:940-950` | **Confirmed at runtime**: searching "Arlo Mendoza" listed 53 PNMs and the first button checked in Aiden Alvarez. |
| F11 | **Partly fixed on this branch.** The public `/intake?chapter=` link now asks the chapter's questions (they come with `GET /public/chapters/{id}`, and answers are sent with the sign-up, keeping only answers to known questions), and ends on a "You're signed up" screen instead of redirecting a PNM to the sign-in page. Still open: nothing in the app shows the link, and photo upload on it calls an authenticated endpoint. | `frontend/app/intake/page.tsx`; `python_server/routes.py` public_intake | Checked by `e2e/flows.mjs` flow 8b. |
| F12 | **The timer is display-only and goes stale for voters.** Nothing locks or advances at zero. The advance broadcast carries no timer and polling stops once the socket is up, so only the chair's countdown resets. | `(dashboard)/voting/page.tsx:463-472,507-516`; `python_server/websocket.py:63-69` | Code read. |
| F13 | **Starring a PNM and then voting clears the star.** `POST /votes` defaults `favorite` to false. Starring with no prior vote also records an `UNKNOWN` vote, which counts in the yes-% denominator. | `python_server/routes.py:1761-1777` | **Confirmed at runtime.** |
| F14 | **A voter without a websocket is never told the session ended.** The 5 s poll swallows the 404. | `(dashboard)/voting/page.tsx:261-263,507-516` | **Confirmed at runtime.** |
| F15 | **A live session always includes the whole active roster.** It ignores the "next round" a cutoff creates. To vote on survivors only, the admin must tick "Also archive…" when cutting. | `python_server/routes.py:2524-2547` | Code read. |
| F16 | **Starting a session ends old sessions but leaves their rounds `ACTIVE`.** Stale active rounds accumulate, and Open Voting picks the newest active round, which can be a live session's. | `python_server/routes.py:2506-2515,2318-2324` | Code read. |
| F17 | **Merge and delete leave dead ids in `voting_rounds.selected_pnm_ids`.** Suspected: advancing a session onto a removed id violates a foreign key and fails mid-session. | `python_server/merge.py:57-72`; `python_server/services.py:1407-1428`; `python_server/routes.py:2902-2907` | Suspected. |
| F18 | **The legacy round advance and lock endpoints fail.** They upsert on a constraint that does not exist. No page calls them. | `python_server/routes.py:1684-1710`; `python_server/services.py:2738-2772` | **Confirmed at runtime**: 500. |
| F19 | **Events: "End Time" and "Capacity Limit" are collected and discarded.** The per-row "Export Attendance" exports the whole chapter. `/events?action=add`, which the dashboard's Create Event button links to, does not open the form. | `(dashboard)/events/page.tsx:211-213,230-238,265-283,634` | `?action=add` **confirmed at runtime**; the rest by code read. |
| F20 | **Rush Mode's "Check In" ignores the selected active event** and pre-selects the first event in the list. The active event is stored per browser, not shared. | `frontend/components/rush/CheckInView.tsx:62-65`; `frontend/hooks/useActiveEvent.ts:5,134-143` | Code read. |
| F21 | **PNMs cannot check themselves in, and their QR points at a page that does not exist.** The emailed QR encodes `https://rushrank.app/checkin?p=<id>`; there is no `/checkin` route. A brother has to scan it with the in-app scanner. | `python_server/services.py:373` | Code read. |
| F22 | **The PNM detail page is read-only and its stats are empty.** No edit, no tag add or remove, no photo replace, no GPA. "Yes Rate" always shows "—" and "Favorites" always 0 because the endpoint returns neither. | `(dashboard)/pnms/[id]/page.tsx:272-277`; `python_server/routes.py:1279-1323` | Code read. |
| F23 | **Editing a PNM silently drops `fun_fact`.** | `python_server/services.py:1347-1350,1394` | Code read. |
| F24 | **Profile name does not stick.** It is saved to Supabase metadata only. `users.name` is never updated, so invited members show as "A brother" in "Who's met him" and as their email on notes. | `(dashboard)/profile/page.tsx:100-125`; `python_server/models.py:353-356` | Code read; display effect inferred. |
| F25 | **Invites report success when no email was sent**, write the generated password to the server log in plain text, reset the password of an existing account, and demote an existing admin to member if re-invited. | `python_server/services.py:2878-2890,3071-3078,3131-3134,3282`; `(dashboard)/admin/users/page.tsx:143-150` | Code read. |
| F26 | **The founding admin has no password.** Signup is magic-link only, and the link must be opened in the same browser. `/login` offers no magic-link option. A provisioning error on return is set but not shown. | `frontend/components/marketing/SignupWizard.tsx:62-63,75-78,202`; `frontend/app/login/page.tsx:282-319` | Code read. |
| F27 | **The bid list has no way to set a bid cap**, so "bids left" never appears on a list created in the app. "Take over editing" fails while another lock is under 10 minutes old, though the banner offers it. The CSV export has no outcome column. | `(dashboard)/bid-list/page.tsx:394,524-525`; `python_server/bid_list.py:182-189,318` | Code read. |
| F28 | **Exports.** "Export Filtered" exports the whole roster. "Export All PNMs" includes prospects and archived rows with email and phone, and any member can run it. The PowerPoint export includes prospects, ignores the tag filter and hardcodes GPA to none. The Results page's Export button goes to a page that ignores the round. | `frontend/lib/export.ts:61-70`; `python_server/services.py:1493-1530,2307-2328`; `(dashboard)/results/page.tsx:166-169` | Code read. |
| F29 | **Analytics still shows a constant.** A hardcoded "+12% vs last round" badge, and "Total votes cast" sums result rows, not votes. Two buttons say "coming soon". | `(dashboard)/analytics/page.tsx:157-170,499,519-525,637` | Code read. |
| F30 | **Tags page dead ends.** "Apply to Selected" opens with nothing selected; per-tag "Apply" links to a filter the roster ignores; "Filter" says "coming soon". | `(dashboard)/admin/tags/page.tsx:314,503` | Code read. |
| F31 | **Members are shown buttons the API refuses**: Start Session, Add Event, Make cuts, Bulk Tag, Export → PowerPoint, event edit and delete. | `(dashboard)/voting/page.tsx:593-618`; `(dashboard)/pnms/page.tsx:385-391,417-425` | Start Session **confirmed at runtime**. |
| F32 | **No Results link on a phone.** Neither the bottom nav nor the hamburger list has it. | `frontend/components/BottomNav.tsx:17-23`; `(dashboard)/layout.tsx:108-114` | **Confirmed at runtime.** |
| F33 | **Chapter names are globally unique.** Two chapters cannot share a name; a second signup with a taken name fails with a 500. | `chapters_name_key` constraint | **Confirmed at runtime.** |
| F34 | **Hardcoded production domain.** Invite and QR links use `https://rushrank.app` regardless of where the app is deployed. | `python_server/services.py:356,373,3211,3275` | Code read. |

---

## 3. Operations

| # | Finding | Evidence |
|---|---|---|
| O1 | **Both GitHub workflows are disabled.** `CI` is `disabled_manually`; its last run was #13 on 14 Jan 2026 (failure). `Warm Backend` is `disabled_manually`; its last run was #1056 on 16 Feb 2026 (failure). The rewritten CI (real Postgres, lint, vitest) has never run on GitHub. | GitHub Actions API, queried 11 Nov 2026 |
| O2 | **The production backend did not answer.** Three `GET https://rushrank-backend.onrender.com/health` requests each timed out at 120 s with no bytes received. The TLS handshake completed, so the host exists. Cause unknown: suspended, failing to boot, or unreachable from the machine that probed. | Probed 11 Nov 2026 |
| O3 | **No error monitoring.** A production 500 is only a log line. | `python_server/main.py:156-157`; no Sentry or equivalent in either dependency file |
| O4 | **`render.yaml` does not declare** `PUBLIC_SITE_URL`, `DEMO_USER_*`, `MAILERLITE_*` or `SUPABASE_JWT_SECRET`. `.env.example` omits several variables the backend reads. | `render.yaml:9-22`; `.env.example` |
| O5 | **`CLAUDE.md` is stale in five places**: it describes a root `package.json` and `frontend/lib/realtime.ts` (neither exists), RLS policies (none in migrations), a JWT read from `localStorage.access_token` (it now comes from the Supabase session, `frontend/lib/auth.ts:26-33`), and a role list without `observer`. | `CLAUDE.md` |
| O6 | **`docs/FEATURES.md` Status section is stale**: it says five features are on unmerged branches. All five are on `main`. | `docs/FEATURES.md:131-139` |

---

## Appendix A. August audit, item by item

### §1 Blockers

| Item | Status | Evidence | Note |
|---|---|---|---|
| B1 Signup never authenticates the new admin | Fixed | `frontend/lib/auth.ts:26-33`; `frontend/lib/api.ts:162,188`; `frontend/components/Protected.tsx:23-44`; `frontend/components/marketing/SignupWizard.tsx:86-93` | Token comes from the live Supabase session. Residual gaps: F26. |
| B2 No token refresh | Fixed | `frontend/lib/api.ts:203-216`; `frontend/lib/auth.ts:36-41` | A 401 triggers one refresh and a retry. |
| B3 Results always empty | Fixed | `python_server/services.py:1701-1722,1789-1791` | `round_pnms` is now written. `selected_pnm_ids` is still written and read in parallel (`routes.py:2543-2547`, `bid_list.py:49-54`). |
| B4 `PNMWithVotes` / `BulkArchiveRequest` field slip | Fixed | `python_server/models.py:151-169,185-187` | |
| B5 Two schemas | Changed | `supabase/legacy/schema_pre_migrations.sql`; `supabase/migrations/0013_reconcile_schema.sql:18,617,654` | 0013 converges both origins but copies the legacy `attendance` and `notes` tables instead of dropping them. |
| B5a Event attendance reads `attendance` | Fixed | `python_server/routes.py:1991-1998` | |
| B5b PNM attendance reads `attendance` | Fixed | `python_server/routes.py:2204-2211` | |
| B5c `mark_attendance` double write | Fixed | `python_server/services.py:2276-2302` | |
| B5d `delete_pnm` typo | Fixed | `python_server/services.py:1422` | The block is still wrapped in a swallow-all `try/except` (`:1412-1424`). |
| B5e `.pptx` export on legacy columns | Fixed | `python_server/services.py:1462-1467,1486-1491` | |
| B5f CSV export reads `attendance` | Fixed | `python_server/services.py:2320` | |
| B5g `exec` role unreachable | Changed | `supabase/migrations/0013_reconcile_schema.sql:264-265`; `python_server/routes.py:255,350` | The constraint allows it; the API and UI still do not. See F6. |
| B5 Remove schema-sniffing `try/except` blocks | Changed | `python_server/routes.py:1352-1356`; `python_server/services.py:1033-1042` | Most are gone; two around `qr_code_url` remain. `python_server/tests/test_no_legacy_sql.py` guards against regressions. |
| B6a Login lands on the marketing page | Fixed | `frontend/app/login/page.tsx:59,76` | |
| B6b Home links point at `/` | Fixed | `(dashboard)/layout.tsx:109,137,145`; `frontend/components/BottomNav.tsx:18` | |
| B6c `middleware.ts` is a no-op | Fixed | file deleted | Protection is the client-side `Protected` component only. |

### §2.1 Live voting

| Item | Status | Evidence | Note |
|---|---|---|---|
| Live tallies do not exist | Fixed | `python_server/routes.py:1801-1810`; `(dashboard)/voting/page.tsx:476-479,753-757` | Confirmed at runtime: tallies in `vote_cast` matched the database with 24 voters. |
| Lock is cosmetic | Fixed | `python_server/routes.py:1746-1753`; `(dashboard)/voting/page.tsx:840-845` | Confirmed at runtime (409). The legacy endpoint bypasses it: S9. |
| Timer is fake | Changed | `supabase/migrations/0014_session_timer.sql:19-20`; `python_server/routes.py:2496-2499,2989-2992` | Stored and computed server-side, but display-only: F12. |
| "Anonymous votes" is fake | Changed | `supabase/migrations/0014_session_timer.sql:21`; `python_server/routes.py:2500` | Persisted and shown as a badge; enforced nowhere: F5. |
| Favoriting before voting fails | Changed | `python_server/routes.py:1761-1766` | No longer a 400, but see F13. |
| Any member can open a round | Fixed | `python_server/routes.py:2300-2305` | The fix broke Open Voting for members: F4. |
| Rounds snapshot PNMs at creation | **Fixed on this branch** for live sessions | `python_server/live_round.py`; called from `python_server/services.py` (create), `routes.py` (prospect to rush, unarchive), `csv_import.py` (import) | A PNM who becomes eligible while a live session is open is appended to the end of its running order. Rounds created by cuts are left alone on purpose. Tested in `tests/integration/test_live_append_and_round_summary.py` and `e2e/ws-voting.mjs`. |
| `setIsChair(... \|\| true)` | Fixed | `(dashboard)/voting/page.tsx:354` | Confirmed at runtime: a member joining is not chair. |

### §2.2 Bid list

| Item | Status | Evidence | Note |
|---|---|---|---|
| No frontend | Fixed | `(dashboard)/bid-list/page.tsx`; `frontend/lib/api.ts:428-479` | Board, lock, finalize, exports and outcomes are wired. Gaps: F27, S11. |
| `@dnd-kit` unused | Fixed | `(dashboard)/pipeline/page.tsx:23-32` | |

### §2.3 Unreachable admin surface

| Item | Status | Evidence | Note |
|---|---|---|---|
| Admin dropdown and user menu commented out | Fixed | `(dashboard)/layout.tsx:166-230,236-284` | Admin role only. |
| `/settings`, `/admin/users`, `/admin/tags`, `/analytics`, `/profile` | Fixed | `(dashboard)/layout.tsx:118-123,185-226,250-263` | |
| `/admin/analytics` duplicate | Fixed | deleted | |
| `/voting/admin` prototype | Fixed | deleted | |
| `/compare` | **Fixed on this branch** | `(dashboard)/pnms/page.tsx` (Compare button) | Tick 2 to 5 PNMs on the roster and choose Compare. Checked by `e2e/roles.mjs`. |
| Dashboard toast "Invite your team from Settings" | Changed | `(dashboard)/dashboard/page.tsx:43-46` | Settings is reachable now, but invites are on User Management. |

### §2.4 Landing-page claims

| Item | Status | Evidence | Note |
|---|---|---|---|
| CSV upload | Fixed | `python_server/csv_import.py`; `(dashboard)/pnms/import/page.tsx` | Confirmed at runtime. |
| Cutoffs and audit trails | Fixed | `python_server/routes.py:1854-1919`; `(dashboard)/results/page.tsx:190-207`; `(dashboard)/admin/audit/page.tsx` | Cut preview confirmed at runtime. |
| Vote drift analytics | Changed | `(dashboard)/analytics/page.tsx:163,262-270` | Page is linked and uses real results; there is no drift metric. See F29. |

### §2.5 Smaller gaps

| Item | Status | Evidence | Note |
|---|---|---|---|
| No chapter switcher | Still open | `frontend/lib/api.ts:112`; `python_server/services.py:229-231` | Frontend takes `chapters[0]`; backend takes `LIMIT 1` with no order, so the two can disagree. |
| `lib/queries.ts` dead and wrong | Fixed | `frontend/lib/queries.ts:1-66` | Four hooks left; `useMe` has no caller. |
| `/demo*` playgrounds | Changed | `frontend/app/demo/page.tsx:32-45` | `/demo` is now a real read-only demo sign-in, gated on env vars. Unimported playground components remain under `frontend/components/ui/`. |
| `/intake` public but needs auth | Changed | `frontend/app/intake/page.tsx:44-49` | A public path exists but is half-wired: F11. |
| Attendance export wrong base URL | Fixed | `(dashboard)/events/page.tsx:275` | |

### §3 Design audit

| Item | Status | Evidence |
|---|---|---|
| Two design systems side by side | Changed: `beta-*` aliases now resolve to semantic tokens but are still used in 35 files | `frontend/tailwind.config.ts:89-93` |
| `font-serif` undefined | Fixed | `frontend/tailwind.config.ts:220`; `frontend/app/layout.tsx:21-26` |
| Bogus `family=monospace` request | Fixed | `GoogleFonts.tsx` deleted |
| Runtime font injection | Fixed | `frontend/app/layout.tsx:3,11-26` |
| Pinch-zoom disabled | Fixed | `frontend/app/layout.tsx:33-41` |
| Dark mode only inside the dashboard | Changed: the class applies everywhere, but marketing tokens have no dark values | `frontend/app/layout.tsx:47-65`; `frontend/app/globals.css:8-19` |
| Theme applied in `useEffect` | Changed: blocking script added; a flash when stored ≠ system is suspected | `frontend/components/ThemeProvider.tsx:23-44` |
| `.bg-white` dark override hack | Still open | `frontend/app/globals.css:162-170` |
| Landing: no header or sign-in | Fixed | `frontend/components/marketing/MarketingHeader.tsx:14-35` |
| Landing: footer text invisible | Fixed | `frontend/components/marketing/MarketingFooter.tsx:13,21,43,64` |
| Landing: footer hover is white on cream | **Fixed on this branch** | `frontend/components/marketing/MarketingFooter.tsx` |
| Landing: six footer links are `href="#"` | **Fixed on this branch** | `MarketingFooter.tsx`: Features, See it work, Try the demo, Get started, Sign in. Pricing, About, Blog and Contact had no page and were removed. |
| Landing: BID badge has no colour | Fixed | `frontend/tailwind.config.ts:69` |
| Landing: star counter can never move | **Fixed on this branch** | `frontend/components/marketing/SwipeDemo.tsx`: Pass, Star and Bid buttons under the deck |
| Landing: cards do not animate out | **Fixed on this branch** | `SwipeDemo.tsx`: cards leave in the direction they were decided |
| Landing: stale "Fall 2026" and Beta Theta Pi copy | **Fixed on this branch** | `frontend/components/marketing/SocialProof.tsx`: no chapter name, no date |
| `/login`: no link out | **Fixed on this branch** | `frontend/app/login/page.tsx`: links to `/get-started` and the home page |
| `/login`: no dark variants, fixed 384px card, duplicated reset branch | Still open (3 items) | `frontend/app/login/page.tsx:203-331` |
| `/get-started`: bare error line, no loading state on return | **Fixed on this branch** | `frontend/components/marketing/SignupWizard.tsx`: "Setting up your chapter", an error panel with Try again, and a message when the link is opened in another browser. A taken chapter name now returns a readable 409 (`python_server/services.py` provision_chapter). |
| `/get-started`: unstyled inputs, unlabeled stepper | Still open (2 items) | `frontend/components/marketing/SignupWizard.tsx` |
| `/get-started`: builds its API URL differently | Fixed | `SignupWizard.tsx:39-41` |
| `/dashboard`: third stat card spans two columns | Changed: no span; three cards in two columns | `(dashboard)/dashboard/page.tsx:312-343` |
| `/dashboard`: "Add PNM" in two grids | Still open (one shows per viewport) | `(dashboard)/dashboard/page.tsx:371-434` |
| `/rush`: native `<select>` | Still open | `(dashboard)/rush/page.tsx:149-160` |
| `/pnms`: four-column grid with one card | **Fixed on this branch** | `(dashboard)/pnms/page.tsx`: Total, Showing, Nobody has met |
| `/pnms`: search refetches per keystroke | Changed: debounced, but still refetches a list the backend does not filter | `(dashboard)/pnms/page.tsx:127-130,146-147,170` |
| `/pnms`: multi-select cannot reach `/compare` | **Fixed on this branch** | see `/compare` above |
| `/pnms`: PowerPoint export shown to everyone | **Fixed on this branch** | `(dashboard)/pnms/page.tsx`: shown to admin and exec only, matching the API. Checked by `e2e/roles.mjs`. |
| `/pnms`: two "add PNM" destinations | **Fixed on this branch** | Both go to `/intake` |
| `/pnms`: 1200px table on mobile | Still open | `(dashboard)/pnms/page.tsx:537` |
| `/voting`: timer input, lock swipe-through, Votes Collected | Fixed (3 items) | see §2.1 |
| `/voting`: anonymity checkbox does nothing | Changed | see F5 |
| `/voting`: "Your Progress" resets on refresh | Still open | `(dashboard)/voting/page.tsx:96,781-802` |
| `/results`: empty, and 0% / 0 / 0 | Fixed (2 items) | see B3, B4 |
| `/results`: nested `<thead>` | **Fixed on this branch** | `(dashboard)/results/page.tsx`; the same fault on `(dashboard)/pnms/import/page.tsx` also fixed |
| `/exports`: Filtered and Comparison cards permanently disabled | **Fixed on this branch** (2 items) | The roster has an Export CSV button that exports exactly the rows on screen; the Exports card points there, and `frontend/lib/export.ts` now applies the search and tag filters it used to send to a backend that ignored them. The Comparison card is reached through Compare. |
| `/exports`: raw Tailwind heading | **Fixed on this branch** | `(dashboard)/exports/page.tsx` |
| `/events`: `console.log` in the load path | **Fixed on this branch** | `(dashboard)/events/page.tsx` |
| `/intake`: requires a photo | Fixed | `frontend/app/intake/page.tsx:133-139` |
| `/intake`: requires "Celebrity Crush" | Changed: only when signed in | `frontend/app/intake/page.tsx:115,151,511` |

### §5 Phase 0 and Phase 5 checklist

| Item | Status | Evidence |
|---|---|---|
| Dump production schema and diff | Not verifiable from the repo | `0013_reconcile_schema.sql:43` logs to `schema_reconciliation_log` if applied |
| Archive `schema.sql`, update `CLAUDE.md` | Fixed | `supabase/legacy/schema_pre_migrations.sql`. `docs/db/README.md:55` still names the old path. |
| Migration to drop legacy tables and reconcile roles | Changed | Roles reconciled; legacy tables copied, not dropped |
| Integration suite on real Postgres | Changed | 145 tests in `python_server/tests/integration/`, all passing locally on 11 Nov 2026. They are service-level and cover selected areas, not every route. |
| CI triggers, lint, vitest | Changed | `.github/workflows/ci.yml` is correct; the workflow is disabled on GitHub (O1). Vitest has one file. |
| Warm the backend | Changed | `render.yaml` now has `healthCheckPath: /health/db`; `.github/workflows/warm-backend.yml` now fails when the backend does not answer; the frontend retries a read once, with a "Waking up the server" message, when it times out or gets 502–504 (`frontend/lib/api.ts`). Still on `plan: free`, and the workflow is still disabled on GitHub: both are your decision. |
| Load test with 60 websocket clients | Changed | 25-browser run in August; a 24-voter run with frame-level checks passed locally on 11 Nov 2026. No 60-client test. |
| Error monitoring | **Fixed on this branch** (off until configured) | `python_server/monitoring.py`; `frontend/components/ErrorMonitoring.tsx`. Set `SENTRY_DSN` on Render and `NEXT_PUBLIC_SENTRY_DSN` on Vercel to turn it on. No personal data is attached. |

### Closing notes

| Item | Status | Evidence |
|---|---|---|
| 40 stale docs under `docs/archive/` | Changed | Directory deleted. Older debugging docs remain: `docs/DEBUG_EVENTS_ISSUE.md`, `docs/EVENTS_DEBUG_SUMMARY.md`, `docs/VOTING_PAGE_REIMPLEMENTATION.md`, `docs/QR_EMAIL_TROUBLESHOOTING.md`, `frontend/LAYOUT_COMPARISON.md`, `frontend/TOPBAR_*.md`. |

## Appendix B. `e2e/FINDINGS.md`, item by item

| Item | Status | Evidence | Note |
|---|---|---|---|
| Fixed 1: sessions voted on prospects and archived PNMs | Fixed | `python_server/routes.py:2357-2362,2524-2529` | |
| Fixed 2: fabricated analytics | Fixed | `python_server/services.py:1824-1933`; `python_server/routes.py:1609-1620` | A different hardcoded badge survives on the page: F29. |
| Fixed 3: storage failure returned an opaque 500 on PNM cards | Fixed | `python_server/services.py:2428-2445` | Confirmed at runtime (502 with a usable message). The bulk path was not given the same handling. |
| Fixed 4: bulk card export included prospects and archived | Fixed | `python_server/services.py:2483-2494` | Chapter-wide branch only; the `pnm_ids` branch is unfiltered. |
| Fixed 5: "New PNM" unreachable on a phone | Fixed | `(dashboard)/pnms/page.tsx:381-382,461` | |
| Fixed 6: invisible "Total Tags" label | Fixed | `(dashboard)/admin/tags/page.tsx:258-259` | |
| Fixed 7: theme endpoint returned unnormalised JSONB | Fixed | `python_server/services.py:171-183` | |
| Product call 8: chair can end a session | Fixed | `python_server/routes.py:2801-2843`; `(dashboard)/voting/page.tsx:384-411` | Confirmed at runtime with 24 voters. |
| Product call 9: Voting in the bottom nav | Fixed | `frontend/components/BottomNav.tsx:21,41` | |
| Open: analytics fans out a query per round, twice | **Fixed on this branch** | New `GET /chapters/{chapter_id}/round-summary` (`python_server/routes.py`, `services.py` get_round_summary) replaces about 150 requests for a 50-PNM chapter with two. "Total votes cast" now counts votes (it counted result rows) and "completed rounds" now counts `ENDED` rounds (it never matched). |
| Open: tap targets below 44px | **Fixed on this branch** | A `touch:` Tailwind variant (`frontend/tailwind.config.ts`) gives controls a 44px target on touch screens only; the laptop layout is unchanged. `e2e/visual.mjs` now reports no tap-target findings on any of the 26 pages. |
| Open: native `window.confirm()` | **Fixed on this branch** | `frontend/components/ConfirmProvider.tsx`; all eight call sites use it. Focus starts on Cancel. |
| Open: two logo images have no alt text | **Fixed on this branch** | The header logo's `alt=""` was correct (the word "RushRank" sits beside it); `e2e/visual.mjs` was treating an empty alt as missing and now does not. The one real missing alt was a placeholder top bar on `/analytics`, now removed. |
| Open: tag deletion untested | Changed | `(dashboard)/admin/tags/page.tsx:354-391` | The endpoint is now tested by `e2e/api-contract.mjs`; the kebab menu in the UI still is not. |
| Open: live-session header crowds on a phone | **Fixed on this branch** | `(dashboard)/voting/page.tsx`: the header wraps and the join code stays on one line |

## Appendix C. `docs/PRODUCT-GAPS-2026-08.md` Tier 1–2

| Item | Status | Evidence | What is missing |
|---|---|---|---|
| 1. Pre-rush pipeline | Built | `supabase/migrations/0015_pre_rush_pipeline.sql`; `(dashboard)/pipeline/page.tsx`; `frontend/app/interest/page.tsx` | The tabling QR endpoint and the at-intake duplicate check have no caller. |
| 2. Contact coverage | Built | `supabase/migrations/0016_contact_coverage.sql`; `frontend/components/pnm/MetButton.tsx` | The "you haven't met him" nudge appears only in Open Voting, which members cannot use. |
| 3. Bid outcomes | Built | `supabase/migrations/0017_bid_outcomes.sql`; `python_server/routes.py:574-602` | No UI sets the bid cap. |
| 4. Outreach email | Not built | no route, service or page | |
| 5. Duplicate detection and merge | Built | `python_server/merge.py`; `(dashboard)/admin/duplicates/page.tsx` | See F17. |
| 6. GPA eligibility | Backend only | `supabase/migrations/0018_gpa_eligibility.sql`; `python_server/routes.py:775-881` | No UI: F8. |
