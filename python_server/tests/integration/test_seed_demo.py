"""
The seeded demo chapter.

The property that matters is idempotency. This script is meant to be safe to
run from a deploy hook, and a seed that quietly doubles its data on the second
run turns the demo into 60 PNMs and 576 votes without anyone noticing until a
prospective chapter is looking at it.
"""

from __future__ import annotations

import importlib.util
import pathlib

import asyncpg
import pytest
import pytest_asyncio

from .conftest import _create_database, _require_test_db, apply_migrations

pytestmark = pytest.mark.integration

SEED_SCRIPT = (
    pathlib.Path(__file__).resolve().parents[3] / "db" / "scripts" / "seed_demo.py"
)


def _load_seed_module():
    spec = importlib.util.spec_from_file_location("seed_demo", SEED_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _seed(conn, module) -> None:
    """Run the script's builders against an open connection.

    Calling the builders rather than main() keeps DATABASE_URL out of the test
    and lets the assertions run on the same connection.
    """
    import random

    rng = random.Random(20260807)
    async with conn.transaction():
        await module._upsert_chapter(conn)
        brothers = await module._upsert_brothers(conn)
        tags = await module._upsert_tags(conn)
        pnms = await module._upsert_pnms(conn, rng, tags)
        await module._upsert_prospects(conn, brothers)
        await module._upsert_events(conn, rng, pnms, brothers)
        rounds = await module._upsert_rounds(conn, rng, pnms, brothers)
        bid_list = await module._upsert_bid_list(conn, pnms, rounds, brothers)
        await module._upsert_audit(conn, brothers, rounds, bid_list)


@pytest_asyncio.fixture
async def demo_conn():
    url = await _create_database(_require_test_db(), "rr_it_demo")
    conn = await asyncpg.connect(url)
    try:
        await apply_migrations(conn)
        yield conn
    finally:
        await conn.close()


async def _counts(conn, chapter_id) -> dict:
    row = await conn.fetchrow(
        """
        SELECT (SELECT COUNT(*) FROM pnms WHERE chapter_id = $1 AND stage <> 'prospect') AS pnms,
               (SELECT COUNT(*) FROM pnms WHERE chapter_id = $1 AND stage = 'prospect') AS prospects,
               (SELECT COUNT(*) FROM pnms WHERE chapter_id = $1
                  AND stage = 'prospect' AND owner_user_id IS NULL) AS unowned,
               (SELECT COUNT(*) FROM events WHERE chapter_id = $1) AS events,
               (SELECT COUNT(*) FROM voting_rounds WHERE chapter_id = $1) AS rounds,
               (SELECT COUNT(*) FROM memberships WHERE chapter_id = $1) AS members,
               (SELECT COUNT(*) FROM audit_log WHERE chapter_id = $1) AS audit,
               (SELECT COUNT(*) FROM votes v JOIN voting_rounds r ON r.id = v.round_id
                 WHERE r.chapter_id = $1) AS votes,
               (SELECT COUNT(*) FROM bid_list_entries e JOIN bid_lists b ON b.id = e.bid_list_id
                 WHERE b.chapter_id = $1) AS bid_entries
        """,
        chapter_id,
    )
    return dict(row)


@pytest.mark.asyncio
async def test_seeding_twice_produces_the_same_chapter(demo_conn):
    module = _load_seed_module()

    await _seed(demo_conn, module)
    first = await _counts(demo_conn, module.CHAPTER_ID)

    await _seed(demo_conn, module)
    second = await _counts(demo_conn, module.CHAPTER_ID)

    assert first == second, f"seed is not idempotent: {first} then {second}"
    assert first["pnms"] == 30
    # The demo has to show the pipeline, and the pipeline is only interesting
    # when some prospects have nobody chasing them.
    assert first["prospects"] == 12
    assert first["unowned"] > 0
    assert first["rounds"] == 2
    assert first["members"] == 6
    assert first["votes"] > 0
    assert first["bid_entries"] == 24
    assert first["audit"] == 6

    assert await demo_conn.fetchval(
        "SELECT COUNT(*) FROM chapters WHERE id = $1", module.CHAPTER_ID
    ) == 1


@pytest.mark.asyncio
async def test_the_demo_rounds_produce_real_results(demo_conn, monkeypatch):
    """A demo whose results page is empty demos nothing.

    This runs the production query, so it also guards the round_pnms fan-out
    that both results and CSV export read from.
    """
    module = _load_seed_module()
    await _seed(demo_conn, module)

    from python_server import services
    from .conftest import _TxDatabaseManager

    monkeypatch.setattr(services, "get_db", lambda: _TxDatabaseManager(demo_conn))

    round_id = await demo_conn.fetchval(
        "SELECT id FROM voting_rounds WHERE chapter_id = $1 ORDER BY started_at LIMIT 1",
        module.CHAPTER_ID,
    )
    results = await services.VotingService().get_round_results(str(round_id))

    assert len(results) == 30
    assert results[0].yes_percentage > results[-1].yes_percentage, "no spread to show"
    assert any(r.controversy_score > 0 for r in results), "nothing for the controversy badge"
    assert any(r.favorite_count > 0 for r in results)


@pytest.mark.asyncio
async def test_the_demo_bid_list_is_finalized(demo_conn):
    """The bid-list page opens on a finished list, not an empty board."""
    module = _load_seed_module()
    await _seed(demo_conn, module)

    row = await demo_conn.fetchrow(
        "SELECT finalized_at, bid_cap FROM bid_lists WHERE chapter_id = $1", module.CHAPTER_ID
    )
    assert row["finalized_at"] is not None
    assert row["bid_cap"] == 12

    buckets = await demo_conn.fetch(
        """SELECT e.bucket, COUNT(*) AS n FROM bid_list_entries e
           JOIN bid_lists b ON b.id = e.bid_list_id
           WHERE b.chapter_id = $1 GROUP BY e.bucket""",
        module.CHAPTER_ID,
    )
    assert {r["bucket"]: r["n"] for r in buckets} == {"bid": 10, "maybe": 8, "cut": 6}
