# Phase A — De-brand & Theming Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip Beta Theta Pi branding from the app and introduce a generic cream/black design-token system with an opt-in per-chapter accent color seeded from the top-30 fraternity palette.

**Architecture:** CSS custom properties in `globals.css` drive Tailwind semantic utilities. Chapter theme is JSONB on `chapters` table; a seeded `fraternity_colors` lookup powers auto-detection. ThemeProvider in dashboard layout sets `--accent` at runtime from `GET /api/v1/chapters/me/theme`. Admin manages it from Settings.

**Tech Stack:** Next 14 (App Router), Tailwind, Supabase (Postgres), FastAPI, asyncpg, react-query.

**Spec:** `docs/superpowers/specs/2026-05-27-rebrand-themes-landing-export-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/0009_chapter_theme.sql` — adds `chapters.theme` JSONB.
- `supabase/migrations/0010_fraternity_colors.sql` — lookup table + 30 seed rows.
- `python_server/fraternity_colors_seed.py` — Python list mirroring the seed (used in tests + provisioning).
- `frontend/lib/theme.ts` — token utilities, contrast helper, hex→HSL.
- `frontend/components/ThemeProvider.tsx` — fetches + applies chapter theme.
- `frontend/components/settings/ChapterAppearanceCard.tsx` — Settings UI.
- `python_server/tests/test_theme_routes.py` — backend tests.
- `frontend/__tests__/theme.test.ts` — token + contrast tests (Vitest or Jest — check what frontend uses).

**Modify:**
- `frontend/app/globals.css` — token definitions.
- `frontend/tailwind.config.ts` — semantic color mapping.
- `python_server/services.py` — extend `ChapterService` with theme methods.
- `python_server/routes.py` — add 3 new routes.
- `frontend/lib/api.ts` — add `getChapterTheme`, `updateChapterTheme`, `getFraternityColors`.
- `frontend/lib/queries.ts` — add `useChapterTheme` hook.
- `frontend/app/(dashboard)/layout.tsx` — wrap in `<ThemeProvider>`, strip BTP copy.
- `frontend/app/login/layout.tsx` — strip BTP copy.
- `frontend/app/login/page.tsx` — strip BTP copy.
- `frontend/app/(dashboard)/settings/page.tsx` — mount `<ChapterAppearanceCard />`.
- All 28 modified frontend files from current `git status` — rewrite hardcoded colors to semantic tokens (one sweep task).

---

## Task 1: Database — chapters.theme migration

**Files:**
- Create: `supabase/migrations/0009_chapter_theme.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0009_chapter_theme.sql
ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL
  DEFAULT '{"enabled": false, "accent_hex": null, "source": "auto"}'::jsonb;

COMMENT ON COLUMN chapters.theme IS
  'Chapter UI theme: {enabled: bool, accent_hex: "#RRGGBB"|null, source: "auto"|"manual"}';
```

- [ ] **Step 2: Apply migration locally**

Run: `psql "$DATABASE_URL" -f supabase/migrations/0009_chapter_theme.sql`
Expected: `ALTER TABLE` then `COMMENT`.

- [ ] **Step 3: Verify**

Run: `psql "$DATABASE_URL" -c "SELECT theme FROM chapters LIMIT 1;"`
Expected: existing rows show `{"enabled": false, "accent_hex": null, "source": "auto"}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_chapter_theme.sql
git commit -m "feat(db): add chapters.theme JSONB for per-chapter accents"
```

---

## Task 2: Database — fraternity_colors seed table

**Files:**
- Create: `supabase/migrations/0010_fraternity_colors.sql`
- Create: `python_server/fraternity_colors_seed.py`

- [ ] **Step 1: Build the Python seed source-of-truth**

Create `python_server/fraternity_colors_seed.py`:

