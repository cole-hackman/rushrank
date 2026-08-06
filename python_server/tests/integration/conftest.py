"""
Integration-test fixtures: a real Postgres, real migrations, real SQL.

Why this exists
---------------
The 81 unit tests in this repo are entirely mock-based. A mock cannot know that
a table does not exist, so none of them could ever have caught the defects that
docs/AUDIT-2026-08.md found: queries against tables the migrations never create,
a migration that failed with a syntax error on every run, and a `voting_rounds`
definition that was incompatible with both committed schemas simultaneously.

These fixtures apply the real migrations to a real database and run the real
queries. That is the only kind of test that can catch this class of bug.

Running locally
---------------
    docker run -d --name rr-test -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
    export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
    cd python_server && pytest -m integration

Without TEST_DATABASE_URL set, every test in this directory is skipped, so the
default `pytest` run stays fast and dependency-free.
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import threading
import uuid

import asyncpg
import pytest
import pytest_asyncio

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[3] / "supabase" / "migrations"
LEGACY_SCHEMA = (
    pathlib.Path(__file__).resolve().parents[3]
    / "supabase"
    / "legacy"
    / "schema_pre_migrations.sql"
)


def _require_test_db() -> str:
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set; skipping integration tests")
    return url


def migration_files() -> list[pathlib.Path]:
    """Migrations in lexical order, which is also numeric order here."""
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


async def apply_migrations(conn: asyncpg.Connection) -> None:
    for path in migration_files():
        sql = path.read_text()
        try:
            await conn.execute(sql)
        except Exception as exc:  # pragma: no cover - surfaced as a test failure
            raise AssertionError(f"migration {path.name} failed to apply: {exc}") from exc


async def apply_legacy_schema(conn: asyncpg.Connection) -> None:
    """Replay the pre-migrations schema.

    This is the fixture that proves 0013 can heal a production database. The
    legacy file references the Supabase `auth` schema, which a bare Postgres
    does not have, so those statements are skipped individually rather than
    aborting the whole file.
    """
    await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    sql = LEGACY_SCHEMA.read_text()

    applied = 0
    for statement in _split_statements(sql):
        if "auth." in statement or "ROW LEVEL SECURITY" in statement or "POLICY" in statement:
            continue
        await conn.execute(statement)
        applied += 1

    # The fixture is worthless if it silently fails to reproduce the legacy
    # shape -- the tests would still pass while proving nothing. Assert the
    # distinguishing artifacts actually exist.
    for table in ("attendance", "notes"):
        exists = await conn.fetchval("SELECT to_regclass($1)", f"public.{table}")
        assert exists is not None, (
            f"legacy fixture did not create `{table}` ({applied} statements applied); "
            "the pre-migrations schema was not reproduced"
        )
    has_score = await conn.fetchval(
        """SELECT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'votes' AND column_name = 'score')"""
    )
    assert has_score, "legacy fixture did not create the legacy votes shape"


def _split_statements(sql: str) -> list[str]:
    """Split on `;` and strip leading comment lines from each statement.

    The legacy schema has no dollar-quoted bodies, so splitting on `;` is safe.
    Stripping leading comments matters: nearly every statement in that file is
    preceded by one, and discarding those chunks wholesale silently skipped most
    of the schema.
    """
    statements: list[str] = []
    for chunk in sql.split(";"):
        lines = [
            line for line in chunk.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        statement = "\n".join(lines).strip()
        if statement:
            statements.append(statement)
    return statements


async def _create_database(admin_url: str, name: str) -> str:
    conn = await asyncpg.connect(admin_url)
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{name}"')
        await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()
    base, _, _ = admin_url.rpartition("/")
    return f"{base}/{name}"


async def _build(admin_url: str, name: str, legacy: bool) -> str:
    url = await _create_database(admin_url, name)
    conn = await asyncpg.connect(url)
    try:
        if legacy:
            await apply_legacy_schema(conn)
        await apply_migrations(conn)
    finally:
        await conn.close()
    return url


def _run_sync(coro):
    """Run a coroutine to completion on its own loop, on its own thread.

    The session fixtures below are synchronous so they can be resolved through
    request.getfixturevalue() (which the convergence tests use to run the same
    assertions against both origins). asyncio.run() cannot be called from inside
    pytest-asyncio's already-running loop, so the work is handed to a dedicated
    thread with a fresh loop.
    """
    box: dict[str, object] = {}

    def runner() -> None:
        loop = asyncio.new_event_loop()
        try:
            box["value"] = loop.run_until_complete(coro)
        except BaseException as exc:  # noqa: BLE001 - re-raised on the caller's thread
            box["error"] = exc
        finally:
            loop.close()

    thread = threading.Thread(target=runner)
    thread.start()
    thread.join()
    if "error" in box:
        raise box["error"]  # type: ignore[misc]
    return box["value"]


@pytest.fixture(scope="session")
def fresh_db_url() -> str:
    """A database built from an empty start: migrations only."""
    return _run_sync(_build(_require_test_db(), "rr_it_fresh", legacy=False))


@pytest.fixture(scope="session")
def legacy_db_url() -> str:
    """A database built the way production was: legacy schema, then migrations."""
    return _run_sync(_build(_require_test_db(), "rr_it_legacy", legacy=True))


@pytest_asyncio.fixture
async def db(fresh_db_url: str):
    """A connection wrapped in a transaction that is rolled back after each test.

    Rollback rather than truncation: ~50x faster, and nothing in the application
    issues an explicit COMMIT, so behaviour is unaffected.
    """
    conn = await asyncpg.connect(fresh_db_url)
    tx = conn.transaction()
    await tx.start()
    try:
        yield conn
    finally:
        await tx.rollback()
        await conn.close()


class _TxDatabaseManager:
    """Mirrors python_server.database.DatabaseManager over a single connection."""

    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def execute_query(self, query: str, *args):
        return await self.conn.fetch(query, *args)

    async def execute_one(self, query: str, *args):
        return await self.conn.fetchrow(query, *args)

    async def execute_command(self, query: str, *args):
        return await self.conn.execute(query, *args)


@pytest.fixture
def db_manager(db):
    """Drop-in replacement for get_db() bound to the rolled-back transaction."""
    return _TxDatabaseManager(db)


@pytest_asyncio.fixture
async def seeded(db):
    """A minimal but realistic chapter: admin user, two PNMs, an event, a round."""
    ids = {
        "user": uuid.uuid4(),
        "chapter": uuid.uuid4(),
        "pnm_a": uuid.uuid4(),
        "pnm_b": uuid.uuid4(),
        "event": uuid.uuid4(),
        "round": uuid.uuid4(),
    }
    await db.execute("INSERT INTO users (id, email) VALUES ($1, $2)", ids["user"], "admin@test.local")
    await db.execute("INSERT INTO chapters (id, name) VALUES ($1, $2)", ids["chapter"], "Test Chapter")
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'admin')",
        ids["user"], ids["chapter"],
    )
    for key, name in (("pnm_a", "Alice Example"), ("pnm_b", "Bob Example")):
        await db.execute(
            "INSERT INTO pnms (id, chapter_id, name, major) VALUES ($1, $2, $3, 'CS')",
            ids[key], ids["chapter"], name,
        )
    await db.execute(
        "INSERT INTO events (id, chapter_id, name, date) VALUES ($1, $2, 'Smoker', now())",
        ids["event"], ids["chapter"],
    )
    await db.execute(
        """INSERT INTO voting_rounds (id, chapter_id, type, status, room_code, selected_pnm_ids)
           VALUES ($1, $2, 'GENERAL', 'ACTIVE', 'RR0001', $3)""",
        ids["round"], ids["chapter"], [str(ids["pnm_a"]), str(ids["pnm_b"])],
    )
    await db.execute(
        "INSERT INTO round_pnms (round_id, pnm_id, order_index) VALUES ($1, $2, 0), ($1, $3, 1)",
        ids["round"], ids["pnm_a"], ids["pnm_b"],
    )
    return ids
