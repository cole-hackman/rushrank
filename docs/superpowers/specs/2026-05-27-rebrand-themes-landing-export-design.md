# RushRank Rebrand, Theming, Landing & Slideshow Export — Design Spec

**Date:** 2026-05-27
**Author:** Cole (with Claude)
**Status:** Approved for planning

## 1. Summary

Four sequenced initiatives that turn RushRank from a Beta-Theta-Pi-branded internal tool into a generic, multi-chapter SaaS product:

1. **De-brand** — strip all Beta Theta Pi references from the app.
2. **Generic theming + per-chapter accent colors** — cream/black default, opt-in chapter accent driven by a seeded top-30 fraternity color palette.
3. **Public marketing landing page + self-serve chapter signup** — interactive swipe/PNM demo, onboarding wizard.
4. **PPTX export of PNMs** — visually polished, photo-forward slide deck, one PNM per slide.

The four ship in three phases. The theming system is the foundation; the landing page and export both consume it.

## 2. Goals & Non-Goals

**Goals**
- App is fully chapter-agnostic out of the box (cream & black).
- Any of the top-30 fraternities can flip one toggle and have a tasteful accent applied across the product.
- A prospective chapter can land on `rushrank.com`, see a real swipe demo, sign up, and be in their dashboard inside 2 minutes.
- An exec can export the filtered PNM roster to a PowerPoint that looks deliberately designed, not auto-generated.

**Non-Goals**
- Full per-chapter dark mode / multi-variant theming. Accent only.
- Theme inheritance across multiple memberships per user.
- Pushing slides directly to Google Drive (deferred — PPTX opens in Slides anyway).
- Pricing/billing surface. CTA defaults to "request pilot access".
- Real social-proof logos. Placeholder strip; populated later.

## 3. Phases & Sequencing

| Phase | Scope | Depends on |
|---|---|---|
| A | De-brand + theming system + Settings UI | — |
| B | Marketing landing page + self-serve signup wizard | A (uses tokens) |
| C | PPTX export | A (theme accent on slides) |

B and C are independent of each other; they may be implemented in parallel once A is merged.

## 4. Phase A — De-brand & Theming Foundation

### 4.1 De-brand sweep

Files known to reference Beta Theta Pi (`grep` confirmed):
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/app/login/layout.tsx`
- `frontend/app/login/page.tsx`

Plus an untracked `frontend/components/heritage.tsx` to be reviewed (generalize or delete).

Implementation pass:
- Replace literal copy ("Beta Theta Pi", "Wooglin", any chapter-specific tagline) with the generic "RushRank" wordmark.
- Sweep at execution time: `grep -rni "beta theta\|wooglin\|βθπ\|btp" frontend supabase python_server` and resolve every hit.
- Audit `intake.png`, `login-desktop.png`, `login-mobile.png` for BTP imagery; replace with neutral product screenshots taken against the new generic theme.
- Remove any seeded BTP rows from `supabase/schema.sql` / migrations and replace with a generic demo chapter where one is needed for fixtures.

### 4.2 Design token system

`frontend/app/globals.css` defines a single source of truth:

```css
:root {
  --bg: #FAF7F0;            /* cream */
  --surface: #FFFFFF;
  --surface-muted: #F4F0E4;
  --fg: #0A0A0A;
  --fg-muted: #5C5C5C;
  --border: #E8E3D6;
  --accent: #0A0A0A;        /* default = black */
  --accent-fg: #FFFFFF;
  --accent-soft: rgba(10,10,10,0.08);
  --danger: #B42318;
  --success: #1F7A4D;
}
```

`tailwind.config.ts` maps these to semantic utilities: `bg-bg`, `bg-surface`, `bg-surface-muted`, `text-fg`, `text-muted`, `border-border`, `bg-accent`, `text-accent-fg`, `bg-accent-soft`, plus `ring-accent`.

**Where the accent appears (intentionally narrow):**
- Primary buttons & primary FABs
- Active nav indicator (left rail + bottom nav)
- Focus rings + selection states
- Active tab underline
- Avatar fallback tint (uses `--accent-soft`)
- Charts: primary series stroke/fill only

**Where it does NOT appear:**
- Vote up/down (semantic green/red — voting needs unambiguous meaning, independent of chapter color)
- Destructive actions (always `--danger`)
- Body type, surfaces, borders, dashboard chrome

### 4.3 Rewriting existing pages

Every file in the current `git status` modified list (~28 frontend files) is rewritten to consume semantic tokens. Concretely: any hardcoded `bg-white`, `text-black`, brand pink/blue (`#FFC0CB`, `#0033A0`), or BTP-specific gradient is replaced with the appropriate token utility.