```python
"""Source of truth for top-30 fraternity colors, transcribed from
fraternity-colors-top-30.md. Used by the migration generator and tests."""

FRATERNITY_COLORS = [
    (1,  "Tau Kappa Epsilon",     "tau_kappa_epsilon",     "#D2042D", "#808080", None),
    (2,  "Kappa Sigma",            "kappa_sigma",           "#FF2400", "#FFFFFF", "#50C878"),
    (3,  "Sigma Alpha Epsilon",    "sigma_alpha_epsilon",   "#4B0082", "#CFB53B", None),
    (4,  "Sigma Chi",              "sigma_chi",             "#0033A0", "#CFB53B", None),
    (5,  "Sigma Phi Epsilon",      "sigma_phi_epsilon",     "#C8102E", "#4B0082", "#D4AF37"),
    (6,  "Pi Kappa Alpha",         "pi_kappa_alpha",        "#782F40", "#CFB53B", None),
    (7,  "Lambda Chi Alpha",       "lambda_chi_alpha",      "#4B0082", "#008000", "#FFD700"),
    (8,  "Pi Kappa Phi",           "pi_kappa_phi",          "#FFFFFF", "#D4AF37", None),
    (9,  "Sigma Nu",               "sigma_nu",              "#FFFFFF", "#D4AF37", "#000000"),
    (10, "Phi Delta Theta",        "phi_delta_theta",       "#007FFF", "#C0C0C0", None),
    (11, "Alpha Phi Alpha",        "alpha_phi_alpha",       "#000000", "#D4AF37", None),
    (12, "Kappa Alpha Psi",        "kappa_alpha_psi",       "#DC143C", "#FFFDD0", None),
    (13, "Omega Psi Phi",          "omega_psi_phi",         "#4B0082", "#CFB53B", None),
    (14, "Iota Phi Theta",         "iota_phi_theta",        "#3B2F2F", "#D4AF37", None),
    (15, "Alpha Tau Omega",        "alpha_tau_omega",       "#007FFF", "#CFB53B", None),
    (16, "Beta Theta Pi",          "beta_theta_pi",         "#FFC0CB", "#0033A0", None),
    (17, "Delta Tau Delta",        "delta_tau_delta",       "#4B0082", "#FFFFFF", "#FFD700"),
    (18, "Delta Upsilon",          "delta_upsilon",         "#CFB53B", "#0F52BA", None),
    (19, "Phi Gamma Delta",        "phi_gamma_delta",       "#4B0082", "#FFFFFF", None),
    (20, "Phi Kappa Psi",          "phi_kappa_psi",         "#C41E3A", "#355E3B", None),
    (21, "Phi Kappa Tau",          "phi_kappa_tau",         "#A51C30", "#CFB53B", None),
    (22, "Theta Chi",              "theta_chi",             "#B22222", "#FFFFFF", None),
    (23, "Zeta Beta Tau",          "zeta_beta_tau",         "#0000CD", "#FFFFFF", None),
    (24, "Delta Chi",              "delta_chi",             "#C8102E", "#F0DC82", None),
    (25, "Delta Sigma Phi",        "delta_sigma_phi",       "#29AB87", "#FFFFFF", None),
    (26, "Alpha Sigma Phi",        "alpha_sigma_phi",       "#C41E3A", "#928E85", None),
    (27, "Alpha Epsilon Pi",       "alpha_epsilon_pi",      "#D4AF37", "#0033A0", None),
    (28, "Kappa Alpha Order",      "kappa_alpha_order",     "#DC143C", "#CFB53B", None),
    (29, "Sigma Pi",               "sigma_pi",              "#E6E6FA", "#FFFFFF", "#D4AF37"),
    (30, "Phi Sigma Kappa",        "phi_sigma_kappa",       "#C41E3A", "#C0C0C0", None),
]

ALIASES = {
    "fiji": "Phi Gamma Delta",
    "phi gamma delta / fiji": "Phi Gamma Delta",
}
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0010_fraternity_colors.sql`:

```sql
-- 0010_fraternity_colors.sql
CREATE TABLE IF NOT EXISTS fraternity_colors (
  key            TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  rank           INT  NOT NULL,
  hex_primary    TEXT NOT NULL,
  hex_secondary  TEXT,
  hex_tertiary   TEXT
);

CREATE INDEX IF NOT EXISTS fraternity_colors_name_lower_idx
  ON fraternity_colors (lower(name));

INSERT INTO fraternity_colors (key, name, rank, hex_primary, hex_secondary, hex_tertiary) VALUES
('tau_kappa_epsilon',   'Tau Kappa Epsilon',   1,  '#D2042D', '#808080', NULL),
('kappa_sigma',         'Kappa Sigma',          2,  '#FF2400', '#FFFFFF', '#50C878'),
('sigma_alpha_epsilon', 'Sigma Alpha Epsilon',  3,  '#4B0082', '#CFB53B', NULL),
('sigma_chi',           'Sigma Chi',            4,  '#0033A0', '#CFB53B', NULL),
('sigma_phi_epsilon',   'Sigma Phi Epsilon',    5,  '#C8102E', '#4B0082', '#D4AF37'),
('pi_kappa_alpha',      'Pi Kappa Alpha',       6,  '#782F40', '#CFB53B', NULL),
('lambda_chi_alpha',    'Lambda Chi Alpha',     7,  '#4B0082', '#008000', '#FFD700'),
('pi_kappa_phi',        'Pi Kappa Phi',         8,  '#FFFFFF', '#D4AF37', NULL),
('sigma_nu',            'Sigma Nu',             9,  '#FFFFFF', '#D4AF37', '#000000'),
('phi_delta_theta',     'Phi Delta Theta',     10, '#007FFF', '#C0C0C0', NULL),
('alpha_phi_alpha',     'Alpha Phi Alpha',     11, '#000000', '#D4AF37', NULL),
('kappa_alpha_psi',     'Kappa Alpha Psi',     12, '#DC143C', '#FFFDD0', NULL),
('omega_psi_phi',       'Omega Psi Phi',       13, '#4B0082', '#CFB53B', NULL),
('iota_phi_theta',      'Iota Phi Theta',      14, '#3B2F2F', '#D4AF37', NULL),
('alpha_tau_omega',     'Alpha Tau Omega',     15, '#007FFF', '#CFB53B', NULL),
('beta_theta_pi',       'Beta Theta Pi',       16, '#FFC0CB', '#0033A0', NULL),
('delta_tau_delta',     'Delta Tau Delta',     17, '#4B0082', '#FFFFFF', '#FFD700'),
('delta_upsilon',       'Delta Upsilon',       18, '#CFB53B', '#0F52BA', NULL),
('phi_gamma_delta',     'Phi Gamma Delta',     19, '#4B0082', '#FFFFFF', NULL),
('phi_kappa_psi',       'Phi Kappa Psi',       20, '#C41E3A', '#355E3B', NULL),
('phi_kappa_tau',       'Phi Kappa Tau',       21, '#A51C30', '#CFB53B', NULL),
('theta_chi',           'Theta Chi',           22, '#B22222', '#FFFFFF', NULL),
('zeta_beta_tau',       'Zeta Beta Tau',       23, '#0000CD', '#FFFFFF', NULL),
('delta_chi',           'Delta Chi',           24, '#C8102E', '#F0DC82', NULL),
('delta_sigma_phi',     'Delta Sigma Phi',     25, '#29AB87', '#FFFFFF', NULL),
('alpha_sigma_phi',     'Alpha Sigma Phi',     26, '#C41E3A', '#928E85', NULL),
('alpha_epsilon_pi',    'Alpha Epsilon Pi',    27, '#D4AF37', '#0033A0', NULL),
('kappa_alpha_order',   'Kappa Alpha Order',   28, '#DC143C', '#CFB53B', NULL),
('sigma_pi',            'Sigma Pi',            29, '#E6E6FA', '#FFFFFF', '#D4AF37'),
('phi_sigma_kappa',     'Phi Sigma Kappa',     30, '#C41E3A', '#C0C0C0', NULL)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  rank = EXCLUDED.rank,
  hex_primary = EXCLUDED.hex_primary,
  hex_secondary = EXCLUDED.hex_secondary,
  hex_tertiary = EXCLUDED.hex_tertiary;
```

