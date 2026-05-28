# Bid-List Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/exec-only `/bid-list` page that turns a completed voting round into a Cut/Maybe/Bid drag-drop board with bid-cap warnings, single-editor lock, and PDF/CSV/PPTX exports.

**Architecture:** New `bid_lists` and `bid_list_entries` tables seeded from a completed `voting_round`. Backend lives in a new `python_server/bid_list.py` module (keeps `services.py` from growing further). Frontend route `/bid-list` uses `@dnd-kit` for drag-drop with optimistic mutations against a `PATCH /entries/{pnm_id}` endpoint. A 10-minute server-side lock prevents two admins editing simultaneously. PPTX export reuses the existing `/pnms/export/pptx` route with a new `{bid_list_id, bucket}` filter.

**Tech Stack:** FastAPI, asyncpg (via existing `get_db()` helper), Postgres, ReportLab (PDF), Next 14 App Router, `@dnd-kit/core` + `@dnd-kit/sortable`, react-query.

**Spec:** `docs/superpowers/specs/2026-05-27-bid-list-builder-design.md`

**Depends on:** Phases A, B, C merged. Reuses `triggerBlobDownload` (Phase C), `useToast` (Phase A), `ChapterAppearanceCard` patterns.

---

## File Structure

**Create:**
- `supabase/migrations/0012_bid_lists.sql` — schema (enum + 2 tables + indexes).
- `python_server/bid_list.py` — `BidListService` + PDF/CSV builders.
- `python_server/tests/test_bid_list.py` — service unit tests (mocks).
- `python_server/tests/test_bid_list_routes.py` — route tests via TestClient + dependency override.
- `frontend/app/(dashboard)/bid-list/page.tsx` — page entry.
- `frontend/components/bid-list/BidListBoard.tsx` — 3-column drag-drop board.
- `frontend/components/bid-list/PnmCard.tsx` — compact card.
- `frontend/components/bid-list/LockBanner.tsx` — lock status header.
- `frontend/components/bid-list/ExportMenu.tsx` — Export ▾ dropdown.
- `frontend/lib/bid-list-positions.ts` — pure helper for computing `position` on drop.
- `frontend/__tests__/bid-list-positions.test.ts` — vitest for the helper.

**Modify:**
- `python_server/routes.py` — add 9 new routes; extend `ExportPptxRequest` to accept `bid_list_id` + `bucket`.
- `python_server/services.py` — extend `PNMService.list_for_export` to accept `bid_list_id` + `bucket` filters.
- `python_server/requirements.txt` — add `reportlab>=4.0`.
- `frontend/lib/api.ts` — add `bidList*` API client + `BidListEntry` / `BidList` types.
- `frontend/lib/queries.ts` — add react-query hooks.
- `frontend/types/api.ts` — add `bidList` query key.
- `frontend/components/AdminProtected.tsx` — accept `roles={["admin","exec"]}` prop (default keeps current admin-only behavior).
- `frontend/components/TopbarWithLeftNav.tsx` — add "Bid list" nav link visible to admin/exec.
- `frontend/app/(dashboard)/voting/page.tsx` — add "Build bid list" CTA when most recent round is `completed`.
- `frontend/package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0012_bid_lists.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0012_bid_lists.sql
CREATE TYPE bid_bucket AS ENUM ('cut', 'maybe', 'bid');

CREATE TABLE IF NOT EXISTS bid_lists (
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

CREATE INDEX IF NOT EXISTS bid_lists_chapter_idx
  ON bid_lists (chapter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bid_list_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_list_id   UUID NOT NULL REFERENCES bid_lists(id) ON DELETE CASCADE,
  pnm_id        UUID NOT NULL REFERENCES pnms(id) ON DELETE CASCADE,
  bucket        bid_bucket NOT NULL DEFAULT 'maybe',
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bid_list_id, pnm_id)
);

CREATE INDEX IF NOT EXISTS bid_list_entries_list_bucket_idx
  ON bid_list_entries (bid_list_id, bucket, position);
```

- [ ] **Step 2: Commit (DB application deferred — credentials stale)**

```bash
git add supabase/migrations/0012_bid_lists.sql
git commit -m "feat(db): bid_lists + bid_list_entries schema"
```

---

## Task 2: Backend — BidListService scaffold + create_from_round (TDD)

**Files:**
- Create: `python_server/bid_list.py`
- Create: `python_server/tests/test_bid_list.py`

- [ ] **Step 1: Write failing test for `create_from_round`**

Create `python_server/tests/test_bid_list.py`:

```python
"""Unit tests for BidListService (mock-based)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from python_server.bid_list import BidListService


def _mock_db(execute_one_seq=None, execute_query_seq=None):
    """Build a mock db whose execute_one and execute_query consume sequences."""
    one_seq = list(execute_one_seq or [])
    q_seq = list(execute_query_seq or [])

    async def fake_execute_one(sql, *args):
        return one_seq.pop(0) if one_seq else None

    async def fake_execute_query(sql, *args):
        return q_seq.pop(0) if q_seq else []

    db = MagicMock()
    db.execute_one = fake_execute_one
    db.execute_query = fake_execute_query
    db.execute_command = AsyncMock(return_value="OK")
    return db


@pytest.mark.asyncio
async def test_create_from_round_seeds_all_pnms_into_maybe():
    """Every PNM in the round's selected_pnm_ids lands in 'maybe', ordered by score."""
    svc = BidListService()
    # selected_pnm_ids row from voting_rounds + vote-summary rows
    seq_one = [
        {"selected_pnm_ids": ["pnm-1", "pnm-2", "pnm-3"]},  # SELECT from voting_rounds
        {"id": "list-1"},  # INSERT chapters bid_lists RETURNING id
    ]
    seq_q = [
        # vote summary join: pnm_id, score (sum of up - down)
        [
            {"pnm_id": "pnm-2", "score": 11},
            {"pnm_id": "pnm-1", "score": 8},
            {"pnm_id": "pnm-3", "score": 4},
        ],
    ]
    db = _mock_db(execute_one_seq=seq_one, execute_query_seq=seq_q)
    with patch("python_server.bid_list.get_db", return_value=db):
        result = await svc.create_from_round(
            chapter_id="c-1", source_round_id="r-1",
            name="Rush 2026", bid_cap=25, user_id="u-1",
        )
    assert result["id"] == "list-1"
    assert result["name"] == "Rush 2026"
    assert result["bid_cap"] == 25
    # 3 entry inserts (executemany or per-row)
    assert db.execute_command.await_count >= 3
```

- [ ] **Step 2: Run test, confirm fail (import error)**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: FAIL — `python_server.bid_list` module not found.

- [ ] **Step 3: Create `python_server/bid_list.py` with `BidListService.create_from_round`**

