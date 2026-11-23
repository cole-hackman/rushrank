"""Invitations: find the account by its exact email and leave it as it was."""

import asyncio
import logging
import uuid

import httpx
import pytest
from fastapi import HTTPException

from python_server import services
from python_server.auth_admin import AuthLookupError, find_auth_user_by_email
from python_server.tests.fake_supabase_auth import FakeAuth

CHAPTER = str(uuid.uuid4())
OTHERS = ["newest@test.local", "xnew@test.local", "old@test.local"]


class FakeDb:
    def __init__(self, member=False):
        self.member, self.writes = member, []

    async def execute_one(self, query, *args):
        if "FROM memberships" in query:
            return {"id": "m", "role": "admin"} if self.member else None
        if "memberships" in query:
            self.writes.append((query, args))
            return {"id": "m"}
        return {"name": "Test Chapter"}

    async def execute_command(self, query, *args):
        self.writes.append((query, args))


@pytest.fixture
def invite(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://auth.example.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "unit-test")
    monkeypatch.delenv("MAILERLITE_API_KEY", raising=False)
    monkeypatch.setenv("DEMO_USER_EMAIL", "demo@test.local")

    def run(auth, db, email, role="member"):
        auth.patch(monkeypatch, services.httpx)
        monkeypatch.setattr(services, "get_db", lambda: db)
        return asyncio.run(services.InvitationService().invite_user(email, CHAPTER, role, "inviter"))

    return run


@pytest.mark.parametrize("filters", [True, False])
def test_new_address_gets_a_new_account(invite, filters):
    auth, db = FakeAuth(OTHERS, filters=filters), FakeDb()
    before = {u["id"] for u in auth.users}
    result = invite(auth, db, "new@test.local")
    assert [c["email"] for c in auth.created] == ["new@test.local"]
    assert result["user_created"] and result["user_id"] not in before
    assert auth.updated == []


@pytest.mark.parametrize("filters", [True, False])
def test_existing_account_is_matched_exactly_and_unchanged(invite, filters):
    auth, db = FakeAuth(OTHERS, filters=filters), FakeDb()
    result = invite(auth, db, "Old@Test.local")
    assert result["user_id"] == auth.id_of("old@test.local")
    assert auth.created == [] and auth.updated == []
    assert {args[0] for _, args in db.writes} == {auth.id_of("old@test.local")}


def test_existing_member_keeps_their_role(invite):
    auth, db = FakeAuth(["old@test.local"]), FakeDb(member=True)
    with pytest.raises(HTTPException) as e:
        invite(auth, db, "old@test.local", role="admin")
    assert e.value.status_code == 409
    assert db.writes == [] and auth.updated == []


def test_demo_address_cannot_be_invited(invite):
    auth, db = FakeAuth(["demo@test.local"]), FakeDb()
    with pytest.raises(HTTPException) as e:
        invite(auth, db, "demo@test.local")
    assert e.value.status_code == 409 and db.writes == []


def test_failed_lookup_stops_the_invitation(invite):
    auth, db = FakeAuth(OTHERS, status=500), FakeDb()
    with pytest.raises(HTTPException) as e:
        invite(auth, db, "old@test.local")
    assert e.value.status_code == 502
    assert auth.created == [] and db.writes == []


def _find(auth, email):
    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(auth)) as client:
            return await find_auth_user_by_email(client, "https://auth.example.invalid", "k", email)
    return asyncio.run(go())


def test_lookup_refuses_to_choose_between_duplicates():
    with pytest.raises(AuthLookupError):
        _find(FakeAuth(["a@test.local", "A@test.local"], filters=False), "a@test.local")


def test_lookup_needs_an_email():
    with pytest.raises(AuthLookupError):
        _find(FakeAuth(OTHERS), " ")
