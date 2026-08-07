"""
The self-serve signup path, which could not complete for two independent reasons.

Nothing ever synced Supabase `auth.users` into `public.users` -- no trigger
existed, and the only `INSERT INTO users` lived inside the admin invite flow.
So a magic-link signup had an auth row and no local row, which meant a
foreign-key violation the moment chapter provisioning inserted the membership,
and a 404 from `GET /me`. (The other reason was front-end: the token was
snapshotted into localStorage by the password form only.)
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_membership_requires_a_local_user_row(db):
    """The failure mode, stated as a test.

    Provisioning inserts a membership for the authenticated user. Without a
    `public.users` row that is a foreign-key violation, which is exactly what a
    brand-new magic-link signup hit.
    """
    import asyncpg

    chapter = await db.fetchval("INSERT INTO chapters (name) VALUES ('fk') RETURNING id")
    orphan = uuid.uuid4()  # exists in auth.users, never synced locally

    with pytest.raises(asyncpg.ForeignKeyViolationError):
        await db.execute(
            "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'admin')",
            orphan, chapter,
        )


@pytest.mark.asyncio
async def test_ensure_user_row_creates_then_updates(db, db_manager, monkeypatch):
    """ensure_user_row is the authoritative sync, called on every request."""
    from python_server import auth

    monkeypatch.setattr("python_server.database.get_db", lambda: db_manager)
    auth._user_sync_cache.clear()

    uid = str(uuid.uuid4())
    await auth.ensure_user_row(uid, "new@test.local")
    assert await db.fetchval("SELECT email FROM users WHERE id = $1", uid) == "new@test.local"

    # Email changes upstream should follow.
    auth._user_sync_cache.clear()
    await auth.ensure_user_row(uid, "changed@test.local")
    assert await db.fetchval("SELECT email FROM users WHERE id = $1", uid) == "changed@test.local"


@pytest.mark.asyncio
async def test_ensure_user_row_is_cached(db, db_manager, monkeypatch):
    """One statement per user per TTL, not one per request."""
    from python_server import auth

    calls = {"n": 0}
    original = db_manager.execute_command

    async def counting(*args, **kwargs):
        calls["n"] += 1
        return await original(*args, **kwargs)

    db_manager.execute_command = counting
    monkeypatch.setattr("python_server.database.get_db", lambda: db_manager)
    auth._user_sync_cache.clear()

    uid = str(uuid.uuid4())
    for _ in range(5):
        await auth.ensure_user_row(uid, "cached@test.local")
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_ensure_user_row_survives_a_conflicting_email(db, db_manager, monkeypatch):
    """An invited-then-signed-up user has a local row under a different id.

    That trips the unique constraint on email. It must not lock the user out of
    every subsequent request -- 0013's reconciliation repoints those rows.
    """
    from python_server import auth

    monkeypatch.setattr("python_server.database.get_db", lambda: db_manager)
    auth._user_sync_cache.clear()

    invited = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'dup@test.local')", invited)

    # Same email, different id -- must not raise.
    await auth.ensure_user_row(str(uuid.uuid4()), "dup@test.local")

    assert await db.fetchval("SELECT COUNT(*) FROM users WHERE email = 'dup@test.local'") == 1


@pytest.mark.asyncio
async def test_provisioning_succeeds_once_the_user_row_exists(db, db_manager, monkeypatch):
    """The end-to-end shape of a self-serve signup."""
    from python_server import auth, services

    monkeypatch.setattr("python_server.database.get_db", lambda: db_manager)
    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    auth._user_sync_cache.clear()

    uid = str(uuid.uuid4())
    await auth.ensure_user_row(uid, "founder@test.local")

    svc = services.ChapterService()
    result = await svc.provision_chapter(
        user_id=uid,
        fraternity_name="Sigma Chi",
        school="Cal Poly",
        chapter_name="Sigma Chi at Cal Poly",
        admin_name="Founder",
    )
    chapter_id = result["chapter_id"]

    assert await db.fetchval(
        "SELECT role FROM memberships WHERE user_id = $1 AND chapter_id = $2", uid, chapter_id
    ) == "admin"
    assert await db.fetchval("SELECT name FROM users WHERE id = $1", uid) == "Founder"

    # Idempotent: clicking the magic link twice must not mint a second chapter.
    again = await svc.provision_chapter(
        user_id=uid,
        fraternity_name="Sigma Chi",
        school="Cal Poly",
        chapter_name="Sigma Chi at Cal Poly",
        admin_name="Founder",
    )
    assert again["chapter_id"] == chapter_id
    assert await db.fetchval("SELECT COUNT(*) FROM chapters WHERE id = $1", chapter_id) == 1


@pytest.mark.asyncio
async def test_public_chapter_lookup_exposes_only_safe_fields(seeded, db):
    """The public intake form needs a chapter name and theme -- nothing else."""
    row = await db.fetchrow(
        "SELECT id, name, theme FROM chapters WHERE id = $1", seeded["chapter"]
    )
    assert row["name"] == "Test Chapter"
    assert set(row.keys()) == {"id", "name", "theme"}


@pytest.mark.asyncio
async def test_public_intake_can_create_a_pnm_without_a_major(seeded, db):
    """A PNM at a rush table may not fill in every field.

    `pnms.major` was NOT NULL on the legacy schema; 0013 relaxed it so public
    intake and CSV import can succeed with partial data.
    """
    pnm = await db.fetchval(
        """INSERT INTO pnms (chapter_id, name, email, phone)
           VALUES ($1, 'Walk Up', 'walkup@test.local', '555-0100')
           RETURNING id""",
        seeded["chapter"],
    )
    row = await db.fetchrow("SELECT name, major, photo_url FROM pnms WHERE id = $1", pnm)
    assert row["name"] == "Walk Up"
    assert row["major"] is None
    assert row["photo_url"] is None