- [ ] **Step 3: Apply and verify**

Run: `psql "$DATABASE_URL" -f supabase/migrations/0010_fraternity_colors.sql && psql "$DATABASE_URL" -c "SELECT count(*) FROM fraternity_colors;"`
Expected: `count = 30`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_fraternity_colors.sql python_server/fraternity_colors_seed.py
git commit -m "feat(db): seed fraternity_colors lookup table"
```

---

## Task 3: Backend — ChapterService theme methods (TDD)

**Files:**
- Test: `python_server/tests/test_theme_service.py`
- Modify: `python_server/services.py` (ChapterService)

- [ ] **Step 1: Write failing tests**

Create `python_server/tests/test_theme_service.py`:

```python
import pytest
from python_server.services import ChapterService

@pytest.mark.asyncio
async def test_get_theme_returns_default_for_new_chapter(db_pool, sample_chapter):
    svc = ChapterService(db_pool)
    theme = await svc.get_theme(sample_chapter["id"])
    assert theme == {"enabled": False, "accent_hex": None, "source": "auto"}

@pytest.mark.asyncio
async def test_update_theme_persists_admin_changes(db_pool, sample_chapter, admin_user):
    svc = ChapterService(db_pool)
    new = {"enabled": True, "accent_hex": "#0033A0", "source": "manual"}
    result = await svc.update_theme(sample_chapter["id"], admin_user["id"], new)
    assert result == new
    refetched = await svc.get_theme(sample_chapter["id"])
    assert refetched == new

@pytest.mark.asyncio
async def test_update_theme_rejects_invalid_hex(db_pool, sample_chapter, admin_user):
    svc = ChapterService(db_pool)
    with pytest.raises(ValueError, match="hex"):
        await svc.update_theme(
            sample_chapter["id"], admin_user["id"],
            {"enabled": True, "accent_hex": "not-a-hex", "source": "manual"},
        )

@pytest.mark.asyncio
async def test_update_theme_rejects_non_admin(db_pool, sample_chapter, member_user):
    svc = ChapterService(db_pool)
    with pytest.raises(PermissionError):
        await svc.update_theme(
            sample_chapter["id"], member_user["id"],
            {"enabled": True, "accent_hex": "#000000", "source": "manual"},
        )

@pytest.mark.asyncio
async def test_autodetect_accent_matches_known_fraternity(db_pool):
    svc = ChapterService(db_pool)
    hex_ = await svc.autodetect_accent("Sigma Chi")
    assert hex_ == "#0033A0"

@pytest.mark.asyncio
async def test_autodetect_accent_handles_fiji_alias(db_pool):
    svc = ChapterService(db_pool)
    hex_ = await svc.autodetect_accent("FIJI")
    assert hex_ == "#4B0082"

@pytest.mark.asyncio
async def test_autodetect_accent_returns_none_for_unknown(db_pool):
    svc = ChapterService(db_pool)
    hex_ = await svc.autodetect_accent("Made Up Fraternity")
    assert hex_ is None
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd python_server && pytest tests/test_theme_service.py -v`
Expected: all 7 tests FAIL (methods not defined).

- [ ] **Step 3: Implement in ChapterService**

In `python_server/services.py`, locate `class ChapterService` and add:

```python
import re
from python_server.fraternity_colors_seed import ALIASES

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

