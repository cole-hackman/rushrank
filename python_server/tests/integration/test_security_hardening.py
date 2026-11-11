"""
Security findings S1 to S17 from docs/reboot-2026-11/02-unfinished-and-broken.md.

Most of them were the same mistake: an id from the request was trusted without
asking which chapter owns it. Every test here builds a second chapter and shows
that the first chapter's admin cannot reach into it.
"""

from __future__ import annotations

import json
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from python_server import audit, bid_list, main, rate_limit, routes, services
from python_server.models import AttendanceCreate, NoteCreate

pytestmark = pytest.mark.integration


@pytest.fixture
def wired(db_manager, monkeypatch):
    """Point every module's get_db() at the rolled-back test transaction."""
    for module in (routes, services, bid_list, audit, main):
        monkeypatch.setattr(module, "get_db", lambda: db_manager)
    monkeypatch.setattr(routes.limiter, "enabled", False)
    return db_manager


@pytest.fixture
async def other(db):
    """A second chapter with its own admin, PNM, tag, event and ended round."""
    ids = {k: uuid.uuid4() for k in ("user", "chapter", "pnm", "tag", "event", "round")}
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'admin@other.local')", ids["user"])
    await db.execute("INSERT INTO chapters (id, name) VALUES ($1, 'Other Chapter')", ids["chapter"])
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'admin')",
        ids["user"], ids["chapter"],
    )
    await db.execute(
        "INSERT INTO pnms (id, chapter_id, name, major) VALUES ($1, $2, 'Olly Other', 'Math')",
        ids["pnm"], ids["chapter"],
    )
    await db.execute(
        "INSERT INTO tags (id, chapter_id, label, color) VALUES ($1, $2, 'Legacy', '#111111')",
        ids["tag"], ids["chapter"],
    )
    await db.execute(
        "INSERT INTO events (id, chapter_id, name, date) VALUES ($1, $2, 'Their Smoker', now())",
        ids["event"], ids["chapter"],
    )
    await db.execute(
        """INSERT INTO voting_rounds (id, chapter_id, type, status, room_code, selected_pnm_ids)
           VALUES ($1, $2, 'GENERAL', 'ENDED', 'OT0001', $3)""",
        ids["round"], ids["chapter"], [str(ids["pnm"])],
    )
    return ids


def me(seeded) -> dict:
    return {"user_id": str(seeded["user"]), "email": "admin@test.local"}


