"""
The live session, as the room experiences it: one statement per vote, a timer
that closes voting, a star that survives a vote, and a list of who the chair
is waiting on.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from python_server import audit, main, routes, services

pytestmark = pytest.mark.integration


@pytest.fixture
def wired(db_manager, monkeypatch):
    for module in (routes, services, audit, main):
        monkeypatch.setattr(module, "get_db", lambda: db_manager)
    monkeypatch.setattr(routes.limiter, "enabled", False)
    sent = []

    async def record(session_id, message):
        sent.append(message)

    monkeypatch.setattr(routes.ws_manager, "broadcast_to_session", record)
    return sent


@pytest.fixture
async def room(seeded, db):
    """A live session on the seeded round with Alice on screen, plus one member and one observer."""
    ids = {"session": uuid.uuid4(), "member": uuid.uuid4(), "observer": uuid.uuid4()}
    await db.execute("INSERT INTO users (id, email, name) VALUES ($1, 'mo@test.local', 'Mo Member')", ids["member"])
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'obs@test.local')", ids["observer"])
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $3, 'member'), ($2, $3, 'observer')",
        ids["member"], ids["observer"], seeded["chapter"],
    )
    await db.execute(
        """INSERT INTO sessions (id, round_id, join_code, started_at, current_pnm_id, current_pnm_started_at)
           VALUES ($1, $2, 'ROOM01', now(), $3, now())""",
        ids["session"], seeded["round"], seeded["pnm_a"],
    )
    return ids


def request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/api/v1/votes", "headers": [],
                    "client": ("203.0.113.9", 1), "query_string": b"", "app": main.app})


def user(uid) -> dict:
    return {"user_id": str(uid), "email": "x@test.local"}


async def vote(seeded, who, pnm_key="pnm_a", **body):
    return await routes.create_vote(
        request(), {"round_id": str(seeded["round"]), "pnm_id": str(seeded[pnm_key]), **body}, current_user=user(who)
    )


@pytest.mark.asyncio
async def test_tallies_count_everyone_and_the_broadcast_matches(seeded, room, wired, db):
    first = await vote(seeded, seeded["user"], choice="YES")
    assert first["tallies"] == {"yes": 1, "no": 0, "unknown": 0, "favorites": 0}
    second = await vote(seeded, room["member"], choice="NO")
    assert second["tallies"] == {"yes": 1, "no": 1, "unknown": 0, "favorites": 0}
    changed = await vote(seeded, seeded["user"], choice="NO")
    assert changed["tallies"] == {"yes": 0, "no": 2, "unknown": 0, "favorites": 0}
    assert await db.fetchval("SELECT COUNT(*) FROM votes WHERE round_id = $1", seeded["round"]) == 2

    await asyncio.sleep(0)  # let the background broadcast run
    await asyncio.sleep(0)
    casts = [m for m in wired if m["type"] == "vote_cast"]
    assert casts[-1]["tallies"] == {"yes": 0, "no": 2, "unknown": 0, "favorites": 0, "votes_collected": 2}
    assert casts[-1]["pnm_id"] == str(seeded["pnm_a"])


@pytest.mark.asyncio
async def test_a_star_survives_a_vote_and_a_vote_survives_a_star(seeded, room, wired, db):
    starred = await vote(seeded, seeded["user"], favorite=True)
    assert (starred["choice"], starred["favorite"]) == ("UNKNOWN", True)
    voted = await vote(seeded, seeded["user"], choice="YES")
    assert (voted["choice"], voted["favorite"]) == ("YES", True)
    unstarred = await vote(seeded, seeded["user"], favorite=False)
    assert (unstarred["choice"], unstarred["favorite"]) == ("YES", False)


@pytest.mark.asyncio
async def test_refusals_write_nothing(seeded, room, wired, db):
    stranger = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'stranger@test.local')", stranger)

    async def refused(status, who=None, **body):
        with pytest.raises(HTTPException) as exc:
            await vote(seeded, who or seeded["user"], **body)
        assert exc.value.status_code == status
        return exc.value.detail

    await refused(403, who=stranger, choice="YES")
    await refused(400, choice="MAYBE")
    await db.execute("UPDATE sessions SET locked = true WHERE id = $1", room["session"])
    assert "locked" in await refused(409, choice="YES")
    await db.execute("UPDATE sessions SET locked = false WHERE id = $1", room["session"])
    await db.execute("UPDATE voting_rounds SET status = 'ENDED' WHERE id = $1", seeded["round"])
    await refused(400, choice="YES")
    with pytest.raises(HTTPException) as exc:
        await routes.create_vote(
            request(), {"round_id": str(uuid.uuid4()), "pnm_id": str(seeded["pnm_a"]), "choice": "YES"},
            current_user=user(seeded["user"]),
        )
    assert exc.value.status_code == 404
    assert await db.fetchval("SELECT COUNT(*) FROM votes") == 0


@pytest.mark.asyncio
async def test_timer_closes_voting_on_the_pnm_on_screen_and_unlock_reopens_it(seeded, room, wired, db):
    await db.execute("UPDATE sessions SET timer_seconds = 60 WHERE id = $1", room["session"])
    assert (await vote(seeded, seeded["user"], choice="YES"))["choice"] == "YES"

    await db.execute(
        "UPDATE sessions SET current_pnm_started_at = now() - interval '5 minutes' WHERE id = $1", room["session"]
    )
    with pytest.raises(HTTPException) as exc:
        await vote(seeded, room["member"], choice="NO")
    assert exc.value.status_code == 409 and "Time is up" in exc.value.detail
    # Someone not on screen is not governed by the clock for the PNM who is.
    assert (await vote(seeded, room["member"], pnm_key="pnm_b", choice="NO"))["choice"] == "NO"

    state = await routes.get_session_current(str(room["session"]), current_user=user(seeded["user"]))
    assert state["timer_remaining"] == 0

    await routes.toggle_session_lock(str(room["session"]), {"locked": False}, current_user=user(seeded["user"]))
    state = await routes.get_session_current(str(room["session"]), current_user=user(seeded["user"]))
    assert state["timer_remaining"] >= 58
    assert (await vote(seeded, room["member"], choice="NO"))["choice"] == "NO"


@pytest.mark.asyncio
async def test_chair_sees_who_has_not_voted_and_never_how(seeded, room, wired, db):
    sid = str(room["session"])
    before = await routes.get_session_waiting(sid, current_user=user(seeded["user"]))
    assert before["voted"] == 0
    assert [w["name"] for w in before["waiting"]] == ["admin@test.local", "Mo Member"]  # no observer

    await vote(seeded, room["member"], choice="NO")
    after = await routes.get_session_waiting(sid, current_user=user(seeded["user"]))
    assert after["voted"] == 1
    assert [w["name"] for w in after["waiting"]] == ["admin@test.local"]
    assert "NO" not in str(after)

    with pytest.raises(HTTPException) as exc:
        await routes.get_session_waiting(sid, current_user=user(room["member"]))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_current_reports_progress_and_the_next_photo(seeded, room, wired, db):
    await db.execute("UPDATE pnms SET photo_url = 'https://img.test/bob.jpg' WHERE id = $1", seeded["pnm_b"])
    await vote(seeded, seeded["user"], choice="YES")
    state = await routes.get_session_current(str(room["session"]), current_user=user(room["member"]))
    assert state["current_votes"] == 1
    assert state["eligible_voters"] == 2  # admin and member; the observer cannot vote
    assert (state["position"], state["total"]) == (1, 2)
    assert state["next_photo_url"] == "https://img.test/bob.jpg"

    wired.clear()
    await routes.advance_session(str(room["session"]), current_user=user(seeded["user"]))
    [advance] = [m for m in wired if m["type"] == "pnm_advance"]
    assert advance["current_pnm_id"] == str(seeded["pnm_b"])
    assert advance["pnm"]["name"] == "Bob Example"
    assert (advance["position"], advance["total"]) == (2, 2)
    assert advance["next_photo_url"] is None