class ChapterService:
    # ... existing methods ...

    async def get_theme(self, chapter_id) -> dict:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT theme FROM chapters WHERE id = $1", chapter_id
            )
            if not row:
                raise ValueError(f"Chapter {chapter_id} not found")
            return dict(row["theme"])

    async def update_theme(self, chapter_id, user_id, patch: dict) -> dict:
        await self._require_admin(chapter_id, user_id)
        accent = patch.get("accent_hex")
        if accent is not None and not _HEX_RE.match(accent):
            raise ValueError(f"Invalid accent_hex: {accent!r} (must be #RRGGBB)")
        source = patch.get("source", "manual")
        if source not in ("auto", "manual"):
            raise ValueError(f"Invalid source: {source!r}")
        new_theme = {
            "enabled": bool(patch.get("enabled", False)),
            "accent_hex": accent,
            "source": source,
        }
        async with self.pool.acquire() as conn:
            await conn.execute(
                "UPDATE chapters SET theme = $1::jsonb WHERE id = $2",
                json.dumps(new_theme), chapter_id,
            )
        return new_theme

    async def autodetect_accent(self, fraternity_name: str) -> str | None:
        normalized = fraternity_name.strip().lower()
        canonical = ALIASES.get(normalized, fraternity_name).strip()
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT hex_primary FROM fraternity_colors WHERE lower(name) = lower($1)",
                canonical,
            )
            return row["hex_primary"] if row else None

    async def _require_admin(self, chapter_id, user_id):
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT role FROM memberships WHERE chapter_id = $1 AND user_id = $2",
                chapter_id, user_id,
            )
            if not row or row["role"] != "admin":
                raise PermissionError("Admin role required")
```

Add `import json` at top of file if missing.

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd python_server && pytest tests/test_theme_service.py -v`
Expected: all 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/services.py python_server/tests/test_theme_service.py
git commit -m "feat(api): add ChapterService theme + autodetect methods"
```

---

## Task 4: Backend — theme routes (TDD)

**Files:**
- Test: `python_server/tests/test_theme_routes.py`
- Modify: `python_server/routes.py`

- [ ] **Step 1: Write failing tests**

Create `python_server/tests/test_theme_routes.py`:

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_my_theme_returns_default(client: AsyncClient, member_token):
    r = await client.get(
        "/api/v1/chapters/me/theme",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "accent_hex": None, "source": "auto"}

@pytest.mark.asyncio
async def test_patch_theme_as_admin(client, admin_token):
    r = await client.patch(
        "/api/v1/chapters/me/theme",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"enabled": True, "accent_hex": "#0033A0", "source": "manual"},
    )
    assert r.status_code == 200
    assert r.json()["accent_hex"] == "#0033A0"

@pytest.mark.asyncio
async def test_patch_theme_as_member_forbidden(client, member_token):
    r = await client.patch(
        "/api/v1/chapters/me/theme",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"enabled": True, "accent_hex": "#0033A0", "source": "manual"},
    )
    assert r.status_code == 403

@pytest.mark.asyncio
async def test_patch_theme_rejects_bad_hex(client, admin_token):
    r = await client.patch(
        "/api/v1/chapters/me/theme",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"enabled": True, "accent_hex": "blue", "source": "manual"},
    )
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_fraternity_colors_lists_30(client):
    r = await client.get("/api/v1/fraternity-colors")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 30
    assert {"key", "name", "hex_primary"}.issubset(data[0].keys())

@pytest.mark.asyncio
async def test_routes_mounted_on_legacy_api(client, member_token):
    r = await client.get(
        "/api/chapters/me/theme",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert r.status_code == 200
```

- [ ] **Step 2: Run, confirm failure**

Run: `cd python_server && pytest tests/test_theme_routes.py -v`
Expected: all 6 FAIL with 404.

- [ ] **Step 3: Implement routes**

In `python_server/routes.py`, add inside the existing router setup (mount on both `/api/v1` and `/api` per project convention):

```python
from fastapi import HTTPException
from pydantic import BaseModel, Field

class ThemePatch(BaseModel):
    enabled: bool
    accent_hex: str | None = Field(default=None)
    source: str = Field(default="manual")

@router.get("/chapters/me/theme")
async def get_my_theme(
    user=Depends(get_current_user),
    chapter_svc: ChapterService = Depends(get_chapter_service),
):
    chapter_id = await chapter_svc.get_user_chapter_id(user.id)
    return await chapter_svc.get_theme(chapter_id)

@router.patch("/chapters/me/theme")
async def patch_my_theme(
    patch: ThemePatch,
    user=Depends(get_current_user),
    chapter_svc: ChapterService = Depends(get_chapter_service),
):
    chapter_id = await chapter_svc.get_user_chapter_id(user.id)
    try:
        return await chapter_svc.update_theme(chapter_id, user.id, patch.model_dump())
    except PermissionError:
        raise HTTPException(403, "Admin role required")
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.get("/fraternity-colors")
async def list_fraternity_colors(
    chapter_svc: ChapterService = Depends(get_chapter_service),
):
    return await chapter_svc.list_fraternity_colors()
```