def fake_request(path: str = "/api/v1/votes", headers: dict | None = None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({
        "type": "http", "method": "POST", "path": path, "headers": raw,
        "client": ("203.0.113.9", 1234), "query_string": b"", "app": main.app,
    })


# --- S1, S2, S16, S9, F18: the endpoints are gone ---------------------------

def test_unsafe_endpoints_are_not_routed():
    paths = {(m, r.path) for r in main.app.routes for m in getattr(r, "methods", []) or []}
    for method, suffix in (
        ("POST", "/admin/reset-password"),
        ("POST", "/admin/promote-to-admin"),
        ("POST", "/chapters"),
        ("POST", "/rounds/{round_id}/votes"),
        ("POST", "/rounds/{round_id}/advance"),
        ("POST", "/rounds/{round_id}/lock"),
    ):
        for prefix in ("/api/v1", "/api"):
            assert (method, prefix + suffix) not in paths, f"{method} {prefix}{suffix} is still mounted"
    # The routes that replaced the legacy ones are untouched.
    assert ("POST", "/api/v1/votes") in paths
    assert ("POST", "/api/v1/chapters/provision") in paths


# --- S5: tags ---------------------------------------------------------------

@pytest.mark.asyncio
async def test_tag_update_and_delete_stay_inside_the_callers_chapter(seeded, other, wired, db):
    chapter = str(seeded["chapter"])
    with pytest.raises(HTTPException) as exc:
        await routes.update_tag(str(other["tag"]), {"label": "Hijacked"}, chapter_id=chapter, current_user=me(seeded))
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await routes.delete_tag(str(other["tag"]), chapter_id=chapter, current_user=me(seeded))
    assert exc.value.status_code == 404
    assert await db.fetchval("SELECT label FROM tags WHERE id = $1", other["tag"]) == "Legacy"

    mine = await routes.create_tag({"label": "Athlete"}, chapter_id=chapter, current_user=me(seeded))
    renamed = await routes.update_tag(mine["id"], {"label": "Varsity"}, chapter_id=chapter, current_user=me(seeded))
    assert renamed["label"] == "Varsity"


@pytest.mark.asyncio
async def test_another_chapters_tag_cannot_be_put_on_a_pnm(seeded, other, wired, db):
    with pytest.raises(HTTPException) as exc:
        await routes.add_tag_to_pnm(str(seeded["pnm_a"]), str(other["tag"]), current_user=me(seeded))
    assert exc.value.status_code == 404
    assert await db.fetchval("SELECT COUNT(*) FROM pnm_tags WHERE pnm_id = $1", seeded["pnm_a"]) == 0

    mine = await routes.create_tag({"label": "Athlete"}, chapter_id=str(seeded["chapter"]), current_user=me(seeded))
    await routes.add_tag_to_pnm(str(seeded["pnm_a"]), mine["id"], current_user=me(seeded))
    # Adding it twice is still a success, not a 404.
    await routes.add_tag_to_pnm(str(seeded["pnm_a"]), mine["id"], current_user=me(seeded))
    assert await db.fetchval("SELECT COUNT(*) FROM pnm_tags WHERE pnm_id = $1", seeded["pnm_a"]) == 1


# --- S6, S11: bid list ------------------------------------------------------

@pytest.mark.asyncio
async def test_bid_list_cannot_be_seeded_from_another_chapters_round(seeded, other, wired):
    svc = bid_list.BidListService()
    with pytest.raises(HTTPException) as exc:
        await svc.create_from_round(str(seeded["chapter"]), str(other["round"]), "Stolen", None, str(seeded["user"]))
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_finalized_bid_list_refuses_edits(seeded, wired, db):
    svc = bid_list.BidListService()
    user = str(seeded["user"])
    created = await svc.create_from_round(str(seeded["chapter"]), str(seeded["round"]), "Fall", None, user)
    list_id = created["id"]
    await db.execute("UPDATE bid_lists SET locked_by = $1, locked_at = now() WHERE id = $2", seeded["user"], uuid.UUID(list_id))

    moved = await svc.update_entry(list_id, str(seeded["pnm_a"]), "bid", 0, user)
    assert moved["bucket"] == "bid"

    await db.execute("UPDATE bid_lists SET finalized_at = now() WHERE id = $1", uuid.UUID(list_id))
    with pytest.raises(HTTPException) as exc:
        await svc.update_entry(list_id, str(seeded["pnm_a"]), "cut", 0, user)
    assert exc.value.status_code == 409
    assert await db.fetchval(
        "SELECT bucket::text FROM bid_list_entries WHERE bid_list_id = $1 AND pnm_id = $2",
        uuid.UUID(list_id), seeded["pnm_a"],
    ) == "bid"


# --- S7: bulk card export ---------------------------------------------------

@pytest.mark.asyncio
async def test_bulk_export_checks_every_pnm_even_with_a_chapter_id(seeded, other, wired, monkeypatch):
    called = []

    async def fake_bulk(chapter_id=None, pnm_ids=None):
        called.append(pnm_ids)
        return "https://example.test/cards.zip"

    monkeypatch.setattr(routes.export_service, "generate_pnm_cards_bulk", fake_bulk)

    with pytest.raises(HTTPException) as exc:
        await routes.generate_pnm_cards_bulk(
            {"chapter_id": str(seeded["chapter"]), "pnm_ids": [str(seeded["pnm_a"]), str(other["pnm"])]},
            current_user=me(seeded),
        )
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await routes.generate_pnm_cards_bulk({"pnm_ids": [str(other["pnm"])]}, current_user=me(seeded))
    assert exc.value.status_code == 403
    assert called == []

    ok = await routes.generate_pnm_cards_bulk(
        {"chapter_id": str(seeded["chapter"]), "pnm_ids": [str(seeded["pnm_a"])]}, current_user=me(seeded)
    )
    assert ok["url"].endswith("cards.zip")


# --- S8: attendance ---------------------------------------------------------

@pytest.mark.asyncio
async def test_attendance_is_written_to_the_event_in_the_path(seeded, other, wired, db):
    body = AttendanceCreate(event_id=str(other["event"]), pnm_id=str(seeded["pnm_a"]))
    await routes.mark_attendance(str(seeded["event"]), body, current_user=me(seeded))
    assert await db.fetchval("SELECT COUNT(*) FROM event_attendance WHERE event_id = $1", other["event"]) == 0
    assert await db.fetchval("SELECT COUNT(*) FROM event_attendance WHERE event_id = $1", seeded["event"]) == 1

    stranger = AttendanceCreate(event_id=str(seeded["event"]), pnm_id=str(other["pnm"]))
    with pytest.raises(HTTPException) as exc:
        await routes.mark_attendance(str(seeded["event"]), stranger, current_user=me(seeded))
    assert exc.value.status_code == 404


# --- S10: votes -------------------------------------------------------------

@pytest.mark.asyncio
async def test_vote_for_a_pnm_outside_the_round_is_rejected(seeded, other, wired, db):
    outsider = uuid.uuid4()
    await db.execute(
        "INSERT INTO pnms (id, chapter_id, name, major) VALUES ($1, $2, 'Not In Round', 'Art')",
        outsider, seeded["chapter"],
    )
    for pnm in (outsider, other["pnm"]):
        with pytest.raises(HTTPException) as exc:
            await routes.create_vote(
                fake_request(), {"round_id": str(seeded["round"]), "pnm_id": str(pnm), "choice": "YES"},
                current_user=me(seeded),
            )
        assert exc.value.status_code == 400
    assert await db.fetchval("SELECT COUNT(*) FROM votes WHERE round_id = $1", seeded["round"]) == 0

    vote = await routes.create_vote(
        fake_request(), {"round_id": str(seeded["round"]), "pnm_id": str(seeded["pnm_a"]), "choice": "YES"},
        current_user=me(seeded),
    )
    assert vote["choice"] == "YES"


# --- S12: anonymous notes ---------------------------------------------------

@pytest.mark.asyncio
async def test_anonymous_note_carries_no_author_in_any_field(seeded, wired):
    svc = services.NoteService()
    pnm = str(seeded["pnm_a"])
    made = await svc.create_note(NoteCreate(pnm_id=pnm, body="Quiet but sharp", anonymous=True), str(seeded["user"]))
    assert made.author_id is None
    signed = await svc.create_note(NoteCreate(pnm_id=pnm, body="Met at the smoker", anonymous=False), str(seeded["user"]))
    assert signed.author_id == str(seeded["user"])

    listed = {n.body: n for n in await svc.list_notes(pnm)}
    assert listed["Quiet but sharp"].author_id is None
    assert listed["Quiet but sharp"].author == "Anonymous"
    assert str(seeded["user"]) not in listed["Quiet but sharp"].model_dump_json()
    assert listed["Met at the smoker"].author_id == str(seeded["user"])


# --- S13: public QR page ----------------------------------------------------

@pytest.mark.asyncio
async def test_qr_page_escapes_the_name_and_email(seeded, wired, db):
    email = 'x"><script>alert(1)</script>@test.local'
    await db.execute(
        "UPDATE pnms SET name = $1, email = $2 WHERE id = $3",
        '<img src=x onerror=alert(1)>', email, seeded["pnm_a"],
    )
    response = await routes.get_qr_page(fake_request("/api/qr"), email=email)
    page = response.body.decode()
    assert "<img src=x" not in page and "<script>" not in page
    assert "&lt;img src=x onerror=alert(1)&gt;" in page


# --- S14: rate-limit bucket -------------------------------------------------

def test_public_routes_are_limited_by_address_not_by_an_unverified_token():
    forged = "Bearer " + ".".join(["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiJmcmVzaCJ9", "c2ln"])
    request = fake_request("/api/v1/public/demo-session", {"authorization": forged})
    assert rate_limit.get_rate_limit_key(request).startswith("user:")
    assert rate_limit.get_ip_rate_limit_key(request) == "ip:203.0.113.9"


# --- S15: last admin --------------------------------------------------------

@pytest.mark.asyncio
async def test_the_only_admin_cannot_be_demoted(seeded, wired, db):
    chapter = str(seeded["chapter"])
    membership = await db.fetchval(
        "SELECT id FROM memberships WHERE user_id = $1 AND chapter_id = $2", seeded["user"], seeded["chapter"]
    )
    with pytest.raises(HTTPException) as exc:
        await routes.update_membership_role(str(membership), {"role": "member"}, chapter_id=chapter, current_user=me(seeded))
    assert exc.value.status_code == 409

    second = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'second@test.local')", second)
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'admin')", second, seeded["chapter"]
    )
    updated = await routes.update_membership_role(str(membership), {"role": "member"}, chapter_id=chapter, current_user=me(seeded))
    assert updated["role"] == "member"


