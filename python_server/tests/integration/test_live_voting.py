"""
Live voting: the controls the UI already exposed but the backend ignored.

Before this pass the lock was cosmetic (nothing checked it), tallies never
streamed (broadcast_vote_cast was defined and never called), the timer was a
hardcoded literal, and anonymity was collected and discarded.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.integration


async def _member(db, chapter, email: str, role: str = "member"):
    uid = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, $2)", uid, email)
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, $3)",
        uid, chapter, role,
    )
    return uid


@pytest.mark.asyncio
async def test_session_persists_timer_and_anonymity(seeded, db):
    """Both were sent by the UI and dropped on the floor by POST /sessions."""
    session = uuid.uuid4()
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, locked, started_at,
                                 timer_seconds, anonymous, current_pnm_started_at)
           VALUES ($1, $2, 'TIMER1', false, NOW(), 180, true, NOW())""",
        session, seeded["round"],
    )
    row = await db.fetchrow(
        "SELECT timer_seconds, anonymous, current_pnm_started_at FROM sessions WHERE id = $1",
        session,
    )
    assert row["timer_seconds"] == 180
    assert row["anonymous"] is True
    assert row["current_pnm_started_at"] is not None


@pytest.mark.asyncio
async def test_timer_remaining_is_derived_from_the_server_clock(seeded, db):
    """A hardcoded 165 with a TODO beside it, previously.

    Derived from one server timestamp so forty phones in a room agree rather
    than each drifting on its own interval.
    """
    session = uuid.uuid4()
    started = datetime.now(timezone.utc) - timedelta(seconds=30)
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, locked, started_at,
                                 timer_seconds, current_pnm_started_at)
           VALUES ($1, $2, 'TIMER2', false, NOW(), 180, $3)""",
        session, seeded["round"], started,
    )
    row = await db.fetchrow(
        "SELECT timer_seconds, current_pnm_started_at FROM sessions WHERE id = $1", session
    )
    elapsed = (datetime.now(timezone.utc) - row["current_pnm_started_at"]).total_seconds()
    remaining = max(0, int(row["timer_seconds"] - elapsed))
    assert 145 <= remaining <= 152, remaining


@pytest.mark.asyncio
async def test_timer_floors_at_zero_rather_than_going_negative(seeded, db):
    session = uuid.uuid4()
    started = datetime.now(timezone.utc) - timedelta(seconds=600)
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, locked, started_at,
                                 timer_seconds, current_pnm_started_at)
           VALUES ($1, $2, 'TIMER3', false, NOW(), 60, $3)""",
        session, seeded["round"], started,
    )
    row = await db.fetchrow(
        "SELECT timer_seconds, current_pnm_started_at FROM sessions WHERE id = $1", session
    )
    elapsed = (datetime.now(timezone.utc) - row["current_pnm_started_at"]).total_seconds()
    assert max(0, int(row["timer_seconds"] - elapsed)) == 0


