"""
The read-only demo account.

A prospective chapter needs to click through a populated RushRank before they
will consider running rush on it, and a demo that a visitor can empty is a demo
that stops working the first afternoon someone finds it.

Enforcement lives in `auth.get_current_user` rather than in middleware, because
that is the one place every protected route already passes through with the JWT
decoded. These tests pin the property that matters: reads work, writes do not,
and a real member is unaffected.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


class _Req:
    """The two attributes get_current_user reads off the request."""

    def __init__(self, method: str):
        self.method = method


@pytest.fixture
def auth_mod(db_manager, monkeypatch):
    from python_server import auth, database

    monkeypatch.setattr(database, "get_db", lambda: db_manager)
    auth._observer_cache.clear()
    auth._user_sync_cache.clear()
    return auth


async def _member(db, chapter_id, role: str) -> uuid.UUID:
    uid = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, $2)", uid, f"{uid}@test.local")
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, $3)",
        uid, chapter_id, role,
    )
    return uid


@pytest.mark.asyncio
async def test_an_observer_only_user_is_flagged(seeded, db, auth_mod):
    observer = await _member(db, seeded["chapter"], "observer")
    assert await auth_mod._is_observer_only(str(observer)) is True


@pytest.mark.asyncio
async def test_a_real_member_is_not(seeded, db, auth_mod):
    member = await _member(db, seeded["chapter"], "member")
    assert await auth_mod._is_observer_only(str(member)) is False
    assert await auth_mod._is_observer_only(str(seeded["user"])) is False


@pytest.mark.asyncio
async def test_a_user_with_no_memberships_is_not_an_observer(db, auth_mod):
    """Mid-signup. Their next request is provisioning a chapter -- a write."""
    stranger = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'new@test.local')", stranger)
    assert await auth_mod._is_observer_only(str(stranger)) is False


@pytest.mark.asyncio
async def test_observer_in_one_chapter_and_member_in_another_can_still_write(seeded, db, auth_mod):
    """Being shown someone else's chapter must not make you read-only in yours."""
    uid = await _member(db, seeded["chapter"], "observer")
    other = await db.fetchval("INSERT INTO chapters (name) VALUES ('Real') RETURNING id")
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'admin')", uid, other
    )
    assert await auth_mod._is_observer_only(str(uid)) is False


@pytest.mark.asyncio
async def test_writes_are_rejected_and_reads_are_not(seeded, db, auth_mod, monkeypatch):
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    observer = await _member(db, seeded["chapter"], "observer")

    async def fake_verify(_token):
        return {"sub": str(observer), "email": "demo@rushrank.app"}

    monkeypatch.setattr(auth_mod, "verify_token", fake_verify)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    user = await auth_mod.get_current_user(_Req("GET"), creds)
    assert user["user_id"] == str(observer)

    for method in ("POST", "PUT", "PATCH", "DELETE"):
        with pytest.raises(HTTPException) as exc:
            await auth_mod.get_current_user(_Req(method), creds)
        assert exc.value.status_code == 403
        assert "read-only" in exc.value.detail


@pytest.mark.asyncio
async def test_an_admin_writes_freely(seeded, auth_mod, monkeypatch):
    from fastapi.security import HTTPAuthorizationCredentials

    async def fake_verify(_token):
        return {"sub": str(seeded["user"]), "email": "admin@test.local"}

    monkeypatch.setattr(auth_mod, "verify_token", fake_verify)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    user = await auth_mod.get_current_user(_Req("POST"), creds)
    assert user["user_id"] == str(seeded["user"])


@pytest.mark.asyncio
async def test_optional_auth_threads_the_request_through(seeded, db, auth_mod, monkeypatch):
    """get_optional_user delegates; if it dropped the request it would be a
    write hole straight through the read-only guard."""
    from fastapi.security import HTTPAuthorizationCredentials

    observer = await _member(db, seeded["chapter"], "observer")

    async def fake_verify(_token):
        return {"sub": str(observer), "email": "demo@rushrank.app"}

    monkeypatch.setattr(auth_mod, "verify_token", fake_verify)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="x")

    assert await auth_mod.get_optional_user(_Req("GET"), creds) is not None
    # A rejected observer surfaces as "no user", never as an authorised writer.
    assert await auth_mod.get_optional_user(_Req("POST"), creds) is None
