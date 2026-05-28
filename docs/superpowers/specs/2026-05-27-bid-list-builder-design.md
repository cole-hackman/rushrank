# Bid-List Builder — Design Spec

**Date:** 2026-05-27
**Author:** Cole (with Claude)
**Status:** Approved for planning

## 1. Summary

A new admin/exec-only page at `/bid-list` that turns a completed voting round into a structured bid decision. Three drag-drop buckets — **Cut**, **Maybe**, **Bid** — let exec sort the rush class, see a live bid count against an optional cap, and export the result to PDF, CSV, or a filtered PPTX deck. Closes the gap between "voting happened" and "we made decisions."

## 2. Goals & Non-Goals

**Goals**
- One place to turn a completed round into a final bid decision.
- Visible bid-count vs. cap so exec respects IFC quotas without external tracking.
- Polished, printable bid sheet (PDF) suitable for IFC submission / chapter records.
- Single-editor lock prevents two admins overwriting each other in the same minute.

**Non-Goals**
- Collaborative real-time editing (deferred; lock-based single editor for v1).
- Ranked priority within the Bid bucket beyond drag-ordering (no separate "extend in this order" workflow).
- Member-side suggestions / voting on the bid list (admins only).
- Locking the list immutable after finalize — `finalized_at` is a timestamp, not a write-protect.
- Replacing voting rounds. The builder consumes a completed round; it doesn't replace the live voting flow.

## 3. Workflow

1. Chapter runs voting rounds as today.
2. Chair ends the final round → status flips to `completed` → a "Build bid list" CTA appears on `/voting`.
3. Click → server creates a new `bid_lists` row seeded from that round (every PNM in `selected_pnm_ids` lands in **Maybe**, ordered by their final vote score). Redirect to `/bid-list`.
4. Admin acquires the editor lock automatically on page mount.
5. Admin drags PNMs between Cut / Maybe / Bid. Bid count vs. cap displayed in the header.
6. Admin clicks **Finalize** when done. `finalized_at` stamped. List remains editable; re-finalizing just bumps the timestamp.
7. Admin exports via the **Export ▾** menu: PDF (printable bid sheet), CSV (spreadsheet), or PPTX (filtered to the Bid bucket via the existing slideshow endpoint).

## 4. Data Model

**Migration `supabase/migrations/0012_bid_lists.sql`:**

```sql
CREATE TYPE bid_bucket AS ENUM ('cut', 'maybe', 'bid');

CREATE TABLE bid_lists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id      UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  source_round_id UUID REFERENCES voting_rounds(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  bid_cap         INT,
  locked_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at       TIMESTAMPTZ,
  finalized_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bid_lists_chapter_idx ON bid_lists (chapter_id, created_at DESC);

CREATE TABLE bid_list_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_list_id   UUID NOT NULL REFERENCES bid_lists(id) ON DELETE CASCADE,
  pnm_id        UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  bucket        bid_bucket NOT NULL DEFAULT 'maybe',
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bid_list_id, pnm_id)
);

CREATE INDEX bid_list_entries_list_bucket_idx
  ON bid_list_entries (bid_list_id, bucket, position);
```

Lock TTL: 10 minutes. Enforced in service code (no DB constraint); `locked_at` older than 10 min means another admin may take over.

## 5. Backend

New module `python_server/bid_list.py` (keep `services.py` from growing further):

```python
class BidListService:
    LOCK_TTL_SECONDS = 600  # 10 min

    async def get_active(self, chapter_id: str) -> Optional[dict]: ...
    async def create_from_round(
        self, chapter_id: str, source_round_id: str,
        name: str, bid_cap: Optional[int], user_id: str,
    ) -> dict: ...
    async def acquire_lock(self, bid_list_id: str, user_id: str) -> dict: ...
    async def refresh_lock(self, bid_list_id: str, user_id: str) -> dict: ...
    async def release_lock(self, bid_list_id: str, user_id: str) -> None: ...
    async def update_entry(
        self, bid_list_id: str, pnm_id: str,
        bucket: str, position: int, user_id: str,
    ) -> dict: ...
    async def finalize(self, bid_list_id: str, user_id: str) -> dict: ...
    async def export_csv(self, bid_list_id: str) -> str: ...
    async def export_pdf(self, bid_list_id: str) -> bytes: ...
```