This is a sweep, not a redesign — layouts and copy stay the same except where de-brand requires copy changes.

### 4.4 Chapter theme storage

**Migration `supabase/migrations/0009_chapter_theme.sql`:**

```sql
ALTER TABLE chapters ADD COLUMN theme JSONB NOT NULL
  DEFAULT '{"enabled": false, "accent_hex": null, "source": "auto"}'::jsonb;
```

Shape:
```json
{
  "enabled": false,
  "accent_hex": "#0033A0",
  "source": "auto" | "manual"
}
```

**Migration `supabase/migrations/0010_fraternity_colors.sql`:**

```sql
CREATE TABLE fraternity_colors (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank INT NOT NULL,
  hex_primary TEXT NOT NULL,
  hex_secondary TEXT,
  hex_tertiary TEXT
);
-- INSERT statements seeded from fraternity-colors-top-30.md (all 30 rows).
CREATE INDEX fraternity_colors_name_lower_idx ON fraternity_colors (lower(name));
```

### 4.5 Backend

In `python_server/services.py`, extend `ChapterService` with:

- `async def get_theme(chapter_id) -> dict` — returns `chapters.theme`.
- `async def update_theme(chapter_id, user_id, patch) -> dict` — admin-only; validates `accent_hex` is a 6-digit hex.
- `async def autodetect_accent(fraternity_name) -> Optional[str]` — case-insensitive `lower(name)` match against `fraternity_colors`, with alias map for `"FIJI" → "Phi Gamma Delta"`.

Routes in `python_server/routes.py` (mounted under both `/api/v1` and `/api`):
- `GET /chapters/me/theme` — any member of the chapter.
- `PATCH /chapters/me/theme` — admin role required.
- `GET /fraternity-colors` — public-ish (used by signup wizard); returns `[{key, name, hex_primary}]`.

### 4.6 Frontend theme provider

`frontend/app/(dashboard)/layout.tsx`:
- On mount, `useChapterTheme()` (new react-query hook in `lib/queries.ts`) fetches `GET /chapters/me/theme`.
- If `theme.enabled && theme.accent_hex`, set `document.documentElement.style.setProperty('--accent', hex)` and compute derived tokens (`--accent-fg`, `--accent-soft`) at runtime.
- Theme is cached client-side in localStorage with a 1-hour TTL, keyed by `chapter_id`, to avoid flash-of-unstyled-accent.

**Contrast guardrail (`frontend/lib/theme.ts`):**
- Given a user-supplied hex, compute WCAG contrast vs `--bg` (cream).
- If contrast < 4.5:1, derive a darker variant via HSL lightness shift for text/icon use (`--accent-fg-on-bg`). Background-fill use of the accent is unchanged.
- This is the fix for light brand colors (Beta Theta Pi pink, Sigma Pi lavender).

### 4.7 Settings UI

New "Chapter Appearance" card in `frontend/app/(dashboard)/settings/page.tsx`:

```
┌─ Chapter Appearance ─────────────────────────┐
│ ⚪ Generic (cream & black)         [default] │
│ ⚫ Use our chapter colors                    │
│    Detected: Sigma Chi  ● #0033A0           │
│    [ Customize hex... ]                      │
│                                              │
│ Live preview:                                │
│ [Primary button] [Active tab] [Tag chip]    │
└──────────────────────────────────────────────┘
```

- Visible only to `admin` (and `exec` if you want; admin-only by default per design decision).
- Radio between generic / chapter colors.
- "Customize" expands to a hex input + tiny inline color picker.
- Live preview re-renders the three sample components below as the admin edits.
- "Save" calls `PATCH /chapters/me/theme`; on success, optimistic update of theme tokens.

## 5. Phase B — Public Landing Page & Self-Serve Signup

### 5.1 Routing

- New route group `frontend/app/(marketing)/` with its own `layout.tsx` (no auth, no dashboard chrome, transparent header).
- `app/(marketing)/page.tsx` — landing.
- `app/(marketing)/get-started/page.tsx` — wizard.
- Current root behavior: a server component (or `middleware.ts`) checks Supabase session:
  - Authed → `/dashboard` (rename current `(dashboard)/page.tsx` route to live at `/dashboard`).
  - Anon → marketing landing.