```python
"""Bid-list builder service.

Owns CRUD + locking + exports for the post-rush bid-list workflow.
Kept separate from python_server/services.py to avoid further bloat.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException

from .database import get_db


LOCK_TTL_SECONDS = 600  # 10 minutes
_POS_STEP = 1024        # gap between entries to avoid constant renumbering


class BidListService:
    """All bid-list business logic. Stateless; uses the global db pool."""

    async def create_from_round(
        self,
        chapter_id: str,
        source_round_id: str,
        name: str,
        bid_cap: Optional[int],
        user_id: str,
    ) -> dict:
        """Create a new bid list seeded from a completed voting round.

        Every PNM in the round's selected_pnm_ids is inserted as bucket='maybe',
        positioned by their final score (highest score = position 0).
        """
        db = get_db()
        round_row = await db.execute_one(
            "SELECT selected_pnm_ids FROM voting_rounds WHERE id = $1",
            source_round_id,
        )
        if not round_row:
            raise HTTPException(status_code=404, detail="Source round not found")
        pnm_ids: list[str] = list(round_row["selected_pnm_ids"] or [])
        if not pnm_ids:
            raise HTTPException(status_code=400, detail="Round has no PNMs to seed")

        scored = await db.execute_query(
            """SELECT v.pnm_id,
                      SUM(CASE v.value WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END) AS score
                 FROM votes v
                WHERE v.round_id = $1 AND v.pnm_id = ANY($2::uuid[])
             GROUP BY v.pnm_id""",
            source_round_id, pnm_ids,
        )
        score_map = {str(r["pnm_id"]): int(r["score"] or 0) for r in scored}
        ordered = sorted(pnm_ids, key=lambda pid: -score_map.get(str(pid), 0))

        new_list = await db.execute_one(
            """INSERT INTO bid_lists (chapter_id, source_round_id, name, bid_cap)
               VALUES ($1, $2, $3, $4)
               RETURNING id, chapter_id, source_round_id, name, bid_cap,
                         locked_by, locked_at, finalized_at, created_at, updated_at""",
            chapter_id, source_round_id, name, bid_cap,
        )

        for i, pid in enumerate(ordered):
            await db.execute_command(
                """INSERT INTO bid_list_entries
                     (bid_list_id, pnm_id, bucket, position)
                   VALUES ($1, $2, 'maybe', $3)""",
                new_list["id"], pid, i * _POS_STEP,
            )

        return self._row_to_dict(new_list)

    @staticmethod
    def _row_to_dict(row) -> dict:
        return {
            "id": str(row["id"]),
            "chapter_id": str(row["chapter_id"]),
            "source_round_id": str(row["source_round_id"]) if row["source_round_id"] else None,
            "name": row["name"],
            "bid_cap": row["bid_cap"],
            "locked_by": str(row["locked_by"]) if row["locked_by"] else None,
            "locked_at": row["locked_at"].isoformat() if row["locked_at"] else None,
            "finalized_at": row["finalized_at"].isoformat() if row["finalized_at"] else None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
```

- [ ] **Step 4: Run test, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list.py::test_create_from_round_seeds_all_pnms_into_maybe -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/bid_list.py python_server/tests/test_bid_list.py
git commit -m "feat(api): BidListService.create_from_round seeds PNMs by score"
```

---

## Task 3: Backend — get_active + get_with_entries (TDD)

**Files:**
- Modify: `python_server/bid_list.py`
- Modify: `python_server/tests/test_bid_list.py`

- [ ] **Step 1: Add failing tests**

Append to `python_server/tests/test_bid_list.py`:

```python
@pytest.mark.asyncio
async def test_get_active_returns_most_recent_non_finalized():
    svc = BidListService()
    db = _mock_db(execute_one_seq=[{
        "id": "list-A", "chapter_id": "c-1", "source_round_id": "r-1",
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": None, "updated_at": None,
    }])
    with patch("python_server.bid_list.get_db", return_value=db):
        result = await svc.get_active("c-1")
    assert result["id"] == "list-A"


@pytest.mark.asyncio
async def test_get_active_returns_none_when_no_list():
    svc = BidListService()
    db = _mock_db(execute_one_seq=[None])
    with patch("python_server.bid_list.get_db", return_value=db):
        assert await svc.get_active("c-1") is None


@pytest.mark.asyncio
async def test_get_with_entries_groups_by_bucket():
    svc = BidListService()
    seq_one = [{
        "id": "list-A", "chapter_id": "c-1", "source_round_id": "r-1",
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": None, "updated_at": None,
    }]
    seq_q = [[
        {"pnm_id": "p-1", "bucket": "bid",   "position": 0,
         "name": "A", "year": "Fr", "major": "CS", "photo_url": None,
         "up_count": 10, "down_count": 0, "star_count": 1},
        {"pnm_id": "p-2", "bucket": "maybe", "position": 0,
         "name": "B", "year": "So", "major": "ME", "photo_url": None,
         "up_count": 5, "down_count": 2, "star_count": 0},
    ]]
    db = _mock_db(execute_one_seq=seq_one, execute_query_seq=seq_q)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.get_with_entries("list-A")
    assert out["bid_list"]["id"] == "list-A"
    assert len(out["entries"]) == 2
    assert out["entries"][0]["bucket"] == "bid"