In `services.py`, add to `ChapterService`:

```python
async def list_fraternity_colors(self) -> list[dict]:
    async with self.pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT key, name, hex_primary FROM fraternity_colors ORDER BY rank"
        )
        return [dict(r) for r in rows]

async def get_user_chapter_id(self, user_id):
    async with self.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT chapter_id FROM memberships WHERE user_id = $1 LIMIT 1",
            user_id,
        )
        if not row:
            raise HTTPException(404, "No chapter membership found")
        return row["chapter_id"]
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_theme_routes.py -v`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/routes.py python_server/services.py python_server/tests/test_theme_routes.py
git commit -m "feat(api): theme + fraternity-colors endpoints"
```

---

## Task 5: Frontend — design tokens in globals.css + tailwind.config.ts

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/tailwind.config.ts`

- [ ] **Step 1: Write `:root` token block**

In `frontend/app/globals.css`, replace any existing color custom properties with:

```css
:root {
  --bg: #FAF7F0;
  --surface: #FFFFFF;
  --surface-muted: #F4F0E4;
  --fg: #0A0A0A;
  --fg-muted: #5C5C5C;
  --border: #E8E3D6;
  --accent: #0A0A0A;
  --accent-fg: #FFFFFF;
  --accent-soft: rgba(10, 10, 10, 0.08);
  --accent-fg-on-bg: #0A0A0A;
  --danger: #B42318;
  --success: #1F7A4D;
}

html, body {
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 2: Wire tokens into Tailwind**

In `frontend/tailwind.config.ts`, in the `theme.extend.colors` block:

```ts
colors: {
  bg: "var(--bg)",
  surface: "var(--surface)",
  "surface-muted": "var(--surface-muted)",
  fg: "var(--fg)",
  muted: "var(--fg-muted)",
  border: "var(--border)",
  accent: "var(--accent)",
  "accent-fg": "var(--accent-fg)",
  "accent-soft": "var(--accent-soft)",
  "accent-text": "var(--accent-fg-on-bg)",
  danger: "var(--danger)",
  success: "var(--success)",
},
```

- [ ] **Step 3: Typecheck and build**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: PASS (no type errors; existing usages of hardcoded colors remain but compile).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/tailwind.config.ts
git commit -m "feat(ui): introduce cream/black design tokens"
```

---

## Task 6: Frontend — theme.ts contrast utilities (TDD)

**Files:**
- Test: `frontend/__tests__/theme.test.ts`
- Create: `frontend/lib/theme.ts`

- [ ] **Step 1: Confirm test runner**

Run: `cd frontend && cat package.json | grep -E '"(test|vitest|jest)"'`
Expected: identifies `vitest` or `jest`. If neither, add Vitest:

```bash
cd frontend && npm install -D vitest @vitest/ui
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write failing tests**

Create `frontend/__tests__/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hexToRgb, contrastRatio, deriveAccentTokens, isValidHex } from "@/lib/theme";

describe("isValidHex", () => {
  it("accepts 6-digit hex", () => expect(isValidHex("#0033A0")).toBe(true));
  it("rejects 3-digit hex", () => expect(isValidHex("#03A")).toBe(false));
  it("rejects non-hex", () => expect(isValidHex("blue")).toBe(false));
});

describe("hexToRgb", () => {
  it("parses #FFFFFF", () => expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 }));
  it("parses #000000", () => expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 }));
  it("parses #0033A0", () => expect(hexToRgb("#0033A0")).toEqual({ r: 0, g: 51, b: 160 }));
});

describe("contrastRatio", () => {
  it("black on white = 21", () =>
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0));
  it("same color = 1", () =>
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 1));
});

describe("deriveAccentTokens", () => {
  it("dark accent on cream uses accent as text color", () => {
    const t = deriveAccentTokens("#0033A0");
    expect(t.accent).toBe("#0033A0");
    expect(t.accentFgOnBg).toBe("#0033A0");
    expect(t.accentFg).toBe("#FFFFFF");
  });
  it("light accent darkens for text on cream (BTP pink)", () => {
    const t = deriveAccentTokens("#FFC0CB");
    expect(t.accent).toBe("#FFC0CB");
    expect(t.accentFgOnBg).not.toBe("#FFC0CB");
    expect(contrastRatio(t.accentFgOnBg, "#FAF7F0")).toBeGreaterThanOrEqual(4.5);
    expect(t.accentFg).toBe("#0A0A0A");
  });
  it("light accent picks dark text on accent fill", () => {
    const t = deriveAccentTokens("#FFC0CB");
    expect(t.accentFg).toBe("#0A0A0A");
  });
  it("dark accent picks white text on accent fill", () => {
    const t = deriveAccentTokens("#0033A0");
    expect(t.accentFg).toBe("#FFFFFF");
  });
});
```

- [ ] **Step 3: Run, confirm fail**

Run: `cd frontend && npm test -- theme.test`
Expected: module not found.

- [ ] **Step 4: Implement `lib/theme.ts`**

```ts
export const BG_CREAM = "#FAF7F0";

