# End-to-end test findings

Local run against a seeded chapter: 32 brothers, 61 PNMs (51 in formal rush,
8 prospects, 2 archived), 6 events, 335 contact records, 107 notes, 3 rounds,
2,345 historical votes, a bid list, and one deliberate duplicate.

Coverage: **437 controls pressed across 26 pages**, a **25-browser live voting
session**, a destructive-actions pass, and 52 screenshots at desktop and mobile.

Harness lives in `e2e/`. Reproduce with:

```
set -a && . ./e2e/env.sh && set +a
python3 e2e/seed.py && python3 e2e/fixtures.py
cd e2e && node voting.mjs 24 && node crawl.mjs && node destructive.mjs && node visual.mjs
```

---

## What held up

The concurrency work is sound under realistic load. With 1 chair and 24 voters
in 25 separate browser contexts driving the real UI:

- **24 of 24 simultaneous votes landed on every PNM**, across four PNMs, with
  each stored value matching what that brother clicked. No lost writes.
- **The websocket connected for all 25 clients** — none fell back to polling.
- **The chair's lock is enforced server-side.** Bypassing the disabled buttons
  with a direct `POST /votes` returned `409` and wrote nothing.
- **Changing a vote updates in place** — one row before, one row after.

Destructive actions: 5/5 checks passed. The duplicate merge removed exactly one
PNM and left **zero orphaned notes and zero orphaned contacts**, with no child
rows silently dropped (notes 107→107, contacts 335→335, votes 2345→2345) —
which exercises the `pnm_contacts` registration and NULL-safe conflict key
added to `merge_pnms` earlier in this session.

Across the crawl: no page rendered empty, and no signed-in page bounced to
login.

---

## Fixed

### 1. Live sessions voted on prospects and archived PNMs

`create_session` built the round from `SELECT id FROM pnms WHERE chapter_id=$1`
with no `archived` or `stage` filter, so a session put all 61 rows on the swipe
card when only 51 were in formal rush. Prospects are people the chapter has not
rushed yet; archived rows were archived deliberately. Both padded the
denominator every percentage in the round is read against. The open-round
builder had the identical bug.

Both now filter to `archived = false AND stage <> 'prospect'`, ordered by name
so the running order survives a restart. Re-verified: `round contains 51 PNMs
(eligible roster is 51)`.

### 2. The analytics page showed fabricated data about named brothers

The worst thing in the audit. `analytics/page.tsx` presented invented numbers
as analysis:

- **Voting patterns were `Math.random()`** — each brother's participation rate
  and yes/no/unknown counts were generated per render, then used to label real,
  named members "Supportive", "Harsh" or "Balanced", and "Top Contributor" or
  "Low Activity". The numbers changed on every page load.
- **A tooltip explained a methodology that did not exist**: "Harshness is
  determined by yes-vote percentage relative to chapter average."
- **Average participation was hardcoded to 87%**, with a hardcoded "+5% vs last
  round" trend badge beside it.
- **It exported.** The CSV button wrote those values out, so a chapter could
  circulate randomly-generated judgements about named brothers.

Replaced with a real computation. New admin-only endpoint
`GET /chapters/{id}/voting-patterns` (`VotingService.get_voting_patterns`)
derives everything from the `votes` table: participation is votes cast over
votes available across every round the chapter actually ran, and Supportive /
Harsh is ±10 points against the chapter's own average. Brothers who have not
voted are **not labelled** — they render "—" rather than being called
"Balanced" on no evidence. The tooltip now describes what the code does.

Verified against the seeded chapter: chapter average 63.5% yes, 87.2% average
participation, Felix Whitfield correctly flagged Harsh at 51.3%, and the two
brothers seeded with zero votes correctly carry no label.

### 3. A storage hiccup returned an opaque 500 on PNM cards

`generate_pnm_card` uploaded to Supabase Storage inside a bare `httpx` block
with no exception handling, so any transport failure — DNS, timeout, storage
briefly down — escaped as an unhandled 500. Three such 500s appeared in the
crawl. The handled non-2xx branch spliced the raw Supabase error body into the
response.

Now returns 502 with an explanation a rush chair can act on, and logs the
detail server-side instead of leaking it.

