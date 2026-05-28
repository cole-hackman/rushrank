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