export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function relLum({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLum(hexToRgb(a));
  const lb = relLum(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export interface AccentTokens {
  accent: string;
  accentFg: string;        // text color on accent-filled surfaces
  accentSoft: string;      // 8% accent tint
  accentFgOnBg: string;    // accent used as text on the cream bg (may be darkened)
}

export function deriveAccentTokens(hex: string): AccentTokens {
  if (!isValidHex(hex)) throw new Error(`Invalid hex: ${hex}`);

  const accentFg = contrastRatio(hex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#0A0A0A";

  let accentFgOnBg = hex;
  let attempts = 0;
  while (contrastRatio(accentFgOnBg, BG_CREAM) < 4.5 && attempts < 12) {
    accentFgOnBg = darken(accentFgOnBg, 0.12);
    attempts++;
  }

  const { r, g, b } = hexToRgb(hex);
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.08)`;

  return { accent: hex, accentFg, accentSoft, accentFgOnBg };
}
```

- [ ] **Step 5: Run, confirm pass**

Run: `cd frontend && npm test -- theme.test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/theme.ts frontend/__tests__/theme.test.ts frontend/package.json
git commit -m "feat(ui): theme token utilities with WCAG contrast guardrail"
```

---

## Task 7: Frontend — api.ts + queries.ts wiring

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/queries.ts`

- [ ] **Step 1: Add API client functions**

In `frontend/lib/api.ts`, add (following existing function style):

```ts
export interface ChapterTheme {
  enabled: boolean;
  accent_hex: string | null;
  source: "auto" | "manual";
}

export interface FraternityColor {
  key: string;
  name: string;
  hex_primary: string;
}

export async function getChapterTheme(): Promise<ChapterTheme> {
  return apiGet<ChapterTheme>("/chapters/me/theme");
}

export async function updateChapterTheme(patch: ChapterTheme): Promise<ChapterTheme> {
  return apiPatch<ChapterTheme>("/chapters/me/theme", patch);
}

export async function getFraternityColors(): Promise<FraternityColor[]> {
  return apiGet<FraternityColor[]>("/fraternity-colors");
}
```

(If `apiPatch` doesn't exist, add it mirroring `apiPost` in the same file.)

- [ ] **Step 2: Add react-query hooks**

In `frontend/lib/queries.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChapterTheme, updateChapterTheme, getFraternityColors, ChapterTheme } from "./api";

export function useChapterTheme() {
  return useQuery({
    queryKey: ["chapter-theme"],
    queryFn: getChapterTheme,
    staleTime: 60 * 60 * 1000,
  });
}

export function useUpdateChapterTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChapterTheme) => updateChapterTheme(patch),
    onSuccess: (data) => qc.setQueryData(["chapter-theme"], data),
  });
}

export function useFraternityColors() {
  return useQuery({
    queryKey: ["fraternity-colors"],
    queryFn: getFraternityColors,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/queries.ts
git commit -m "feat(ui): chapter-theme api + react-query hooks"
```

---

## Task 8: Frontend — ThemeProvider component

**Files:**
- Create: `frontend/components/ThemeProvider.tsx`
- Modify: `frontend/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// frontend/components/ThemeProvider.tsx
"use client";

import { useEffect } from "react";
import { useChapterTheme } from "@/lib/queries";
import { deriveAccentTokens, isValidHex } from "@/lib/theme";

const STORAGE_KEY = "rushrank.theme.v1";

function applyTokens(hex: string | null) {
  const root = document.documentElement.style;
  if (!hex || !isValidHex(hex)) {
    root.setProperty("--accent", "#0A0A0A");
    root.setProperty("--accent-fg", "#FFFFFF");
    root.setProperty("--accent-soft", "rgba(10,10,10,0.08)");
    root.setProperty("--accent-fg-on-bg", "#0A0A0A");
    return;
  }
  const t = deriveAccentTokens(hex);
  root.setProperty("--accent", t.accent);
  root.setProperty("--accent-fg", t.accentFg);
  root.setProperty("--accent-soft", t.accentSoft);
  root.setProperty("--accent-fg-on-bg", t.accentFgOnBg);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { hex, ts } = JSON.parse(cached);
        if (Date.now() - ts < 60 * 60 * 1000) applyTokens(hex);
      }
    } catch {}
  }, []);

  const { data } = useChapterTheme();

  useEffect(() => {
    if (!data) return;
    const hex = data.enabled ? data.accent_hex : null;
    applyTokens(hex);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hex, ts: Date.now() }));
    } catch {}
  }, [data]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Mount in dashboard layout**

In `frontend/app/(dashboard)/layout.tsx`, wrap the existing children in `<ThemeProvider>`:

```tsx
import { ThemeProvider } from "@/components/ThemeProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* existing layout content */}
    </ThemeProvider>
  );
}
```

(Preserve the rest of the existing file; this task only adds the wrapper.)

- [ ] **Step 3: Manual smoke**

