"""
Two things competitors have and RushRank lacked: a PNM checking himself in
from the event's QR code, and one message to a set of PNMs.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from python_server import audit, email_sender, main, routes, services

pytestmark = pytest.mark.integration


@pytest.fixture
def wired(db_manager, monkeypatch):
    for module in (routes, services, audit, main):
        monkeypatch.setattr(module, "get_db", lambda: db_manager)
    monkeypatch.setattr(routes.limiter, "enabled", False)
    for var in ("SMTP_HOST", "EMAIL_FROM"):
        monkeypatch.delenv(var, raising=False)
    return db_manager


def me(seeded) -> dict:
    return {"user_id": str(seeded["user"]), "email": "admin@test.local"}


def request(path="/api/v1/public/events/x") -> Request:
    return Request({"type": "http", "method": "POST", "path": path, "headers": [],
                    "client": ("203.0.113.9", 1), "query_string": b"", "app": main.app})


# --- self check-in ----------------------------------------------------------

@pytest.mark.asyncio
async def test_event_gets_a_code_once_and_the_link_points_at_the_site(seeded, wired, db, monkeypatch):
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://rush.example.test")
    event = str(seeded["event"])
    first = await routes.get_self_check_in(event, current_user=me(seeded))
    second = await routes.get_self_check_in(event, current_user=me(seeded))
    assert first == second
    assert len(first["code"]) == 6
    assert first["url"] == f"https://rush.example.test/checkin?e={event}&c={first['code']}"

    png = await routes.get_self_check_in_qr(event, current_user=me(seeded))
    assert png.media_type == "image/png" and png.body[1:4] == b"PNG"

    stranger = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'stranger@test.local')", stranger)
    with pytest.raises(HTTPException) as exc:
        await routes.get_self_check_in(event, current_user={"user_id": str(stranger), "email": "s"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_pnm_checks_himself_in_with_the_code_and_his_email(seeded, wired, db):
    event = str(seeded["event"])
    await db.execute("UPDATE pnms SET email = 'Alice@Campus.test' WHERE id = $1", seeded["pnm_a"])
    code = (await routes.get_self_check_in(event, current_user=me(seeded)))["code"]

    shown = await routes.public_event(request(), event, code=code.lower())
    assert shown["event_name"] == "Smoker" and shown["chapter_name"] == "Test Chapter"

    done = await routes.public_self_check_in(request(), event, routes.SelfCheckIn(code=code, email=" alice@campus.TEST "))
    assert done == {"status": "checked_in", "first_name": "Alice", "event_name": "Smoker"}
    row = await db.fetchrow(
        "SELECT method::text AS method, checked_in_by_user_id FROM event_attendance WHERE event_id = $1 AND pnm_id = $2",
        seeded["event"], seeded["pnm_a"],
    )
    assert (row["method"], row["checked_in_by_user_id"]) == ("SELF", None)

    again = await routes.public_self_check_in(request(), event, routes.SelfCheckIn(code=code, email="alice@campus.test"))
    assert again["status"] == "already_checked_in"
    assert await db.fetchval("SELECT COUNT(*) FROM event_attendance WHERE event_id = $1", seeded["event"]) == 1


@pytest.mark.asyncio
async def test_self_check_in_refuses_a_wrong_code_an_unknown_email_and_another_chapters_pnm(seeded, wired, db):
    event = str(seeded["event"])
    code = (await routes.get_self_check_in(event, current_user=me(seeded)))["code"]
    other_chapter, outsider = uuid.uuid4(), uuid.uuid4()
    await db.execute("INSERT INTO chapters (id, name) VALUES ($1, 'Other Chapter')", other_chapter)
    await db.execute(
        "INSERT INTO pnms (id, chapter_id, name, major, email) VALUES ($1, $2, 'Otto Other', 'Math', 'otto@campus.test')",
        outsider, other_chapter,
    )
    await db.execute("UPDATE pnms SET email = 'bob@campus.test', archived = true WHERE id = $1", seeded["pnm_b"])

    async def refused(code_, email):
        with pytest.raises(HTTPException) as exc:
            await routes.public_self_check_in(request(), event, routes.SelfCheckIn(code=code_, email=email))
        return exc.value.status_code, exc.value.detail

    assert (await refused("WRONG1", "otto@campus.test"))[0] == 404
    assert await refused(code, "nobody@campus.test") == (404, "not_on_roster")
    assert await refused(code, "otto@campus.test") == (404, "not_on_roster")   # another chapter's PNM
    assert await refused(code, "bob@campus.test") == (404, "not_on_roster")    # archived
    with pytest.raises(HTTPException) as exc:
        await routes.public_event(request(), event, code="WRONG1")
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await routes.public_event(request(), "not-a-uuid", code=code)
    assert exc.value.status_code == 404

    await db.execute("UPDATE events SET is_active = false WHERE id = $1", seeded["event"])
    assert (await refused(code, "otto@campus.test"))[0] == 404
    assert await db.fetchval("SELECT COUNT(*) FROM event_attendance") == 0


# --- messages to PNMs -------------------------------------------------------

async def post(seeded, **body):
    return await routes.message_pnms(
        request("/api/v1/chapters/x/pnm-messages"), str(seeded["chapter"]), routes.PnmMessage(**body),
        current_user=me(seeded),
    )


@pytest.mark.asyncio
async def test_dry_run_says_who_would_get_it_and_sends_nothing(seeded, wired, db, monkeypatch):
    await db.execute("UPDATE pnms SET email = 'alice@campus.test' WHERE id = $1", seeded["pnm_a"])
    stranger_pnm = str(uuid.uuid4())

    called = []
    monkeypatch.setattr(email_sender, "send_individually", lambda *a, **k: called.append(a))
    result = await post(seeded, pnm_ids=[str(seeded["pnm_a"]), str(seeded["pnm_b"]), stranger_pnm], dry_run=True)
    assert result == {
        "recipients": 1, "without_email": 1, "not_found": 1, "email_configured": False,
        "emails": ["alice@campus.test"], "sent": 0,
    }
    assert called == []


@pytest.mark.asyncio
async def test_sending_needs_configuration_content_and_the_right_role(seeded, wired, db):
    await db.execute("UPDATE pnms SET email = 'alice@campus.test' WHERE id = $1", seeded["pnm_a"])
    ids = [str(seeded["pnm_a"])]

    with pytest.raises(HTTPException) as exc:
        await post(seeded, pnm_ids=ids, subject="", message="Hi")
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException) as exc:
        await post(seeded, pnm_ids=ids, subject="Thursday", message="Sports night, 7pm")
    assert exc.value.status_code == 503

    member = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'mo@test.local')", member)
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'member')", member, seeded["chapter"]
    )
    with pytest.raises(HTTPException) as exc:
        await routes.message_pnms(
            request(), str(seeded["chapter"]), routes.PnmMessage(pnm_ids=ids, dry_run=True),
            current_user={"user_id": str(member), "email": "mo@test.local"},
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_configured_server_sends_one_email_each_and_logs_it(seeded, wired, db, monkeypatch):
    await db.execute("UPDATE pnms SET email = 'alice@campus.test' WHERE id = $1", seeded["pnm_a"])
    await db.execute("UPDATE pnms SET email = 'ALICE@campus.test' WHERE id = $1", seeded["pnm_b"])  # same inbox
    monkeypatch.setenv("SMTP_HOST", "smtp.example.test")
    monkeypatch.setenv("EMAIL_FROM", "RushRank <rush@example.test>")

    delivered = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            assert (host, port) == ("smtp.example.test", 587)

        def starttls(self, context=None):
            pass

        def send_message(self, msg):
            delivered.append(msg)

        def quit(self):
            pass

    monkeypatch.setattr(email_sender.smtplib, "SMTP", FakeSMTP)

    result = await post(
        seeded, pnm_ids=[str(seeded["pnm_a"]), str(seeded["pnm_b"])], subject=" Thursday ", message="Sports night, 7pm"
    )
    assert (result["recipients"], result["sent"], result["failed"]) == (1, 1, 0)
    [msg] = delivered
    assert msg["To"] == "alice@campus.test"
    assert msg["Subject"] == "Thursday"
    assert msg["Reply-To"] == "admin@test.local"
    assert msg["From"] == "Test Chapter <rush@example.test>"
    assert "Sports night, 7pm" in msg.get_content()
    assert await db.fetchval("SELECT COUNT(*) FROM audit_log WHERE action = 'pnm.message'") == 1