```

- [ ] **Step 2: Run, confirm fail (3 failures, missing methods)**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 3 new FAILs.

- [ ] **Step 3: Implement**

Append to `python_server/bid_list.py` inside `class BidListService`:

```python
    async def get_active(self, chapter_id: str) -> Optional[dict]:
        """Most recent bid list for the chapter, regardless of finalized state."""
        db = get_db()
        row = await db.execute_one(
            """SELECT id, chapter_id, source_round_id, name, bid_cap,
                      locked_by, locked_at, finalized_at, created_at, updated_at
                 FROM bid_lists
                WHERE chapter_id = $1
             ORDER BY created_at DESC
                LIMIT 1""",
            chapter_id,
        )
        return self._row_to_dict(row) if row else None

    async def get_with_entries(self, bid_list_id: str) -> dict:
        """Return the bid list + all entries (with PNM info + vote summary)."""
        db = get_db()
        row = await db.execute_one(
            """SELECT id, chapter_id, source_round_id, name, bid_cap,
                      locked_by, locked_at, finalized_at, created_at, updated_at
                 FROM bid_lists WHERE id = $1""",
            bid_list_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Bid list not found")

        rows = await db.execute_query(
            """SELECT e.pnm_id, e.bucket::text AS bucket, e.position,
                      p.name, p.year, p.major, p.photo_url,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.value = 'up')   AS up_count,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.value = 'down') AS down_count,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.value = 'star') AS star_count
                 FROM bid_list_entries e
                 JOIN pnms p ON p.id = e.pnm_id
                WHERE e.bid_list_id = $1
             ORDER BY e.bucket, e.position""",
            bid_list_id,
        )
        entries = [
            {
                "pnm_id": str(r["pnm_id"]),
                "bucket": r["bucket"],
                "position": int(r["position"]),
                "name": r["name"],
                "year": r.get("year") or "",
                "major": r.get("major") or "",
                "photo_url": r.get("photo_url"),
                "vote_summary": {
                    "up": int(r.get("up_count") or 0),
                    "down": int(r.get("down_count") or 0),
                    "star": int(r.get("star_count") or 0),
                },
            }
            for r in rows
        ]
        return {"bid_list": self._row_to_dict(row), "entries": entries}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/bid_list.py python_server/tests/test_bid_list.py
git commit -m "feat(api): BidListService get_active + get_with_entries"
```

---

## Task 4: Backend — lock semantics (TDD)

**Files:**
- Modify: `python_server/bid_list.py`
- Modify: `python_server/tests/test_bid_list.py`

- [ ] **Step 1: Add failing tests**

Append to `python_server/tests/test_bid_list.py`:

```python
from datetime import datetime, timezone, timedelta

@pytest.mark.asyncio
async def test_acquire_lock_succeeds_when_unlocked():
    svc = BidListService()
    seq_one = [
        {"locked_by": None, "locked_at": None},                # current lock state
        {"locked_by": "u-1", "locked_at": datetime.now(timezone.utc)},  # after UPDATE
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.acquire_lock("list-A", "u-1")
    assert out["locked_by"] == "u-1"


@pytest.mark.asyncio
async def test_acquire_lock_409_when_held_by_other_recently():
    svc = BidListService()
    recent = datetime.now(timezone.utc) - timedelta(seconds=10)
    db = _mock_db(execute_one_seq=[{"locked_by": "u-2", "locked_at": recent}])
    with patch("python_server.bid_list.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.acquire_lock("list-A", "u-1")
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_acquire_lock_takeover_when_stale():
    svc = BidListService()
    stale = datetime.now(timezone.utc) - timedelta(seconds=601)
    seq_one = [
        {"locked_by": "u-2", "locked_at": stale},
        {"locked_by": "u-1", "locked_at": datetime.now(timezone.utc)},
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.acquire_lock("list-A", "u-1")
    assert out["locked_by"] == "u-1"


@pytest.mark.asyncio
async def test_refresh_lock_requires_caller_holds_it():
    svc = BidListService()
    db = _mock_db(execute_one_seq=[{"locked_by": "u-2", "locked_at": datetime.now(timezone.utc)}])
    with patch("python_server.bid_list.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.refresh_lock("list-A", "u-1")
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_release_lock_clears_fields():
    svc = BidListService()
    db = _mock_db(execute_one_seq=[{"locked_by": "u-1", "locked_at": datetime.now(timezone.utc)}])
    with patch("python_server.bid_list.get_db", return_value=db):
        await svc.release_lock("list-A", "u-1")
    db.execute_command.assert_awaited()
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 5 new FAILs.

- [ ] **Step 3: Implement lock methods**

Append to `python_server/bid_list.py` inside `class BidListService`:

```python
    async def acquire_lock(self, bid_list_id: str, user_id: str) -> dict:
        """Acquire the editor lock, taking over a stale (>10min old) lock if needed."""
        db = get_db()
        current = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not current:
            raise HTTPException(status_code=404, detail="Bid list not found")
        held_by = current["locked_by"]
        held_at = current["locked_at"]
        if held_by and str(held_by) != str(user_id) and held_at is not None:
            age = (datetime.now(timezone.utc) - held_at).total_seconds()
            if age < LOCK_TTL_SECONDS:
                raise HTTPException(
                    status_code=409,
                    detail={"reason": "locked", "locked_by": str(held_by),
                            "locked_at": held_at.isoformat()},
                )
        updated = await db.execute_one(
            """UPDATE bid_lists
                  SET locked_by = $1, locked_at = NOW(), updated_at = NOW()
                WHERE id = $2
            RETURNING locked_by, locked_at""",
            user_id, bid_list_id,
        )
        return {
            "locked_by": str(updated["locked_by"]),
            "locked_at": updated["locked_at"].isoformat(),
        }

    async def refresh_lock(self, bid_list_id: str, user_id: str) -> dict:
        db = get_db()
        current = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not current or str(current["locked_by"] or "") != str(user_id):
            raise HTTPException(status_code=409, detail="You do not hold the lock")
        await db.execute_command(
            "UPDATE bid_lists SET locked_at = NOW(), updated_at = NOW() WHERE id = $1",
            bid_list_id,
        )
        return {"locked_by": str(user_id), "locked_at": datetime.now(timezone.utc).isoformat()}

    async def release_lock(self, bid_list_id: str, user_id: str) -> None:
        db = get_db()
        await db.execute_command(
            """UPDATE bid_lists
                  SET locked_by = NULL, locked_at = NULL, updated_at = NOW()
                WHERE id = $1 AND locked_by = $2""",
            bid_list_id, user_id,
        )

    async def _require_lock(self, bid_list_id: str, user_id: str) -> None:
        db = get_db()
        row = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not row or str(row["locked_by"] or "") != str(user_id):
            raise HTTPException(status_code=409, detail="You must hold the lock to edit")
        if row["locked_at"] is not None:
            age = (datetime.now(timezone.utc) - row["locked_at"]).total_seconds()
            if age >= LOCK_TTL_SECONDS:
                raise HTTPException(status_code=409, detail="Your lock has expired")
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/bid_list.py python_server/tests/test_bid_list.py
git commit -m "feat(api): BidListService 10-min editor lock with takeover"
```

---

## Task 5: Backend — update_entry + finalize (TDD)

**Files:**
- Modify: `python_server/bid_list.py`
- Modify: `python_server/tests/test_bid_list.py`

- [ ] **Step 1: Add failing tests**

Append:

```python
@pytest.mark.asyncio
async def test_update_entry_requires_lock():
    svc = BidListService()
    db = _mock_db(execute_one_seq=[{"locked_by": "u-2", "locked_at": datetime.now(timezone.utc)}])
    with patch("python_server.bid_list.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.update_entry("list-A", "p-1", "bid", 0, "u-1")
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_update_entry_persists_bucket_and_position():
    svc = BidListService()
    seq_one = [
        {"locked_by": "u-1", "locked_at": datetime.now(timezone.utc)},  # _require_lock
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        await svc.update_entry("list-A", "p-1", "bid", 2048, "u-1")
    # one UPDATE on bid_list_entries
    db.execute_command.assert_awaited()


@pytest.mark.asyncio
async def test_finalize_stamps_finalized_at():
    svc = BidListService()
    seq_one = [
        {"locked_by": "u-1", "locked_at": datetime.now(timezone.utc)},
        {"finalized_at": datetime.now(timezone.utc)},
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.finalize("list-A", "u-1")
    assert out["finalized_at"] is not None
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 3 new FAILs.

- [ ] **Step 3: Implement**

Append to `BidListService`:

```python
    async def update_entry(
        self,
        bid_list_id: str,
        pnm_id: str,
        bucket: str,
        position: int,
        user_id: str,
    ) -> dict:
        if bucket not in ("cut", "maybe", "bid"):
            raise HTTPException(status_code=400, detail=f"Invalid bucket: {bucket}")
        await self._require_lock(bid_list_id, user_id)
        db = get_db()
        await db.execute_command(
            """UPDATE bid_list_entries
                  SET bucket = $1::bid_bucket, position = $2, updated_at = NOW()
                WHERE bid_list_id = $3 AND pnm_id = $4""",
            bucket, position, bid_list_id, pnm_id,
        )
        return {"pnm_id": pnm_id, "bucket": bucket, "position": position}

    async def finalize(self, bid_list_id: str, user_id: str) -> dict:
        await self._require_lock(bid_list_id, user_id)
        db = get_db()
        row = await db.execute_one(
            """UPDATE bid_lists
                  SET finalized_at = NOW(), updated_at = NOW()
                WHERE id = $1
            RETURNING finalized_at""",
            bid_list_id,
        )
        return {"finalized_at": row["finalized_at"].isoformat()}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 12 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/bid_list.py python_server/tests/test_bid_list.py
git commit -m "feat(api): BidListService update_entry + finalize"
```

---

## Task 6: Backend — CSV + PDF export (TDD)

**Files:**
- Modify: `python_server/requirements.txt`
- Modify: `python_server/bid_list.py`
- Modify: `python_server/tests/test_bid_list.py`

- [ ] **Step 1: Add reportlab dep**

Append to `python_server/requirements.txt`:
```
reportlab>=4.0
```
Install: `pip install -r python_server/requirements.txt`.

Sanity import: `python -c "from reportlab.lib.pagesizes import LETTER; print('ok')"` → `ok`.

- [ ] **Step 2: Add failing tests**

Append to `python_server/tests/test_bid_list.py`:

```python
@pytest.mark.asyncio
async def test_export_csv_groups_by_bucket_and_includes_header():
    svc = BidListService()
    list_row = {
        "id": "list-A", "chapter_id": "c-1", "source_round_id": None,
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": None, "updated_at": None,
    }
    entries = [
        {"pnm_id": "p-1", "bucket": "bid",   "position": 0,
         "name": "Alice", "year": "Fr", "major": "CS", "photo_url": None,
         "up_count": 10, "down_count": 0, "star_count": 1},
        {"pnm_id": "p-2", "bucket": "maybe", "position": 0,
         "name": "Bob", "year": "So", "major": "ME", "photo_url": None,
         "up_count": 5, "down_count": 2, "star_count": 0},
        {"pnm_id": "p-3", "bucket": "cut",   "position": 0,
         "name": "Cara", "year": "Fr", "major": "EE", "photo_url": None,
         "up_count": 1, "down_count": 8, "star_count": 0},
    ]
    db = _mock_db(execute_one_seq=[list_row], execute_query_seq=[entries])
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.export_csv("list-A")
    lines = out.strip().split("\n")
    assert lines[0] == "bucket,name,year,major,up,down,star"
    assert any("bid,Alice" in l for l in lines)
    assert any("maybe,Bob" in l for l in lines)
    assert any("cut,Cara" in l for l in lines)


@pytest.mark.asyncio
async def test_export_pdf_returns_pdf_bytes():
    svc = BidListService()
    list_row = {
        "id": "list-A", "chapter_id": "c-1", "source_round_id": None,
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": None, "updated_at": None,
    }
    entries = [
        {"pnm_id": "p-1", "bucket": "bid", "position": 0,
         "name": "Alice", "year": "Fr", "major": "CS", "photo_url": None,
         "up_count": 10, "down_count": 0, "star_count": 1},
    ]
    db = _mock_db(execute_one_seq=[list_row], execute_query_seq=[entries])
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.export_pdf("list-A")
    assert isinstance(out, bytes)
    assert out[:5] == b"%PDF-"
```

- [ ] **Step 3: Run, confirm fail**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 2 new FAILs.

- [ ] **Step 4: Implement exports**

Append to `python_server/bid_list.py` (top-level imports):

```python
import csv
import io
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
```

And append to `class BidListService`:

```python
    _BUCKET_ORDER = ("bid", "maybe", "cut")
    _BUCKET_LABEL = {"bid": "Bid", "maybe": "Maybe", "cut": "Cut"}

    async def export_csv(self, bid_list_id: str) -> str:
        data = await self.get_with_entries(bid_list_id)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["bucket", "name", "year", "major", "up", "down", "star"])
        for bucket in self._BUCKET_ORDER:
            for e in data["entries"]:
                if e["bucket"] != bucket:
                    continue
                w.writerow([
                    e["bucket"], e["name"], e["year"], e["major"],
                    e["vote_summary"]["up"], e["vote_summary"]["down"], e["vote_summary"]["star"],
                ])
        return buf.getvalue()

    async def export_pdf(self, bid_list_id: str) -> bytes:
        data = await self.get_with_entries(bid_list_id)
        bid_list = data["bid_list"]
        entries = data["entries"]

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=LETTER,
                                topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                                leftMargin=0.6 * inch, rightMargin=0.6 * inch)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22, leading=26)
        header_style = ParagraphStyle("header", parent=styles["Heading2"], fontSize=14, spaceAfter=6)
        flow = []
        flow.append(Paragraph(bid_list["name"], title_style))
        meta = f"Bid cap: {bid_list['bid_cap'] or '—'}"
        if bid_list.get("finalized_at"):
            meta += f" · Finalized {bid_list['finalized_at'][:10]}"
        flow.append(Paragraph(meta, styles["Normal"]))
        flow.append(Spacer(1, 0.25 * inch))

        for bucket in self._BUCKET_ORDER:
            rows = [e for e in entries if e["bucket"] == bucket]
            if not rows:
                continue
            flow.append(Paragraph(f"{self._BUCKET_LABEL[bucket]} ({len(rows)})", header_style))
            tbl_data = [["Name", "Year", "Major", "Vote"]]
            for e in rows:
                v = e["vote_summary"]
                tbl_data.append([
                    e["name"], e["year"] or "", e["major"] or "",
                    f"👍 {v['up']}  👎 {v['down']}  ⭐ {v['star']}",
                ])
            tbl = Table(tbl_data, colWidths=[2.4 * inch, 0.9 * inch, 1.9 * inch, 1.8 * inch])
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F4F0E4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0A0A0A")),
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
                ("FONT", (0, 1), (-1, -1), "Helvetica", 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                    [colors.white, colors.HexColor("#FBF9F2")]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E8E3D6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E8E3D6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            flow.append(tbl)
            flow.append(Spacer(1, 0.2 * inch))

        doc.build(flow)
        return buf.getvalue()
```

- [ ] **Step 5: Run, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list.py -v`
Expected: 14 PASS.

- [ ] **Step 6: Commit**

```bash
git add python_server/bid_list.py python_server/tests/test_bid_list.py python_server/requirements.txt
git commit -m "feat(export): bid-list CSV + PDF generation"
```

---

## Task 7: Backend — extend list_for_export for bid-list filtering

**Files:**
- Modify: `python_server/services.py`

- [ ] **Step 1: Extend the existing `PNMService.list_for_export`**

Find `list_for_export` (added in Phase C). Replace its body with a version that accepts an optional `bid_list_id` + `bucket` filter. Locate the existing function signature; replace exactly:

```python
async def list_for_export(
    self,
    chapter_id: str,
    *,
    filters: dict,
    sort: Optional[str] = None,
) -> list[dict]:
    """Fetch PNMs for slideshow export. Supports optional bid-list filter."""
    db = get_db()
    bid_list_id = filters.get("bid_list_id")
    bid_bucket = filters.get("bucket")

    if bid_list_id:
        base = """
          SELECT
            p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
            COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'up')   AS up_count,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'down') AS down_count,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'star') AS star_count,
            (SELECT n.body FROM notes n WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_body,
            (SELECT u.display_name FROM notes n LEFT JOIN users u ON u.id = n.author_id
               WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_author
          FROM bid_list_entries e
          JOIN pnms p ON p.id = e.pnm_id
          WHERE e.bid_list_id = $1 AND p.chapter_id = $2
            AND COALESCE(p.archived, false) = false
        """
        args: list = [bid_list_id, chapter_id]
        if bid_bucket in ("bid", "maybe", "cut"):
            args.append(bid_bucket)
            base += f" AND e.bucket = ${len(args)}::bid_bucket"
        base += " ORDER BY e.position"
    else:
        base = """
          SELECT
            p.id, p.name, p.major, p.hometown, p.year, p.photo_url,
            COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'up')   AS up_count,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'down') AS down_count,
            (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'star') AS star_count,
            (SELECT n.body FROM notes n WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_body,
            (SELECT u.display_name FROM notes n LEFT JOIN users u ON u.id = n.author_id
               WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_author
          FROM pnms p
          WHERE p.chapter_id = $1 AND COALESCE(p.archived, false) = false
        """
        args = [chapter_id]
        if filters.get("search"):
            args.append(f"%{filters['search'].lower()}%")
            base += f" AND lower(p.name) LIKE ${len(args)}"
        order = "p.name"
        if sort == "created":
            order = "p.created_at DESC"
        base += f" ORDER BY {order}"

    rows = await db.execute_query(base, *args)
    result = []
    for r in rows:
        latest_note = None
        if r.get("latest_note_body"):
            latest_note = {
                "author": r.get("latest_note_author") or "",
                "text": r["latest_note_body"],
            }
        result.append({
            "id": str(r["id"]),
            "name": r["name"],
            "year": r.get("year") or "",
            "major": r.get("major") or "",
            "hometown": r.get("hometown") or "",
            "photo_url": r.get("photo_url"),
            "tags": list(r.get("tags") or []),
            "status": "active",
            "vote_summary": {
                "up": int(r.get("up_count") or 0),
                "down": int(r.get("down_count") or 0),
                "star": int(r.get("star_count") or 0),
            },
            "latest_note": latest_note,
            "gpa": None,
        })
    return result
```

- [ ] **Step 2: Run existing tests, confirm nothing regressed**

Run: `cd python_server && pytest tests/test_export_route.py tests/test_bid_list.py -v`
Expected: all PASS (route tests don't exercise the new filter; bid-list tests don't touch this function).

- [ ] **Step 3: Commit**

```bash
git add python_server/services.py
git commit -m "feat(export): list_for_export accepts bid_list_id + bucket filter"
```

---

## Task 8: Backend — routes + route tests (TDD)

**Files:**
- Create: `python_server/tests/test_bid_list_routes.py`
- Modify: `python_server/routes.py`

- [ ] **Step 1: Write failing route tests**

Create `python_server/tests/test_bid_list_routes.py`:

```python
"""Route tests for /chapters/me/bid-list (TestClient + dependency override)."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from python_server.main import app
from python_server.auth import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


def _override(user_id="u-1"):
    async def fake(): return {"user_id": user_id, "email": "x@x.com"}
    app.dependency_overrides[get_current_user] = fake


def _clear():
    app.dependency_overrides.clear()


def test_get_bid_list_404_when_none(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value=None)):
            r = client.get("/api/v1/chapters/me/bid-list")
            assert r.status_code == 404
    finally:
        _clear()


def test_get_bid_list_returns_list_with_entries(client):
    _override("u-1")
    fake = {
        "bid_list": {"id": "list-A", "name": "Rush", "bid_cap": 25,
                      "locked_by": None, "locked_at": None, "finalized_at": None,
                      "chapter_id": "c-1", "source_round_id": None,
                      "created_at": None, "updated_at": None},
        "entries": [],
    }
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value=fake["bid_list"])), \
             patch("python_server.routes.bid_list_service.get_with_entries", new=AsyncMock(return_value=fake)):
            r = client.get("/api/v1/chapters/me/bid-list")
            assert r.status_code == 200
            assert r.json()["bid_list"]["id"] == "list-A"
    finally:
        _clear()


def test_create_bid_list_admin_only(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="member")):
            r = client.post("/api/v1/chapters/me/bid-list",
                            json={"source_round_id": "r-1", "name": "Rush", "bid_cap": 25})
            assert r.status_code == 403
    finally:
        _clear()


def test_patch_entry_returns_409_when_lock_not_held(client):
    _override("u-1")
    from fastapi import HTTPException
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.update_entry",
                   new=AsyncMock(side_effect=HTTPException(status_code=409, detail="You must hold the lock"))):
            r = client.patch("/api/v1/chapters/me/bid-list/entries/p-1",
                              json={"bucket": "bid", "position": 0})
            assert r.status_code == 409
    finally:
        _clear()


def test_export_csv_returns_text(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active",
                   new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.export_csv",
                   new=AsyncMock(return_value="bucket,name\nbid,Alice\n")):
            r = client.get("/api/v1/chapters/me/bid-list/export/csv")
            assert r.status_code == 200
            assert "bid,Alice" in r.text
            assert "attachment" in r.headers["content-disposition"].lower()
    finally:
        _clear()


def test_export_pdf_returns_pdf(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active",
                   new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.export_pdf",
                   new=AsyncMock(return_value=b"%PDF-1.4\nfake")):
            r = client.get("/api/v1/chapters/me/bid-list/export/pdf")
            assert r.status_code == 200
            assert r.content[:5] == b"%PDF-"
    finally:
        _clear()
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_bid_list_routes.py -v`
Expected: all FAIL (routes not registered).

- [ ] **Step 3: Register routes in `python_server/routes.py`**

At the top of `routes.py`, alongside existing imports:

```python
from fastapi.responses import PlainTextResponse, StreamingResponse
from python_server.bid_list import BidListService

bid_list_service = BidListService()
```

Add `BaseModel` schemas near the other Pydantic schemas (do not duplicate `BaseModel`/`Field`/`Optional` imports if already present):

```python
class CreateBidListRequest(BaseModel):
    source_round_id: str
    name: str
    bid_cap: Optional[int] = None

class UpdateEntryRequest(BaseModel):
    bucket: str
    position: int
```

Then add the 9 routes (place near other `/chapters/me/...` routes):

```python
async def _require_admin_or_exec(current_user: dict) -> tuple[str, str]:
    """Return (chapter_id, role). Raises 403 if not admin/exec."""
    chapter_id = await chapter_service.get_user_chapter_id(current_user["user_id"])
    role = await chapter_service.get_user_role(chapter_id, current_user["user_id"])
    if role not in ("admin", "exec"):
        raise HTTPException(status_code=403, detail="Admin or exec role required")
    return chapter_id, role


@router.get("/chapters/me/bid-list")
async def get_my_bid_list(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    return await bid_list_service.get_with_entries(active["id"])


@router.post("/chapters/me/bid-list")
async def create_my_bid_list(
    req: CreateBidListRequest,
    current_user: dict = Depends(get_current_user),
):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    return await bid_list_service.create_from_round(
        chapter_id=chapter_id,
        source_round_id=req.source_round_id,
        name=req.name,
        bid_cap=req.bid_cap,
        user_id=current_user["user_id"],
    )


@router.post("/chapters/me/bid-list/lock")
async def acquire_my_bid_list_lock(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    return await bid_list_service.acquire_lock(active["id"], current_user["user_id"])


@router.post("/chapters/me/bid-list/lock/refresh")
async def refresh_my_bid_list_lock(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    return await bid_list_service.refresh_lock(active["id"], current_user["user_id"])


@router.delete("/chapters/me/bid-list/lock")
async def release_my_bid_list_lock(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        return {"ok": True}
    await bid_list_service.release_lock(active["id"], current_user["user_id"])
    return {"ok": True}


@router.patch("/chapters/me/bid-list/entries/{pnm_id}")
async def patch_my_bid_list_entry(
    pnm_id: str,
    req: UpdateEntryRequest,
    current_user: dict = Depends(get_current_user),
):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    return await bid_list_service.update_entry(
        active["id"], pnm_id, req.bucket, req.position, current_user["user_id"],
    )


@router.post("/chapters/me/bid-list/finalize")
async def finalize_my_bid_list(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    return await bid_list_service.finalize(active["id"], current_user["user_id"])


@router.get("/chapters/me/bid-list/export/csv")
async def export_my_bid_list_csv(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    csv_text = await bid_list_service.export_csv(active["id"])
    return PlainTextResponse(
        csv_text, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="bid-list.csv"'},
    )


@router.get("/chapters/me/bid-list/export/pdf")
async def export_my_bid_list_pdf(current_user: dict = Depends(get_current_user)):
    chapter_id, _ = await _require_admin_or_exec(current_user)
    active = await bid_list_service.get_active(chapter_id)
    if not active:
        raise HTTPException(status_code=404, detail="No bid list yet")
    pdf_bytes = await bid_list_service.export_pdf(active["id"])
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="bid-list.pdf"'},
    )
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_bid_list_routes.py -v`
Expected: 6 PASS.

Then full suite: `pytest -q`. Expected: all pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add python_server/routes.py python_server/tests/test_bid_list_routes.py
git commit -m "feat(api): /chapters/me/bid-list routes (CRUD + lock + exports)"
```

---

## Task 9: Frontend — install @dnd-kit + types

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dnd-kit**

Run: `cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers`

- [ ] **Step 2: Verify**

Run: `grep -E '"@dnd-kit/(core|sortable|modifiers)"' frontend/package.json` — three lines expected.

Also: `cd frontend && npm run typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(deps): add @dnd-kit for bid-list drag-drop"
```

---

## Task 10: Frontend — position helper (TDD)

**Files:**
- Create: `frontend/lib/bid-list-positions.ts`
- Create: `frontend/__tests__/bid-list-positions.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/__tests__/bid-list-positions.test.ts
import { describe, it, expect } from "vitest";
import { computeDropPosition } from "@/lib/bid-list-positions";

describe("computeDropPosition", () => {
  it("returns 0 when dropping into an empty bucket", () => {
    expect(computeDropPosition([], 0)).toBe(0);
  });

  it("returns prev + 1024 when dropping at end", () => {
    expect(computeDropPosition([0, 1024, 2048], 3)).toBe(3072);
  });

  it("returns half-way between neighbors when inserting in middle", () => {
    expect(computeDropPosition([0, 1024, 2048], 1)).toBe(512);
    expect(computeDropPosition([0, 1024, 2048], 2)).toBe(1536);
  });

  it("returns first - 1024 when inserting at index 0 with existing entries", () => {
    expect(computeDropPosition([100, 200, 300], 0)).toBe(-924);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd frontend && npm test -- bid-list-positions`
Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/lib/bid-list-positions.ts
/**
 * Compute the integer `position` value to PATCH for a drag-drop into a bucket.
 *
 * The bucket is represented as a sorted array of existing positions (ascending).
 * `targetIndex` is the destination slot, 0..bucket.length inclusive.
 *
 * Positions are spaced with a step of 1024 to avoid constant renumbering.
 * When inserted between neighbors we pick the midpoint; when inserted at the
 * extremes we offset by 1024.
 */
const STEP = 1024;

export function computeDropPosition(bucket: number[], targetIndex: number): number {
  if (bucket.length === 0) return 0;
  if (targetIndex <= 0) return bucket[0] - STEP;
  if (targetIndex >= bucket.length) return bucket[bucket.length - 1] + STEP;
  const before = bucket[targetIndex - 1];
  const after = bucket[targetIndex];
  return Math.floor((before + after) / 2);
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd frontend && npm test -- bid-list-positions`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/bid-list-positions.ts frontend/__tests__/bid-list-positions.test.ts
git commit -m "feat(ui): position helper for bid-list drag-drop"
```

---

## Task 11: Frontend — API client + react-query hooks

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/types/api.ts`
- Modify: `frontend/lib/queries.ts`

- [ ] **Step 1: Add types + API client to `frontend/lib/api.ts`**

Append (after existing `exportPnmsPptx`):

```ts
// ── Bid list ─────────────────────────────────────────────────
export interface BidListEntry {
  pnm_id: string;
  bucket: "cut" | "maybe" | "bid";
  position: number;
  name: string;
  year: string;
  major: string;
  photo_url: string | null;
  vote_summary: { up: number; down: number; star: number };
}

export interface BidList {
  id: string;
  chapter_id: string;
  source_round_id: string | null;
  name: string;
  bid_cap: number | null;
  locked_by: string | null;
  locked_at: string | null;
  finalized_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BidListPayload {
  bid_list: BidList;
  entries: BidListEntry[];
}

export async function getBidList(): Promise<BidListPayload> {
  return api<BidListPayload>("/chapters/me/bid-list");
}

export async function createBidList(
  source_round_id: string,
  name: string,
  bid_cap: number | null,
): Promise<BidList> {
  return api<BidList>("/chapters/me/bid-list", {
    method: "POST",
    body: { source_round_id, name, bid_cap },
  });
}

export async function acquireBidListLock(): Promise<{ locked_by: string; locked_at: string }> {
  return api("/chapters/me/bid-list/lock", { method: "POST" });
}

export async function refreshBidListLock(): Promise<{ locked_by: string; locked_at: string }> {
  return api("/chapters/me/bid-list/lock/refresh", { method: "POST" });
}

export async function releaseBidListLock(): Promise<{ ok: boolean }> {
  return api("/chapters/me/bid-list/lock", { method: "DELETE" });
}

export async function patchBidListEntry(
  pnm_id: string,
  bucket: "cut" | "maybe" | "bid",
  position: number,
): Promise<BidListEntry> {
  return api(`/chapters/me/bid-list/entries/${pnm_id}`, {
    method: "PATCH",
    body: { bucket, position },
  });
}

export async function finalizeBidList(): Promise<{ finalized_at: string }> {
  return api("/chapters/me/bid-list/finalize", { method: "POST" });
}

export async function exportBidListCsv(): Promise<{ blob: Blob; filename: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(`${API_BASE}/chapters/me/bid-list/export/csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`CSV export failed (${res.status})`);
  return { blob: await res.blob(), filename: "bid-list.csv" };
}

export async function exportBidListPdf(): Promise<{ blob: Blob; filename: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(`${API_BASE}/chapters/me/bid-list/export/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`PDF export failed (${res.status})`);
  return { blob: await res.blob(), filename: "bid-list.pdf" };
}
```

- [ ] **Step 2: Add query key in `frontend/types/api.ts`**

Inside the `queryKeys = { ... } as const` block, add:
```ts
bidList: ["bid-list"] as const,
```

- [ ] **Step 3: Add hooks in `frontend/lib/queries.ts`**

Append:

```ts
import {
  getBidList,
  patchBidListEntry,
  acquireBidListLock,
  refreshBidListLock,
  releaseBidListLock,
  finalizeBidList,
  type BidListPayload,
  type BidListEntry,
} from "@/lib/api";

export function useBidList() {
  return useQuery({
    queryKey: queryKeys.bidList,
    queryFn: getBidList,
    retry: false,
  });
}

export function usePatchBidListEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pnm_id, bucket, position }: {
      pnm_id: string;
      bucket: "cut" | "maybe" | "bid";
      position: number;
    }) => patchBidListEntry(pnm_id, bucket, position),
    onMutate: async ({ pnm_id, bucket, position }) => {
      await qc.cancelQueries({ queryKey: queryKeys.bidList });
      const prev = qc.getQueryData<BidListPayload>(queryKeys.bidList);
      if (prev) {
        const entries: BidListEntry[] = prev.entries.map((e) =>
          e.pnm_id === pnm_id ? { ...e, bucket, position } : e,
        );
        qc.setQueryData<BidListPayload>(queryKeys.bidList, { ...prev, entries });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.bidList, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.bidList }),
  });
}

export function useAcquireBidListLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acquireBidListLock,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bidList }),
  });
}

export function useReleaseBidListLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: releaseBidListLock,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bidList }),
  });
}

export function useFinalizeBidList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: finalizeBidList,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.bidList }),
  });
}
```

- [ ] **Step 4: Typecheck + test**

Run: `cd frontend && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/types/api.ts frontend/lib/queries.ts
git commit -m "feat(ui): bid-list api client + react-query hooks"
```

---

## Task 12: Frontend — extend AdminProtected to accept roles

**Files:**
- Modify: `frontend/components/AdminProtected.tsx`

- [ ] **Step 1: Update component**

Replace the contents of `frontend/components/AdminProtected.tsx` with:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

/**
 * AdminProtected - Route protection for admin-only (or admin/exec) pages.
 *
 * Default: admin only (preserves existing behavior).
 * Pass roles={["admin","exec"]} to also allow exec.
 */
export default function AdminProtected({
  children,
  roles = ["admin"],
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const norm = roles.map((r) => r.toLowerCase());
    (async () => {
      try {
        const profile = await api<{ memberships: Array<{ role: string }> }>("/me");
        const ok = profile.memberships?.some((m) => norm.includes(m.role.toLowerCase()));
        setAllowed(!!ok);
        if (!ok) {
          toast({ title: "Access Denied", description: `Requires: ${roles.join(" / ")}` });
          router.replace("/");
        }
      } catch (e: any) {
        console.error("Failed to check role:", e);
        toast({ title: "Access Denied", description: "Unable to verify role" });
        router.replace("/");
      } finally {
        setReady(true);
      }
    })();
  }, [router, toast, roles.join(",")]);

  if (!ready) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: PASS. Existing `<AdminProtected>` usages still work (default role list is `["admin"]`).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/AdminProtected.tsx
git commit -m "feat(ui): AdminProtected accepts optional roles array"
```

---

## Task 13: Frontend — PnmCard + LockBanner

**Files:**
- Create: `frontend/components/bid-list/PnmCard.tsx`
- Create: `frontend/components/bid-list/LockBanner.tsx`

- [ ] **Step 1: PnmCard**

```tsx
// frontend/components/bid-list/PnmCard.tsx
"use client";
import type { BidListEntry } from "@/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PnmCard({ entry, dragging = false }: { entry: BidListEntry; dragging?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 shadow-sm transition ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {entry.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.photo_url}
            alt={entry.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <div
            className="grid h-12 w-12 place-items-center rounded-lg font-mono text-sm"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-fg-on-bg)" }}
          >
            {initials(entry.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{entry.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[entry.year, entry.major].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span>👍 {entry.vote_summary.up}</span>
        <span>👎 {entry.vote_summary.down}</span>
        <span>⭐ {entry.vote_summary.star}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: LockBanner**

```tsx
// frontend/components/bid-list/LockBanner.tsx
"use client";
import { useEffect, useState } from "react";

interface Props {
  lockedBy: string | null;
  lockedAt: string | null;
  meId: string;
  onAcquire: () => void;
  acquiring: boolean;
}

const LOCK_TTL_MS = 10 * 60 * 1000;

function isStale(lockedAt: string | null): boolean {
  if (!lockedAt) return true;
  const age = Date.now() - new Date(lockedAt).getTime();
  return age >= LOCK_TTL_MS;
}

export function LockBanner({ lockedBy, lockedAt, meId, onAcquire, acquiring }: Props) {
  const [, force] = useState(0);
  // tick once per minute so the "expires in" countdown updates
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const youHold = lockedBy === meId && !isStale(lockedAt);
  const otherHolds = lockedBy && lockedBy !== meId && !isStale(lockedAt);

  if (youHold && lockedAt) {
    const remainingMs = LOCK_TTL_MS - (Date.now() - new Date(lockedAt).getTime());
    const mins = Math.max(0, Math.floor(remainingMs / 60_000));
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        Currently being edited by you · lock refreshes in {mins} min
      </div>
    );
  }
  if (otherHolds) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <span>Currently being edited by another admin · view only</span>
      </div>
    );
  }
  // No active lock (or stale)
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {lockedBy ? "Previous lock is stale — you can take over." : "No one is editing right now."}
      </span>
      <button
        onClick={onAcquire}
        disabled={acquiring}
        className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
      >
        {acquiring ? "Acquiring…" : "Start editing"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/bid-list/PnmCard.tsx frontend/components/bid-list/LockBanner.tsx
git commit -m "feat(ui): bid-list PnmCard + LockBanner components"
```

---

## Task 14: Frontend — ExportMenu

**Files:**
- Create: `frontend/components/bid-list/ExportMenu.tsx`

- [ ] **Step 1: Build dropdown**

```tsx
// frontend/components/bid-list/ExportMenu.tsx
"use client";
import { useState } from "react";
import {
  exportBidListCsv,
  exportBidListPdf,
  exportPnmsPptx,
  triggerBlobDownload,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export function ExportMenu({ bidListId }: { bidListId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function run(kind: "csv" | "pdf" | "pptx") {
    setBusy(true);
    setOpen(false);
    toast({ title: `Building ${kind.toUpperCase()}…` });
    try {
      let result: { blob: Blob; filename: string };
      if (kind === "csv") result = await exportBidListCsv();
      else if (kind === "pdf") result = await exportBidListPdf();
      else
        result = await exportPnmsPptx({} as any, undefined).then((r) => r); // placeholder
      // PPTX path uses the bid-list filter:
      if (kind === "pptx") {
        // Re-run with the proper filter shape (typed loosely since exportPnmsPptx accepts a dict)
        const filters: any = { bid_list_id: bidListId, bucket: "bid" };
        result = await exportPnmsPptx(filters);
      }
      triggerBlobDownload(result.blob, result.filename);
      toast({ title: "Download ready", description: result.filename });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        {busy ? "Working…" : "Export ▾"}
      </button>
      {open && !busy && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg">
          <button onClick={() => run("pdf")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
            PDF bid sheet
          </button>
          <button onClick={() => run("csv")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
            CSV
          </button>
          <button onClick={() => run("pptx")} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
            PowerPoint (Bid bucket)
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/bid-list/ExportMenu.tsx
git commit -m "feat(ui): bid-list ExportMenu (PDF / CSV / PPTX)"
```

---

## Task 15: Frontend — BidListBoard (drag-drop)

**Files:**
- Create: `frontend/components/bid-list/BidListBoard.tsx`

- [ ] **Step 1: Implement the board**

```tsx
// frontend/components/bid-list/BidListBoard.tsx
"use client";
import { useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BidListEntry } from "@/lib/api";
import { PnmCard } from "./PnmCard";
import { computeDropPosition } from "@/lib/bid-list-positions";

type Bucket = "cut" | "maybe" | "bid";
const BUCKETS: Bucket[] = ["cut", "maybe", "bid"];
const LABEL: Record<Bucket, string> = { cut: "Cut", maybe: "Maybe", bid: "Bid" };

function DraggableCard({ entry, disabled }: { entry: BidListEntry; disabled: boolean }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: entry.pnm_id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={disabled ? "" : "cursor-grab"}>
      <PnmCard entry={entry} dragging={isDragging} />
    </div>
  );
}

interface Props {
  entries: BidListEntry[];
  bidCap: number | null;
  canEdit: boolean;
  onMove: (pnm_id: string, bucket: Bucket, position: number) => void;
}

export function BidListBoard({ entries, bidCap, canEdit, onMove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped: Record<Bucket, BidListEntry[]> = useMemo(() => {
    const g: Record<Bucket, BidListEntry[]> = { cut: [], maybe: [], bid: [] };
    for (const e of entries) g[e.bucket].push(e);
    for (const b of BUCKETS) g[b].sort((a, c) => a.position - c.position);
    return g;
  }, [entries]);

  function handleDragEnd(ev: DragEndEvent) {
    if (!canEdit) return;
    const activeId = String(ev.active.id);
    const overId = ev.over ? String(ev.over.id) : null;
    if (!overId) return;

    // overId is either a bucket name ("bid"/"maybe"/"cut") if dropped on the column
    // header zone, or a PNM id if dropped on a card.
    const sourceEntry = entries.find((e) => e.pnm_id === activeId);
    if (!sourceEntry) return;

    let destBucket: Bucket;
    let destIndex: number;
    if ((BUCKETS as string[]).includes(overId)) {
      destBucket = overId as Bucket;
      destIndex = grouped[destBucket].length;
    } else {
      const overEntry = entries.find((e) => e.pnm_id === overId);
      if (!overEntry) return;
      destBucket = overEntry.bucket;
      destIndex = grouped[destBucket].findIndex((e) => e.pnm_id === overId);
    }

    const targetBucket = grouped[destBucket].filter((e) => e.pnm_id !== activeId);
    const positions = targetBucket.map((e) => e.position);
    const newPos = computeDropPosition(positions, destIndex);

    if (sourceEntry.bucket === destBucket && sourceEntry.position === newPos) return;
    onMove(activeId, destBucket, newPos);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {BUCKETS.map((b) => {
          const list = grouped[b];
          const overCap = b === "bid" && bidCap != null && list.length > bidCap;
          return (
            <div key={b} id={b} className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="font-serif text-lg text-foreground">{LABEL[b]}</h3>
                <span className={`font-mono text-sm ${overCap ? "text-red-600" : "text-muted-foreground"}`}>
                  {list.length}
                  {b === "bid" && bidCap != null ? ` / ${bidCap}` : ""}
                </span>
              </div>
              <SortableContext
                id={b}
                items={list.map((e) => e.pnm_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 min-h-[100px]">
                  {list.map((e) => (
                    <DraggableCard key={e.pnm_id} entry={e} disabled={!canEdit} />
                  ))}
                  {list.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Drop PNMs here
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/bid-list/BidListBoard.tsx
git commit -m "feat(ui): drag-drop 3-bucket bid-list board"
```

---

## Task 16: Frontend — /bid-list page

**Files:**
- Create: `frontend/app/(dashboard)/bid-list/page.tsx`

- [ ] **Step 1: Build the page**

```tsx
// frontend/app/(dashboard)/bid-list/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  useBidList,
  usePatchBidListEntry,
  useAcquireBidListLock,
  useReleaseBidListLock,
  useFinalizeBidList,
} from "@/lib/queries";
import AdminProtected from "@/components/AdminProtected";
import { BidListBoard } from "@/components/bid-list/BidListBoard";
import { LockBanner } from "@/components/bid-list/LockBanner";
import { ExportMenu } from "@/components/bid-list/ExportMenu";
import { useToast } from "@/components/ToastProvider";
import { api, refreshBidListLock } from "@/lib/api";

function useCurrentUserId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const me = await api<{ user_id: string }>("/me");
        setId(me?.user_id ?? null);
      } catch {}
    })();
  }, []);
  return id;
}

export default function BidListPage() {
  return (
    <AdminProtected roles={["admin", "exec"]}>
      <BidListInner />
    </AdminProtected>
  );
}

function BidListInner() {
  const { data, isLoading, error, refetch } = useBidList();
  const patch = usePatchBidListEntry();
  const acquire = useAcquireBidListLock();
  const release = useReleaseBidListLock();
  const finalize = useFinalizeBidList();
  const { toast } = useToast();
  const meId = useCurrentUserId();

  const list = data?.bid_list ?? null;
  const entries = data?.entries ?? [];
  const youHold = useMemo(
    () => Boolean(meId && list?.locked_by === meId && list?.locked_at &&
                  Date.now() - new Date(list.locked_at).getTime() < 10 * 60 * 1000),
    [meId, list?.locked_by, list?.locked_at],
  );

  // Heartbeat: refresh lock every 60s while you hold it; release on unmount.
  useEffect(() => {
    if (!youHold) return;
    const t = setInterval(() => {
      refreshBidListLock().catch(() => refetch());
    }, 60_000);
    return () => clearInterval(t);
  }, [youHold, refetch]);

  useEffect(() => {
    return () => {
      if (youHold) release.mutate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading bid list…</div>;
  if (error || !list) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="font-serif text-2xl text-foreground">No bid list yet</h1>
        <p className="mt-2 text-muted-foreground">
          Finish a voting round, then come back here to build your bid list.
        </p>
        <a
          href="/voting"
          className="mt-6 inline-block rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Go to voting
        </a>
      </div>
    );
  }

  const bidCount = entries.filter((e) => e.bucket === "bid").length;

  async function handleMove(pnm_id: string, bucket: "cut" | "maybe" | "bid", position: number) {
    try {
      await patch.mutateAsync({ pnm_id, bucket, position });
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes("lock")) {
        toast({ title: "Lock lost", description: "Refreshing…" });
        refetch();
      } else {
        toast({ title: "Move failed", description: e?.message || "Try again" });
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">{list.name}</h1>
          <p className="text-sm text-muted-foreground">
            {bidCount}
            {list.bid_cap != null ? ` / ${list.bid_cap}` : ""} bids
            {list.finalized_at ? ` · finalized ${list.finalized_at.slice(0, 10)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => finalize.mutate(undefined, {
              onSuccess: () => toast({ title: "Bid list finalized" }),
              onError: (e: any) => toast({ title: "Finalize failed", description: e?.message }),
            })}
            disabled={!youHold || finalize.isPending}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {finalize.isPending ? "Finalizing…" : "Finalize"}
          </button>
          <ExportMenu bidListId={list.id} />
        </div>
      </header>

      <LockBanner
        lockedBy={list.locked_by}
        lockedAt={list.locked_at}
        meId={meId ?? ""}
        onAcquire={() => acquire.mutate()}
        acquiring={acquire.isPending}
      />

      <BidListBoard
        entries={entries}
        bidCap={list.bid_cap}
        canEdit={youHold}
        onMove={handleMove}
      />
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: PASS. The new route compiles and shows up in the build output.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(dashboard\)/bid-list/page.tsx
git commit -m "feat(ui): /bid-list page with board + lock + finalize"
```

---

## Task 17: Frontend — entry points (nav link + Build CTA on /voting)

**Files:**
- Modify: `frontend/components/TopbarWithLeftNav.tsx`
- Modify: `frontend/app/(dashboard)/voting/page.tsx`

- [ ] **Step 1: Add the nav link**

In `frontend/components/TopbarWithLeftNav.tsx`, locate the existing admin/exec nav links. Add an item linking to `/bid-list` with label "Bid list", placed alongside Voting / Results entries. Match the existing JSX pattern in this file (don't introduce a new abstraction); the visibility condition should mirror how other admin links are gated.

If you can't find a clear pattern, add a plain `<Link href="/bid-list">Bid list</Link>` inside the existing admin section. Don't add new role-checking logic — the page itself is guarded.

- [ ] **Step 2: Add CTA on /voting when latest round is `completed`**

In `frontend/app/(dashboard)/voting/page.tsx`, near where the most-recent round's status is displayed (search the file for `status === "completed"` or a comparable condition), insert a CTA. The CTA should:

- Render only when the most recent round (or active round) has `status === "completed"`.
- Be a button labeled "Build bid list from this round".
- On click, call:
  ```ts
  await api("/chapters/me/bid-list", {
    method: "POST",
    body: {
      source_round_id: round.id,
      name: `Rush ${new Date().getFullYear()}`,
      bid_cap: null,
    },
  });
  router.push("/bid-list");
  ```
- Show a toast on failure (likely "Bid list already exists" or similar — if a list already exists, show a "Open existing bid list" link instead).

Use the existing `useRouter` + `useToast` imports in the file. Match the visual style of buttons already on the page (don't introduce new design).

- [ ] **Step 3: Build**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/TopbarWithLeftNav.tsx frontend/app/\(dashboard\)/voting/page.tsx
git commit -m "feat(ui): bid-list nav link + voting-page CTA"
```

---

## Task 18: Verification

- [ ] **Step 1: Backend full test pass**

Run: `cd python_server && pytest -q`
Expected: all pass (target ~75 tests = 61 before + ~14 new across `test_bid_list.py` and `test_bid_list_routes.py`).

- [ ] **Step 2: Frontend full checks**

Run: `cd frontend && npm run typecheck && npm run build && npm test`
Expected: typecheck PASS, build PASS, vitest tests PASS (target = 16: 12 before + 4 new in `bid-list-positions.test.ts`).

- [ ] **Step 3: Manual E2E** (requires live backend + DB with the new migration applied)

1. Run a voting round and end it → status = `completed`.
2. Visit `/voting` → "Build bid list from this round" CTA shows → click → land on `/bid-list`.
3. All PNMs from the round appear in **Maybe** ordered by score.
4. Drag a PNM into **Bid**; bid count updates; counter stays green under cap.
5. Drag enough into **Bid** to exceed `bid_cap` (if set) → counter turns red but doesn't block.
6. Open `/bid-list` in a second browser as another admin → see "Currently being edited by another admin · view only".
7. Wait 10 min (or stub `locked_at` in DB) → second admin sees "stale" + "Start editing" enabled.
8. Click **Finalize** → toast confirms; URL/page unchanged; you can keep editing.
9. Open **Export ▾** → download CSV → opens in spreadsheet with header + 3 bucket sections.
10. Same menu → PDF → opens, shows bid-cap, finalized date, three labeled tables.
11. Same menu → PPTX → opens with only the Bid-bucket PNMs as slides.

- [ ] **Step 4: Final commit if cleanup needed**

```bash
git status
# any pending diffs → commit
```

---

## Self-Review

- ✅ Spec § 4 Data Model — Task 1.
- ✅ Spec § 5 Backend (service + 9 routes + PDF/CSV/PPTX hook) — Tasks 2, 3, 4, 5, 6, 7, 8.
- ✅ Spec § 6 Frontend (board, card, lock banner, export menu, page, entry points) — Tasks 9–17.
- ✅ Spec § 7 Error/edge handling (empty state, lock race, stale-lock takeover, drag 409, cap warning, archived PNM, finalize-then-edit, empty bid bucket PPTX) — handled across the relevant tasks plus the manual E2E checks.
- ✅ Spec § 8 Tests (service mocks for lock + entry + finalize + exports; route tests for 403/404/409/200; vitest for position helper + cap threshold via the board render) — Tasks 2–8, 10.

Naming consistent throughout: `BidListService`, `bid_list_service`, `get_active`, `get_with_entries`, `acquire_lock` / `refresh_lock` / `release_lock`, `update_entry`, `finalize`, `export_csv` / `export_pdf`, `bid_list_id`, `BidList` / `BidListEntry` / `BidListPayload`, `useBidList` / `usePatchBidListEntry` / `useAcquireBidListLock` / `useReleaseBidListLock` / `useFinalizeBidList`, `computeDropPosition` with step `1024`.