# --- S17: rounds for a non-member -------------------------------------------

@pytest.mark.asyncio
async def test_rounds_for_another_chapter_is_403_not_500(seeded, other, wired):
    with pytest.raises(HTTPException) as exc:
        await routes.get_rounds(chapter_id=str(other["chapter"]), current_user=me(seeded))
    assert exc.value.status_code == 403
    assert isinstance(await routes.get_rounds(chapter_id=str(seeded["chapter"]), current_user=me(seeded)), list)


# --- S3: websocket ----------------------------------------------------------

class FakeSocket:
    def __init__(self, first_message):
        self.first_message = first_message

    async def receive_text(self):
        if isinstance(self.first_message, Exception):
            raise self.first_message
        return self.first_message


@pytest.fixture
async def live_session(seeded, db):
    session = uuid.uuid4()
    await db.execute(
        "INSERT INTO sessions (id, round_id, join_code, started_at) VALUES ($1, $2, 'ABC123', now())",
        session, seeded["round"],
    )
    return str(session)


@pytest.mark.asyncio
async def test_socket_needs_a_valid_token_from_a_member_of_the_sessions_chapter(
    seeded, other, wired, live_session, monkeypatch
):
    async def verify(token):
        if token == "member":
            return {"sub": str(seeded["user"])}
        if token == "outsider":
            return {"sub": str(other["user"])}
        raise HTTPException(status_code=401, detail="Invalid token")

    monkeypatch.setattr(main, "verify_token", verify)

    async def outcome(message):
        return await main._authorize_session_socket(FakeSocket(message), live_session)

    assert await outcome(json.dumps({"type": "auth", "token": "member"})) is None
    assert await outcome(json.dumps({"type": "auth", "token": "outsider"})) == main.WS_CLOSE_FORBIDDEN
    assert await outcome(json.dumps({"type": "auth", "token": "garbage"})) == main.WS_CLOSE_UNAUTHENTICATED
    assert await outcome("ping") == main.WS_CLOSE_UNAUTHENTICATED
    assert await outcome(json.dumps({"type": "auth"})) == main.WS_CLOSE_UNAUTHENTICATED
    assert await main._authorize_session_socket(
        FakeSocket(json.dumps({"type": "auth", "token": "member"})), str(uuid.uuid4())
    ) == main.WS_CLOSE_FORBIDDEN


@pytest.mark.asyncio
async def test_socket_that_never_authenticates_is_closed(wired, live_session, monkeypatch):
    import asyncio

    monkeypatch.setattr(main, "WS_AUTH_TIMEOUT_SECONDS", 0.05)

    class Silent:
        async def receive_text(self):
            await asyncio.sleep(5)

    assert await main._authorize_session_socket(Silent(), live_session) == main.WS_CLOSE_UNAUTHENTICATED