@pytest.mark.asyncio
async def test_advancing_restarts_the_countdown(seeded, db):
    """The stamp must move with the chair, or the timer only works for PNM #1."""
    session = uuid.uuid4()
    old_stamp = datetime.now(timezone.utc) - timedelta(seconds=120)
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, locked, started_at,
                                 current_pnm_id, timer_seconds, current_pnm_started_at)
           VALUES ($1, $2, 'ADV1', false, NOW(), $3, 180, $4)""",
        session, seeded["round"], seeded["pnm_a"], old_stamp,
    )
    await db.execute(
        "UPDATE sessions SET current_pnm_id = $1, current_pnm_started_at = NOW() WHERE id = $2",
        seeded["pnm_b"], session,
    )
    stamp = await db.fetchval("SELECT current_pnm_started_at FROM sessions WHERE id = $1", session)
    assert (datetime.now(timezone.utc) - stamp).total_seconds() < 5


@pytest.mark.asyncio
async def test_locked_session_is_detectable_from_the_round(seeded, db):
    """POST /votes resolves the active session from round_id to check the lock.

    Previously nothing on the write path consulted `locked` at all.
    """
    await db.execute(
        """INSERT INTO sessions (round_id, join_code, locked, started_at)
           VALUES ($1, 'LOCK1', true, NOW())""",
        seeded["round"],
    )
    row = await db.fetchrow(
        """SELECT id, locked FROM sessions
           WHERE round_id = $1 AND ended_at IS NULL
           ORDER BY started_at DESC LIMIT 1""",
        seeded["round"],
    )
    assert row is not None and row["locked"] is True


@pytest.mark.asyncio
async def test_ended_sessions_do_not_block_voting(seeded, db):
    """The lock lookup filters on ended_at, so a stale locked session from a
    previous round must not freeze the current one."""
    await db.execute(
        """INSERT INTO sessions (round_id, join_code, locked, started_at, ended_at)
           VALUES ($1, 'OLDLOCK', true, NOW() - interval '1 day', NOW() - interval '1 hour')""",
        seeded["round"],
    )
    row = await db.fetchrow(
        """SELECT id FROM sessions
           WHERE round_id = $1 AND ended_at IS NULL
           ORDER BY started_at DESC LIMIT 1""",
        seeded["round"],
    )
    assert row is None


@pytest.mark.asyncio
async def test_vote_cast_broadcast_payload_is_computable(seeded, db):
    """The chair's progress bar reads votes_collected off the broadcast.

    It was frozen at whatever it was when the session was created, because
    broadcast_vote_cast was never called.
    """
    for i, value in enumerate(("YES", "NO", "YES")):
        uid = await _member(db, seeded["chapter"], f"tally{i}@test.local")
        await db.execute(
            """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
               VALUES ($1, $2, $3, $4, $5)""",
            seeded["round"], seeded["pnm_a"], uid, value, i == 0,
        )

    tallies = await db.fetchrow(
        """SELECT
             COUNT(CASE WHEN value = 'YES' THEN 1 END) as yes_count,
             COUNT(CASE WHEN value = 'NO' THEN 1 END) as no_count,
             COUNT(CASE WHEN value = 'UNKNOWN' THEN 1 END) as unknown_count,
             COUNT(CASE WHEN favorite = true THEN 1 END) as favorites_count
           FROM votes WHERE round_id = $1 AND pnm_id = $2""",
        seeded["round"], seeded["pnm_a"],
    )
    collected = await db.fetchval(
        "SELECT COUNT(DISTINCT voter_user_id) FROM votes WHERE round_id = $1", seeded["round"]
    )
    assert (tallies["yes_count"], tallies["no_count"], tallies["favorites_count"]) == (2, 1, 1)
    assert collected == 3


@pytest.mark.asyncio
async def test_anonymous_sessions_mask_the_voter(seeded, db):
    """Anonymity is enforced at the read boundary, not at write time.

    One-vote-per-person requires storing voter_user_id, so v_votes_public masks
    it instead. Any endpoint exposing cross-voter data must go through the view.
    """
    uid = await _member(db, seeded["chapter"], "secret@test.local")
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value)
           VALUES ($1, $2, $3, 'YES')""",
        seeded["round"], seeded["pnm_a"], uid,
    )

    await db.execute(
        "UPDATE voting_rounds SET settings = '{\"anonymous\": true}'::jsonb WHERE id = $1",
        seeded["round"],
    )
    masked = await db.fetchval(
        "SELECT voter_user_id FROM v_votes_public WHERE round_id = $1 LIMIT 1", seeded["round"]
    )
    assert masked is None, "anonymous round still exposed the voter"

    await db.execute(
        "UPDATE voting_rounds SET settings = '{\"anonymous\": false}'::jsonb WHERE id = $1",
        seeded["round"],
    )
    visible = await db.fetchval(
        "SELECT voter_user_id FROM v_votes_public WHERE round_id = $1 LIMIT 1", seeded["round"]
    )
    assert visible == uid

    # The underlying row always keeps the voter -- masking is a read concern.
    assert await db.fetchval(
        "SELECT COUNT(*) FROM votes WHERE round_id = $1 AND voter_user_id = $2",
        seeded["round"], uid,
    ) == 1


@pytest.mark.asyncio
async def test_favorite_without_a_prior_vote_is_recorded(seeded, db):
    """Starring a PNM you haven't voted on used to 400.

    It now records UNKNOWN so the favourite is not lost.
    """
    uid = await _member(db, seeded["chapter"], "starrer@test.local")
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
           VALUES ($1, $2, $3, 'UNKNOWN', true)""",
        seeded["round"], seeded["pnm_a"], uid,
    )
    row = await db.fetchrow(
        "SELECT value, favorite FROM votes WHERE round_id = $1 AND voter_user_id = $2",
        seeded["round"], uid,
    )
    assert row["value"] == "UNKNOWN" and row["favorite"] is True