Run: `cd frontend && npm run dev` and load `/dashboard`.
Expected: no console errors; tokens still resolve to cream/black defaults for chapters without `theme.enabled`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ThemeProvider.tsx frontend/app/(dashboard)/layout.tsx
git commit -m "feat(ui): apply chapter theme at runtime via ThemeProvider"
```

---

## Task 9: Frontend — ChapterAppearanceCard in Settings

**Files:**
- Create: `frontend/components/settings/ChapterAppearanceCard.tsx`
- Modify: `frontend/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Build the card**

```tsx
// frontend/components/settings/ChapterAppearanceCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useChapterTheme, useUpdateChapterTheme } from "@/lib/queries";
import { isValidHex } from "@/lib/theme";

export function ChapterAppearanceCard() {
  const { data } = useChapterTheme();
  const update = useUpdateChapterTheme();
  const [enabled, setEnabled] = useState(false);
  const [hex, setHex] = useState<string>("#0033A0");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    if (data.accent_hex) setHex(data.accent_hex);
  }, [data]);

  const hexValid = isValidHex(hex);

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-fg">Chapter Appearance</h2>
      <p className="mt-1 text-sm text-muted">
        Apply a chapter accent color across the product. Disabled by default.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="radio"
            checked={!enabled}
            onChange={() => setEnabled(false)}
          />
          <span>Generic (cream & black)</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            checked={enabled}
            onChange={() => setEnabled(true)}
          />
          <span>Use our chapter colors</span>
        </label>
      </div>

      {enabled && (
        <div className="mt-4 flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border border-border"
            style={{ backgroundColor: hexValid ? hex : "#CCCCCC" }}
          />
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 font-mono text-sm"
            placeholder="#0033A0"
          />
          {!hexValid && <span className="text-sm text-danger">Invalid hex</span>}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          className="rounded-lg bg-accent px-4 py-2 text-accent-fg disabled:opacity-50"
          disabled={enabled && !hexValid}
          onClick={() =>
            update.mutate({
              enabled,
              accent_hex: enabled ? hex : null,
              source: "manual",
            })
          }
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <div className="ml-auto flex gap-2">
          <span className="rounded bg-accent px-2 py-1 text-xs text-accent-fg">Button</span>
          <span className="rounded border-b-2 border-accent px-2 py-1 text-xs">Tab</span>
          <span className="rounded bg-accent-soft px-2 py-1 text-xs text-accent-text">Tag</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in Settings page**

In `frontend/app/(dashboard)/settings/page.tsx`, import and render the card in the page body:

```tsx
import { ChapterAppearanceCard } from "@/components/settings/ChapterAppearanceCard";

// inside the page component's returned JSX, alongside other settings cards:
<ChapterAppearanceCard />
```

- [ ] **Step 3: Typecheck + smoke**

Run: `cd frontend && npm run typecheck && npm run dev`
Expected: typecheck PASS. Manually load `/settings` as an admin, toggle to chapter colors, enter `#0033A0`, click Save. Confirm primary buttons across the app immediately re-tint blue.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/settings/ChapterAppearanceCard.tsx frontend/app/(dashboard)/settings/page.tsx
git commit -m "feat(ui): chapter appearance settings card"
```

---

## Task 10: De-brand sweep — known files

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx`
- Modify: `frontend/app/login/layout.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/components/heritage.tsx` (review then delete or generalize)

- [ ] **Step 1: Grep current references**

Run: `cd /Users/coleh/rushrank-0.0 && grep -rni "beta theta\|wooglin\|βθπ\|btp" frontend supabase python_server 2>/dev/null`
Expected: list of every remaining hit.

- [ ] **Step 2: Replace BTP-specific copy with "RushRank"**

In each of:
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/app/login/layout.tsx`
- `frontend/app/login/page.tsx`

Replace any `"Beta Theta Pi"` literal or BTP-themed tagline with `"RushRank"`. Replace any chapter-pink/blue inline style (`bg-pink-*`, `text-blue-900`, hardcoded `#FFC0CB` / `#0033A0`) with semantic token classes (`bg-accent`, `text-accent-text`, etc.).

- [ ] **Step 3: Resolve `frontend/components/heritage.tsx`**

Read the file. If it contains BTP-specific imagery/copy with no generic use case, delete it and remove imports. If it has reusable structure, rename props/labels to be generic ("Chapter heritage" not "Beta Theta Pi heritage") and keep.

- [ ] **Step 4: Re-grep to confirm zero hits**