- `/login` keeps its existing route.

### 5.2 Landing sections

1. **Hero**
   - Display-serif headline ("Rush, ranked."), one-line subhead, primary CTA "Get started free" + secondary "Try the demo".
   - Right side: stack of 3 PNM cards fanned, subtle parallax on scroll.
   - Cream background, no chapter accent.

2. **Interactive swipe demo**
   - Phone frame mockup with a working swipe deck built from the actual `frontend/components/rush/ActionCard.tsx` component.
   - ~12 fake PNMs (deterministic seed, diverse photos via `pravatar.cc` or local SVG illustrations to avoid third-party calls).
   - Counter: `👍 N  👎 N  ⭐ N`. Reset button.
   - Fake data lives in `frontend/lib/demo-data.ts`. Zero backend calls.

3. **PNM card showcase**
   - Three angled, layered dossier cards floating against soft gradient.
   - Hover → tilt + reveal "notes preview", "voting history", "tags".

4. **Feature grid**
   - 3×2 cards: Live voting sessions, PNM dossiers, Round management, Chapter analytics, Multi-tenant security, Slideshow export (NEW badge).

5. **"How it works"**
   - 3-step horizontal strip: Create chapter → Import PNMs → Run rush.

6. **Social proof placeholder**
   - "Trusted by chapters at —" + row of placeholder university wordmarks. Replace with real names later.

7. **CTA strip**
   - "Free during pilot — request access" → links to `/get-started`.

8. **Footer**
   - Minimal: product / company / legal columns.

### 5.3 Visual direction

- Background: cream `#FAF7F0`. Type: near-black `#0A0A0A`. Single warm-gray card surface.
- Typography pairing: serif display (Instrument Serif) + clean grotesque (Inter or General Sans) for body.
- No drop shadows. 1px borders. Subtle grain overlay for texture.
- Editorial spacing, max-width ~1180px, generous whitespace.
- Signature flourish: swipe-demo cards leave a faded ghost trail of the last swipe.

### 5.4 Self-serve signup wizard (`/get-started`)

Single-page 3-step wizard, progress dots, no extra routes.

- **Step 1 — Chapter**
  - Fraternity combobox seeded from `GET /fraternity-colors` (top 30 + free-text fallback).
  - School (free text).
  - Chapter name (autofilled as `<Fraternity> at <School>`, editable).
- **Step 2 — Admin**
  - Name + email.
  - Submit → Supabase magic-link send.
- **Step 3 — Verify**
  - "Check your email" screen, resend button.

**Provisioning endpoint** (`POST /api/v1/chapters/provision`), called from a client-side post-login hook after the magic link is clicked:
- Idempotent on `(admin_user_id, chapter_name, school)`.
- Creates `chapters` row; if the chosen fraternity matches `fraternity_colors`, pre-fills `theme.accent_hex` with `source: 'auto'`, `enabled: false`.
- Creates `memberships` row → `role='admin'`.
- Returns `{ chapter_id }`; frontend caches and redirects to `/dashboard` with a one-time "Welcome — invite your team" toast.

**Edge cases:**
- User already has a membership → wizard pre-fills with their existing chapter and offers "Go to dashboard" link.
- Magic link opened in a new browser → provision still works (idempotent).
- Fraternity not in top 30 → free-text accepted; theme stays generic until admin sets a hex.

## 6. Phase C — PPTX Slideshow Export

### 6.1 Dependencies

Add to `python_server/requirements.txt`:
- `python-pptx>=0.6.23`
- `Pillow>=10.0`

### 6.2 New module

`python_server/slideshow.py` — keeps deck-building separate from `services.py` (which is already large).

```python
class SlideshowService:
    async def build_pnm_deck(
        self, chapter_id: UUID, pnm_ids: list[UUID], theme: dict
    ) -> bytes: ...
```

Internally:
- Fetches PNM records (joined with notes + vote tallies + photo URLs).
- Fetches photos concurrently (`asyncio.gather`, max 10 in-flight).
- Processes photos with Pillow: auto-orient, resize max 1200px on long edge, crop 4:5, JPEG q85.
- Missing/failed photos → server-rendered avatar fallback (initials on `--accent-soft` tint) via Pillow.
- Builds the `Presentation` and returns `bytes`.

### 6.3 Endpoint