### 4. Bulk PNM card export included prospects and archived PNMs

Same class as #1: `generate_pnm_cards_bulk` selected `WHERE p.chapter_id = $1`
with no filter, so the deck projected at the bid meeting contained prospects
and archived candidates. Now filtered.

### 5. "New PNM" was unreachable on a phone

On the roster at 390px the header action row neither wrapped nor scrolled, so
the primary action was pushed past the right edge with no way to reach it. The
five filter checkboxes had the same problem — the last was off-screen. Both
rows now wrap; verified by screenshot.

(The table's own row actions are also off-screen at that width, but the table
sits in an `overflow-x-auto` container, so those are reachable by scrolling
sideways. A 1200px-wide table on a phone is poor, but it is not a break.)

### 6. Invisible label on the Tag Management stat card

"Total Tags" rendered `text-default-font` (near-black) on a `#162238` navy
card — 1.24:1, unreadable, while the number above it was correctly white. Its
two sibling cards pair a light background with a dark label; this one is the
inverse and its label now follows.

### 7. Theme endpoint returned unnormalised JSONB (hardening)

`GET /chapters/me/theme` returned the raw `theme` column, so a row whose shape
predates `{enabled, accent_hex, source}` made the settings card read `enabled`
as `undefined`; `JSON.stringify` dropped the key and the save came back
`422 Field required: enabled` with nothing on screen to explain it.

**Caveat: my seed caused this, not the app.** Migration 0009's column default
already has the right shape, so normally-created chapters were never affected.
Hardened anyway because the failure mode is silent and the fix is three lines.

---

## Open — needs your call

### The chair cannot end a live session from the UI

The chair's controls are "Lock Voting" and "Next PNM". There is no End Session
button, so a session can only be closed by advancing through every remaining
PNM. If the room needs to stop early — running late, taking a break, wrong
round started — there is no way out from the interface.

Adding one is easy; where it goes and whether it needs a confirm is a product
decision, so I have left it.

### Voting is missing from the mobile bottom navigation

The bottom nav is Home / Rush / PNMs / Events. On Thursday the voting screen is
the one every brother needs, and it is the one flow not reachable from the
persistent mobile nav — you go through the hamburger instead. Which four items
earn a slot is your call.

---

## Open — smaller

- **Analytics fans out an expensive query per round, twice.** The page requests
  `/rounds/{id}/results` for every round (lines 156 and 249), and that endpoint
  aggregates votes, joins tags and computes a population standard deviation
  across every PNM in the round. A chapter accumulates a round per rush event,
  so this grows through the week, on the cheap Render tier. Wants one aggregate
  endpoint instead of a fan-out.
- **Tap targets below 44px on mobile**, chapter-wide: nav toggle 40×40, avatar
  32×32, most secondary buttons 32–36px tall. One shared component set, so it
  is a cheap sweep.
- **Destructive actions use native `window.confirm()`**, which is jarring next
  to the app's own modals and toasts.
- **Two logo images have no alt text** (landing, get-started).
- **Tag deletion is behind a kebab menu the harness could not reach**, so it is
  untested rather than known-good.

---

## Notes on the harness itself

Four first-pass findings were mine, not the app's. Recorded so nobody
re-reports them:

- A case-insensitive `getByRole("button", {name: /^No$/i})` also matches the
  user-avatar button when a brother's initials spell a vote — "Noel Escobar" →
  "NO". That produced a phantom "24 voters, 23 votes recorded". Selectors are
  now case-exact.
- The contrast checker read `rgba(10,10,10,0.08)` as opaque black, reporting
  legible badges as 1:1 invisible text. It now composites alpha down to the
  first opaque layer. That removed 20 of 48 visual findings.
- `pkill -f "next start"` never matched the actual process name
  (`next-server`), so every frontend "restart" was a silent no-op. One visual
  run therefore hit a server whose `.next` had been deleted underneath it and
  reported 18 phantom "horizontal overflow" highs. Kill by port instead.
- Playwright auto-dismisses native dialogs when nothing is listening, which
  cancelled the archive and merge under test and made both look broken. The
  destructive suite now accepts them.