**Routes** (admin/exec only, mounted under both `/api/v1` and `/api`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/chapters/me/bid-list` | Active list + entries + lock state |
| POST | `/chapters/me/bid-list` | Create from a round (`{source_round_id, name, bid_cap}`) |
| POST | `/chapters/me/bid-list/lock` | Acquire |
| POST | `/chapters/me/bid-list/lock/refresh` | Heartbeat |
| DELETE | `/chapters/me/bid-list/lock` | Release |
| PATCH | `/chapters/me/bid-list/entries/{pnm_id}` | Move/reorder; `{bucket, position}` |
| POST | `/chapters/me/bid-list/finalize` | Stamp `finalized_at` |
| GET | `/chapters/me/bid-list/export/csv` | CSV download |
| GET | `/chapters/me/bid-list/export/pdf` | PDF download |

PPTX reuses the existing `POST /pnms/export/pptx` with an added filter shape: `{ bid_list_id: str, bucket: "bid" }`. No new slideshow code needed beyond a SQL filter in `PNMService.list_for_export`.

**Conflict semantics:**
- `update_entry` / `finalize` return **409** if caller doesn't hold an active lock.
- `acquire_lock` returns **409** with the current holder's user id + `locked_at` if another non-stale lock exists.

**New dependency:** `reportlab>=4.0` in `python_server/requirements.txt`. PDF builder uses ReportLab's platypus flow (title, three bucket sections, table rows with photo+name).

## 6. Frontend

**Route:** `frontend/app/(dashboard)/bid-list/page.tsx` — wrapped in admin/exec guard (extend existing `<AdminProtected>` to accept `roles={["admin", "exec"]}`).

**Drag-drop:** `@dnd-kit/core` + `@dnd-kit/sortable` (~12kb, SSR-safe). Add to `package.json`.

**Layout:**

```
Rush 2026 · seeded from Round 3 · 24 / 25 bids        [Export ▾] [Finalize]
Currently being edited by you (lock expires in 9:42)

┌─ CUT (8) ────────┬─ MAYBE (12) ───────────────┬─ BID (24/25) ──────────┐
│ [card] [card]    │ [card] [card] [card]       │ [card] [card] [card]   │
│ ...              │ ...                        │ ...                    │
└──────────────────┴────────────────────────────┴────────────────────────┘
```

- **PNM card:** photo (avatar fallback), name, year·major, vote summary (👍 12 👎 1 ⭐ 3). Click → slide-over with full dossier (reuse the existing PNM detail panel where possible).
- **Bid count chip:** `text-success` when ≤ cap, `text-danger` when >. No cap → no denominator.
- **Lock banner:**
  - You hold it: "Currently being edited by you" + countdown to expiry.
  - Someone else: "Currently being edited by Marcus (locked 2 min ago) — View only" + "Take over" button (disabled until 10 min stale).
  - No one: auto-acquire on mount.
- **Heartbeat:** `useInterval(refreshLock, 60_000)`; release on `beforeunload`.
- **Export menu:** three items. Each calls the corresponding endpoint and triggers download via the existing `triggerBlobDownload` helper from Phase C.
- **Entry points:**
  1. `/voting` shows "Build bid list" CTA when the most recent round is `completed`.
  2. New nav link "Bid list" in the admin section of the top bar.

**State:** React-query for the list payload (`useBidList`), optimistic mutation for entry drags with rollback on 409.

## 7. Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| No completed round | Empty state with link to `/voting` |
| Lock race | First admin wins; second sees read-only banner |
| Lock holder disappears | Stale after 10 min; "Take over" enables |
| Drag fails (409) | Optimistic update rolls back; toast: "Couldn't move PNM — someone else is editing"; refetch |
| Bid cap exceeded | Counter turns red; finalize still allowed |
| Cap not set | Counter shows raw count, no warning state |
| PNM archived mid-build | Entry remains; rendered with faded "archived" badge |
| Finalize then keep editing | Allowed; `finalized_at` bumps on re-finalize |
| PPTX export of empty Bid bucket | Existing endpoint already returns 400 "No PNMs match"; surface that message |

## 8. Testing

**Backend** (pytest, mock-based per project convention — no live DB fixtures in this repo):

- `create_from_round` seeds every selected PNM into `bucket='maybe'` ordered by score
- Lock acquire / refresh / release; stale-lock takeover after 10 min
- `update_entry` returns 409 when caller doesn't hold lock
- `finalize` stamps `finalized_at`; repeat call updates it
- CSV export shape: header row + one row per entry, grouped by bucket
- PDF export returns non-empty bytes whose first 5 bytes are `b"%PDF-"`
- Route-level: 403 for members, 200 for admin/exec, 409 on lock conflict

**Frontend** (vitest):

- Position-recalc helper: inserting at index N produces a `position` value strictly between neighbors (or +1024 at end) — chosen scheme avoids constant renumbering
- Bid-count warning state crosses the cap threshold (≤ cap → success token, > cap → danger token)

Manual smoke covers end-to-end (drag, export, lock takeover).

## 9. Open Items / Deferred

- Real-time collaborative editing (websocket bid-list channel).
- Multiple concurrent bid lists per chapter (e.g., A-list vs B-list for tiered bids).
- Ranked priority within the Bid bucket for bid-extension order.
- Email/SMS to PNMs in the Bid bucket directly from the page (depends on the comms feature in the backlog).

## 10. Out-of-Scope

- Replacing the existing voting round workflow.
- Member-facing visibility into the bid list.
- Auditing / changelog of who moved which PNM when (could be added later via a `bid_list_events` table).
