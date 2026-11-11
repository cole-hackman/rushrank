"""
Migration 0019: no table in `public` is readable with Supabase's public key.

A plain Postgres has no `anon` role, so this test creates one, grants it what
Supabase grants by default, re-runs the migration and then reads as that role.
"""

from __future__ import annotations

import pathlib

import asyncpg
import pytest

pytestmark = pytest.mark.integration

MIGRATION = (
    pathlib.Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "0019_rls_deny_all.sql"
)


@pytest.mark.asyncio
async def test_every_public_table_has_row_level_security(db):
    without = await db.fetch(
        """SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity"""
    )
    assert [r["relname"] for r in without] == []


@pytest.mark.asyncio
async def test_public_key_role_can_read_nothing(seeded, db):
    await db.execute(
        """DO $$ BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
               CREATE ROLE anon NOLOGIN;
             END IF;
           END $$"""
    )
    # What a Supabase project grants out of the box.
    await db.execute("GRANT USAGE ON SCHEMA public TO anon")
    await db.execute("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon")
    await db.execute(MIGRATION.read_text())

    assert await db.fetchval("SELECT COUNT(*) FROM pnms") == 2  # the owner still sees rows

    await db.execute("SET LOCAL ROLE anon")
    for relation in ("pnms", "users", "votes", "pnm_notes", "sessions", "v_votes_public", "v_round_rankings"):
        await db.execute("SAVEPOINT probe")
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            await db.fetch(f"SELECT * FROM {relation} LIMIT 1")
        await db.execute("ROLLBACK TO SAVEPOINT probe")
    await db.execute("RESET ROLE")


@pytest.mark.asyncio
async def test_row_level_security_alone_hides_rows_from_a_granted_role(seeded, db):
    """Belt and braces: even if a grant comes back, a table with no policy returns nothing."""
    await db.execute(
        """DO $$ BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
               CREATE ROLE anon NOLOGIN;
             END IF;
           END $$"""
    )
    await db.execute("GRANT USAGE ON SCHEMA public TO anon")
    await db.execute("GRANT SELECT ON pnms, tags TO anon")
    await db.execute("SET LOCAL ROLE anon")
    assert await db.fetchval("SELECT COUNT(*) FROM pnms") == 0
    assert await db.fetchval("SELECT COUNT(*) FROM tags") == 0
    await db.execute("RESET ROLE")