Run: `cd /Users/coleh/rushrank-0.0 && grep -rni "beta theta\|wooglin\|βθπ" frontend supabase python_server 2>/dev/null`
Expected: no results (the `fraternity_colors` table row "Beta Theta Pi" is fine — it's data, not branding).

- [ ] **Step 5: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore(brand): remove Beta Theta Pi references"
```

---

## Task 11: Token sweep — rewrite hardcoded colors across modified files

**Files:**
- Modify: all 28 frontend files showing in `git status` modified at spec time:
  - `frontend/app/(dashboard)/admin/analytics/page.tsx`
  - `frontend/app/(dashboard)/admin/tags/page.tsx`
  - `frontend/app/(dashboard)/admin/users/page.tsx`
  - `frontend/app/(dashboard)/analytics/page.tsx`
  - `frontend/app/(dashboard)/compare/page.tsx`
  - `frontend/app/(dashboard)/events/[id]/checkin/page.tsx`
  - `frontend/app/(dashboard)/events/page.tsx`
  - `frontend/app/(dashboard)/exports/page.tsx`
  - `frontend/app/(dashboard)/layout.tsx`
  - `frontend/app/(dashboard)/page.tsx`
  - `frontend/app/(dashboard)/pnms/[id]/page.tsx`
  - `frontend/app/(dashboard)/pnms/page.tsx`
  - `frontend/app/(dashboard)/profile/page.tsx`
  - `frontend/app/(dashboard)/results/page.tsx`
  - `frontend/app/(dashboard)/rush/page.tsx`
  - `frontend/app/(dashboard)/settings/page.tsx`
  - `frontend/app/(dashboard)/voting/page.tsx`
  - `frontend/app/intake/page.tsx`
  - `frontend/app/layout.tsx`
  - `frontend/app/login/layout.tsx`
  - `frontend/app/login/page.tsx`
  - `frontend/components/BottomNav.tsx`
  - `frontend/components/TopbarWithLeftNav.tsx`
  - `frontend/components/rush/ActionCard.tsx`

- [ ] **Step 1: Define the mapping**

Substitutions to apply in every file in the list:

| From | To |
|---|---|
| `bg-white` (top-level surface) | `bg-surface` |
| `bg-white` (page background) | `bg-bg` |
| `text-black`, `text-gray-900` | `text-fg` |
| `text-gray-500`, `text-gray-600` | `text-muted` |
| `border-gray-200`, `border-gray-100` | `border-border` |
| `bg-pink-*` (BTP brand) | `bg-accent` (button/CTA) OR `bg-accent-soft` (chip/tint) |
| `bg-blue-900`, `text-blue-900` (BTP brand) | `bg-accent` / `text-accent-text` |
| Hardcoded `#FFC0CB`, `#0033A0` | `var(--accent)` / `var(--accent-soft)` |
| Primary CTA buttons (`bg-black`, `bg-gray-900`) | `bg-accent text-accent-fg` |
| Active nav indicator | `bg-accent` or `border-accent` |
| Vote up button | leave as `bg-success` / semantic green |
| Vote down button | leave as `bg-danger` / semantic red |

- [ ] **Step 2: Apply across each file**

Walk each file in the list above and apply the mapping. For each file:
1. Open it.
2. Replace literals per the mapping table.
3. Save.

DO NOT change layout, spacing, copy, or component structure — this is a color-only sweep.

- [ ] **Step 3: Verify no hardcoded brand colors remain in those files**

Run:
```bash
cd /Users/coleh/rushrank-0.0 && grep -nE "#FFC0CB|#0033A0|bg-pink-|text-pink-|bg-blue-900|text-blue-900" frontend/app frontend/components 2>/dev/null
```
Expected: no results.

- [ ] **Step 4: Build + typecheck**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 5: Manual visual check**

Run: `cd frontend && npm run dev`. Click through every modified page. Confirm:
- Default look is cream + black, sleek and neutral.
- Toggle "Use chapter colors" in Settings with `#0033A0` → primary buttons + active nav turn navy blue across all pages.
- Vote up/down stay green/red (semantic), not the accent.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "refactor(ui): migrate hardcoded colors to semantic design tokens"
```

---

## Task 12: Smoke + verification pass

- [ ] **Step 1: Full backend test run**

Run: `cd python_server && pytest -v`
Expected: all tests PASS (existing + new theme tests).

- [ ] **Step 2: Full frontend checks**

Run: `cd frontend && npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 3: End-to-end smoke**

Start backend: `python run_fastapi.py`
Start frontend: `cd frontend && npm run dev`

Scenarios to manually walk:
1. Log in as admin → `/settings` → confirm "Chapter Appearance" card renders.
2. Toggle to chapter colors with `#0033A0` → save → primary buttons across `/dashboard`, `/pnms`, `/voting` are navy.
3. Toggle back to Generic → buttons return to black.
4. Log in as member → `/settings` → confirm `PATCH` is rejected (403 via UI hiding or backend rejection).
5. Confirm `Beta Theta Pi` appears nowhere in the UI (only in the seed table data).

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git status
# if anything pending:
git add . && git commit -m "chore: phase A cleanup"
```

---

## Self-Review

- ✅ Spec § 4.1 De-brand sweep — Task 10.
- ✅ Spec § 4.2 Token system — Task 5.
- ✅ Spec § 4.3 Page rewrites — Task 11.
- ✅ Spec § 4.4 chapters.theme + fraternity_colors migrations — Tasks 1, 2.
- ✅ Spec § 4.5 Backend service + routes — Tasks 3, 4.
- ✅ Spec § 4.6 ThemeProvider + contrast guardrail — Tasks 6, 8.
- ✅ Spec § 4.7 Settings UI — Task 9.
- ✅ Smoke + verification — Task 12.

No placeholders. Method names consistent across tasks (`getChapterTheme` / `updateChapterTheme` / `useChapterTheme` / `deriveAccentTokens` / `isValidHex`).
