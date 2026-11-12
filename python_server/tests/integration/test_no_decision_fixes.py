"""
Four things that were on the screen and did not work, none needing a product
decision: check-in search, profile names, GPA screens, GPA in CSV mapping.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from python_server import audit, routes, services

pytestmark = pytest.mark.integration


@pytest.fixture
def wired(db_manager, monkeypatch):
    for module in (routes, services, audit):
        monkeypatch.setattr(module, "get_db", lambda: db_manager)
    return db_manager


def me(seeded) -> dict:
    return {"user_id": str(seeded["user"]), "email": "admin@test.local"}


async def roster(seeded, **kwargs):
    defaults = dict(chapter_id=str(seeded["chapter"]), include_archived=False, stage=None, search=None)
    return await routes.get_pnms(**{**defaults, **kwargs}, current_user=me(seeded))


# --- check-in search --------------------------------------------------------

@pytest.mark.asyncio
async def test_search_narrows_the_roster_by_name_or_email(seeded, wired, db):
    await db.execute("UPDATE pnms SET email = 'bob@campus.test' WHERE id = $1", seeded["pnm_b"])

    assert {p["name"] for p in await roster(seeded)} == {"Alice Example", "Bob Example"}
    assert [p["name"] for p in await roster(seeded, search="ali")] == ["Alice Example"]
    assert [p["name"] for p in await roster(seeded, search="ALICE exam")] == ["Alice Example"]
    assert [p["name"] for p in await roster(seeded, search="campus.test")] == ["Bob Example"]
    assert await roster(seeded, search="zzz") == []
    # A word that matches nobody rules the row out even if another word matches.
    assert await roster(seeded, search="alice zzz") == []


@pytest.mark.asyncio
async def test_search_treats_wildcards_as_text(seeded, wired):
    assert await roster(seeded, search="%") == []
    assert await roster(seeded, search="_") == []


# --- profile name -----------------------------------------------------------

@pytest.mark.asyncio
async def test_profile_name_is_saved_and_returned(seeded, wired, db):
    before = await routes.get_current_user_profile(current_user=me(seeded))
    assert before.name is None

    after = await routes.update_current_user_profile(
        routes.ProfileUpdate(name="  Sam   Rivera "), current_user=me(seeded)
    )
    assert after.name == "Sam Rivera"
    assert await db.fetchval("SELECT name FROM users WHERE id = $1", seeded["user"]) == "Sam Rivera"

    with pytest.raises(ValidationError):
        routes.ProfileUpdate(name="")
    with pytest.raises(HTTPException) as exc:
        await routes.update_current_user_profile(routes.ProfileUpdate(name="   "), current_user=me(seeded))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_signed_note_shows_the_authors_name_once_set(seeded, wired, db):
    from python_server.models import NoteCreate

    svc = services.NoteService()
    await svc.create_note(NoteCreate(pnm_id=str(seeded["pnm_a"]), body="Solid", anonymous=False), str(seeded["user"]))
    [note] = await svc.list_notes(str(seeded["pnm_a"]))
    assert note.author == "admin@test.local"

    await db.execute("UPDATE users SET name = 'Sam Rivera' WHERE id = $1", seeded["user"])
    [note] = await svc.list_notes(str(seeded["pnm_a"]))
    assert note.author == "Sam Rivera"


# --- GPA --------------------------------------------------------------------

@pytest.mark.asyncio
async def test_minimum_gpa_can_be_read_by_a_member_and_only_by_a_member(seeded, wired, db):
    chapter = str(seeded["chapter"])
    assert await routes.get_chapter_min_gpa(chapter, current_user=me(seeded)) == {"min_gpa": None}
    await db.execute("UPDATE chapters SET min_gpa = 2.75 WHERE id = $1", seeded["chapter"])
    assert await routes.get_chapter_min_gpa(chapter, current_user=me(seeded)) == {"min_gpa": 2.75}

    stranger = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'stranger@test.local')", stranger)
    with pytest.raises(HTTPException) as exc:
        await routes.get_chapter_min_gpa(chapter, current_user={"user_id": str(stranger), "email": "s"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_pnm_page_gets_the_minimum_and_where_the_pnm_stands(seeded, wired, db):
    pnm = str(seeded["pnm_a"])

    async def standing():
        row = await routes.get_pnm(pnm, current_user=me(seeded))
        return row["eligibility"], row["min_gpa"]

    assert await standing() == ("no_minimum", None)
    await db.execute("UPDATE chapters SET min_gpa = 2.5 WHERE id = $1", seeded["chapter"])
    assert (await standing())[0] == "unknown"
    await db.execute("UPDATE pnms SET gpa = 2.4 WHERE id = $1", seeded["pnm_a"])
    assert await standing() == ("below", 2.5)
    await db.execute("UPDATE pnms SET gpa = 3.1 WHERE id = $1", seeded["pnm_a"])
    assert (await standing())[0] == "eligible"
    await db.execute("UPDATE pnms SET gpa = 2.4 WHERE id = $1", seeded["pnm_a"])
    await routes.set_gpa_waiver(
        pnm, routes.GpaWaiverRequest(waived=True, reason="Transfer credits pending"), current_user=me(seeded)
    )
    assert (await standing())[0] == "waived"