`POST /api/v1/pnms/export/pptx`
- Auth: `get_current_user` + chapter membership with `role ∈ {admin, exec}`.
- Body: same filter shape as the PNM list endpoint (`{ filters: {...}, sort?: string }`).
- Response: `StreamingResponse` with content-type `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `Content-Disposition: attachment; filename="<chapter_slug>-pnms-<YYYYMMDD>.pptx"`.
- Hard limits:
  - 0 PNMs → 400 "No PNMs match your filters".
  - >200 PNMs → 400 "Filter to fewer than 200 PNMs to export".
- Rate-limit via existing `rate_limit.py`: 1 request / 30s / user.
- Mounted under both `/api/v1` and `/api` (matching project convention).

### 6.4 Deck design (single template)

- **Slide size:** 16:9 (13.333" × 7.5").
- **Cover slide:** chapter name (display serif, centered), subtitle "Rush <Year> — PNM Roster" + date stamp + PNM count. Accent bar across top.
- **Section dividers** (auto-inserted between status groups): just the section label centered on `accent_soft` tinted background.
- **PNM slide layout:**
  ```
  ┌─ accent bar ─────────────────────────────────────┐
  │                                                  │
  │  ┌──────────────┐   FIRST LAST                   │
  │  │              │   Year • Major                 │
  │  │   PHOTO      │   GPA 3.84 · Hometown          │
  │  │   (4:5)      │   ─────────────────────        │
  │  │              │   Tags: legacy, athlete, +2    │
  │  │              │                                │
  │  └──────────────┘   Voting: 12 👍  3 👎  2 ⭐    │
  │                     ─────────────────────        │
  │                     Latest note:                 │
  │                     "Great convo at smoker..."   │
  │                                            ─ JS  │
  └──────────────────────────────────── chapter • 12 ┘
  ```
- **Closing slide:** "Exported from RushRank · <timestamp>".

**Typography:**
- Title (PNM name): 32pt serif (Georgia / Calibri fallback chain since PPTX viewers vary).
- Metadata: 14pt sans (Calibri).
- Note quote: 12pt italic with 1ch left indent.
- Footer: 9pt muted gray.

**Theming:**
- Accent bar uses `theme.accent_hex` when `theme.enabled`, else `#0A0A0A`.
- Avatar fallback background uses `accent_soft` derived from accent.
- Otherwise neutral — never floods slides with chapter color.

**Photo treatment:**
- 4:5 portrait crop, 3.5" wide, rounded corners (via rounded-rectangle picture placeholder shape).
- Missing photo → initials avatar at same size.

**Permission-gated content:**
- Vote summary only included for `exec`/`admin` (which is the only role allowed to call this endpoint anyway, so no additional filtering needed).

### 6.5 Frontend wiring

- Toolbar button on `frontend/app/(dashboard)/pnms/page.tsx`: "Export → PowerPoint". Disabled when filtered count is 0.
- Same button surfaced on `frontend/app/(dashboard)/exports/page.tsx` alongside existing exports.
- `frontend/lib/api.ts` gets `exportPnmsPptx(filters)` returning a Blob. UI creates an object URL, programmatic anchor click to download, revokes URL.
- Loading toast: "Building your deck... ~30 PNMs takes about 10s."
- Error toast surfaces the 400 message when count limits are hit.

### 6.6 Performance target

- 50 PNMs in <8s end-to-end on production hardware.
- 200 PNMs (the cap) in <30s.
- If measurements during execution exceed 30s for the cap, follow-up work converts the endpoint to a background job + polling pattern. Spec keeps the sync path for v1.

### 6.7 Tests

`python_server/tests/test_slideshow.py`:
- `test_empty_list_returns_400`
- `test_single_pnm_builds_valid_pptx`
- `test_missing_photo_falls_back_to_initials`
- `test_theme_enabled_applies_accent_bar`
- `test_over_cap_returns_400`
- `test_section_dividers_inserted_between_statuses`

Each test asserts on the bytes-level `Presentation` via `python-pptx`'s reader API (slide count, shape colors, text content).

## 7. Open Items / Deferred

- Real social-proof university wordmarks for the landing page.
- Pricing model (CTA defaults to "request pilot access" until decided).
- Google Drive / Google Slides direct upload (v2 of export — out of scope here).
- Background-job pattern for export if perf budget is exceeded.
- Dark mode + multi-variant theming.

## 8. Out-of-Scope (explicitly not happening here)

- Re-architecting the auth flow.
- Touching the live voting websocket contract.
- Migrating off Supabase storage for PNM photos.
- Building admin tools for managing the `fraternity_colors` table from the UI.
