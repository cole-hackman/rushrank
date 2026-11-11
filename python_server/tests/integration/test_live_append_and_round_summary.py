"""
Two behaviours added after the November 2026 reassessment:

1. A PNM who becomes eligible while a live session is running joins the end of
   that session (python_server/live_round.py). Before, a walk-up added during a
   session could not be voted on until the next one.
2. GET /chapters/{id}/round-summary returns every round's per-PNM results in two
   queries, replacing the analytics page's per-round and per-PNM fan-out.
"""

from __future__ import annotations

import uuid

import pytest

from python_server import live_round, services

pytestmark = pytest.mark.integration


async def _open_session(db, round_id):
    sid = uuid.uuid4()
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, locked, started_at)
           VALUES ($1, $2, $3, false, NOW())""",
        sid, round_id, f"J{uuid.uuid4().hex[:5].upper()}",
    )
    return sid


async def _pnm(db, chapter, name, *, stage="pnm", archived=False):
    pid = uuid.uuid4()
    await db.execute(
        "INSERT INTO pnms (id, chapter_id, name, stage, archived) VALUES ($1, $2, $3, $4, $5)",
        pid, chapter, name, stage, archived,
    )
    return pid


async def _order(db, round_id):
    rows = await db.fetch(
        "SELECT pnm_id FROM round_pnms WHERE round_id = $1 ORDER BY order_index", round_id
    )
    selected = await db.fetchval("SELECT selected_pnm_ids FROM voting_rounds WHERE id = $1", round_id)
    return [r["pnm_id"] for r in rows], [uuid.UUID(x) for x in selected]


@pytest.mark.asyncio
async def test_new_pnm_joins_the_end_of_an_open_session(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    await _open_session(db, seeded["round"])
    walk_up = await _pnm(db, seeded["chapter"], "Aaron Walkup")  # sorts first by name

    added = await live_round.add_to_live_session(str(seeded["chapter"]), [str(walk_up)])

    assert added == 1
    in_round, selected = await _order(db, seeded["round"])
    # Appended after the existing running order, not slotted in alphabetically:
    # the chair has already passed the start of the list.
    assert in_round == [seeded["pnm_a"], seeded["pnm_b"], walk_up]
    assert selected == in_round


@pytest.mark.asyncio
async def test_nothing_is_added_without_an_open_session(seeded, db_manager, db, monkeypatch):
    """Rounds created by Make cuts are survivors only and must not grow."""
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    walk_up = await _pnm(db, seeded["chapter"], "Zed Later")

    added = await live_round.add_to_live_session(str(seeded["chapter"]), [str(walk_up)])

    assert added == 0
    in_round, _ = await _order(db, seeded["round"])
    assert walk_up not in in_round


@pytest.mark.asyncio
async def test_ended_session_is_left_alone(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    sid = await _open_session(db, seeded["round"])
    await db.execute("UPDATE sessions SET ended_at = NOW() WHERE id = $1", sid)
    walk_up = await _pnm(db, seeded["chapter"], "Late Arrival")

    assert await live_round.add_to_live_session(str(seeded["chapter"]), [str(walk_up)]) == 0


@pytest.mark.asyncio
async def test_prospects_archived_and_existing_pnms_are_not_added(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    await _open_session(db, seeded["round"])
    prospect = await _pnm(db, seeded["chapter"], "Pat Prospect", stage="prospect")
    archived = await _pnm(db, seeded["chapter"], "Archie Archived", archived=True)

    added = await live_round.add_to_live_session(
        str(seeded["chapter"]), [str(prospect), str(archived), str(seeded["pnm_a"])]
    )

    assert added == 0
    in_round, selected = await _order(db, seeded["round"])
    assert in_round == [seeded["pnm_a"], seeded["pnm_b"]]
    assert len(selected) == 2


@pytest.mark.asyncio
async def test_another_chapters_pnm_is_never_added(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    await _open_session(db, seeded["round"])
    other = uuid.uuid4()
    await db.execute("INSERT INTO chapters (id, name) VALUES ($1, 'Other Chapter')", other)
    outsider = await _pnm(db, other, "Outside Person")

    assert await live_round.add_to_live_session(str(seeded["chapter"]), [str(outsider)]) == 0


@pytest.mark.asyncio
async def test_several_at_once_keep_a_stable_order(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(live_round, "get_db", lambda: db_manager)
    await _open_session(db, seeded["round"])
    c = await _pnm(db, seeded["chapter"], "Cara Import")
    d = await _pnm(db, seeded["chapter"], "Dev Import")

    assert await live_round.add_to_live_session(str(seeded["chapter"]), [str(d), str(c)]) == 2
    in_round, selected = await _order(db, seeded["round"])
    assert in_round[2:] == [c, d]  # by name, after everyone already queued
    assert selected == in_round

    # Calling again is a no-op, not a duplicate.
    assert await live_round.add_to_live_session(str(seeded["chapter"]), [str(c)]) == 0


@pytest.mark.asyncio
async def test_round_summary_matches_per_round_results(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    voters = []
    for i in range(3):
        uid = uuid.uuid4()
        await db.execute("INSERT INTO users (id, email) VALUES ($1, $2)", uid, f"v{i}@test.local")
        voters.append(uid)
    # pnm_a: YES, YES, NO.  pnm_b: one UNKNOWN with a favourite.
    for uid, value in zip(voters, ["YES", "YES", "NO"]):
        await db.execute(
            "INSERT INTO votes (round_id, pnm_id, voter_user_id, value) VALUES ($1, $2, $3, $4)",
            seeded["round"], seeded["pnm_a"], uid, value,
        )
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
           VALUES ($1, $2, $3, 'UNKNOWN', true)""",
        seeded["round"], seeded["pnm_b"], voters[0],
    )

    summary = await services.VotingService().get_round_summary(str(seeded["chapter"]))

    assert summary["total_votes"] == 4
    [round_] = summary["rounds"]
    assert round_["id"] == str(seeded["round"])
    assert round_["pnm_count"] == 2
    assert round_["total_votes"] == 4
    assert round_["voter_count"] == 3
    by_pnm = {r["pnm_id"]: r for r in round_["results"]}

    detailed = await services.VotingService().get_round_results(str(seeded["round"]))
    for row in detailed:
        s = by_pnm[row.id]
        assert s["vote_count"] == row.vote_count
        assert s["yes_count"] == row.yes_count
        assert s["no_count"] == row.no_count
        assert s["favorite_count"] == row.favorite_count
        assert s["yes_percentage"] == pytest.approx(float(row.yes_percentage))
    assert by_pnm[str(seeded["pnm_a"])]["yes_percentage"] == pytest.approx(66.67)


@pytest.mark.asyncio
async def test_round_summary_is_scoped_to_the_chapter(seeded, db_manager, db, monkeypatch):
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    other = uuid.uuid4()
    await db.execute("INSERT INTO chapters (id, name) VALUES ($1, 'Other Chapter')", other)
    await db.execute(
        """INSERT INTO voting_rounds (chapter_id, type, status, room_code)
           VALUES ($1, 'GENERAL', 'ENDED', 'OTHER1')""",
        other,
    )

    summary = await services.VotingService().get_round_summary(str(seeded["chapter"]))
    assert [r["id"] for r in summary["rounds"]] == [str(seeded["round"])]
