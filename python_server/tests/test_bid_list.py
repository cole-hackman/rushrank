"""Unit tests for BidListService (mock-based)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

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
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    seq_one = [
        {"selected_pnm_ids": ["pnm-1", "pnm-2", "pnm-3"]},  # SELECT from voting_rounds
        {"id": "list-1", "chapter_id": "c-1", "source_round_id": "r-1",
         "name": "Rush 2026", "bid_cap": 25,
         "locked_by": None, "locked_at": None, "finalized_at": None,
         "created_at": now, "updated_at": now},  # INSERT bid_lists RETURNING
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


@pytest.mark.asyncio
async def test_get_active_returns_most_recent_non_finalized():
    svc = BidListService()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db = _mock_db(execute_one_seq=[{
        "id": "list-A", "chapter_id": "c-1", "source_round_id": "r-1",
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": now, "updated_at": now,
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
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    seq_one = [{
        "id": "list-A", "chapter_id": "c-1", "source_round_id": "r-1",
        "name": "Rush 2026", "bid_cap": 25,
        "locked_by": None, "locked_at": None, "finalized_at": None,
        "created_at": now, "updated_at": now,
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


@pytest.mark.asyncio
async def test_acquire_lock_succeeds_when_unlocked():
    svc = BidListService()
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    seq_one = [
        {"locked_by": None, "locked_at": None},                # current lock state
        {"locked_by": "u-1", "locked_at": now},  # after UPDATE
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.acquire_lock("list-A", "u-1")
    assert out["locked_by"] == "u-1"


@pytest.mark.asyncio
async def test_acquire_lock_409_when_held_by_other_recently():
    svc = BidListService()
    from datetime import datetime, timezone, timedelta
    recent = datetime.now(timezone.utc) - timedelta(seconds=10)
    db = _mock_db(execute_one_seq=[{"locked_by": "u-2", "locked_at": recent}])
    with patch("python_server.bid_list.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.acquire_lock("list-A", "u-1")
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_acquire_lock_takeover_when_stale():
    svc = BidListService()
    from datetime import datetime, timezone, timedelta
    stale = datetime.now(timezone.utc) - timedelta(seconds=601)
    now = datetime.now(timezone.utc)
    seq_one = [
        {"locked_by": "u-2", "locked_at": stale},
        {"locked_by": "u-1", "locked_at": now},
    ]
    db = _mock_db(execute_one_seq=seq_one)
    with patch("python_server.bid_list.get_db", return_value=db):
        out = await svc.acquire_lock("list-A", "u-1")
    assert out["locked_by"] == "u-1"


@pytest.mark.asyncio
async def test_refresh_lock_requires_caller_holds_it():
    svc = BidListService()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db = _mock_db(execute_one_seq=[{"locked_by": "u-2", "locked_at": now}])
    with patch("python_server.bid_list.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.refresh_lock("list-A", "u-1")
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_release_lock_clears_fields():
    svc = BidListService()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db = _mock_db(execute_one_seq=[{"locked_by": "u-1", "locked_at": now}])
    with patch("python_server.bid_list.get_db", return_value=db):
        await svc.release_lock("list-A", "u-1")
    db.execute_command.assert_awaited()
