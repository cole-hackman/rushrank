"""
Schema convergence: the tests that would have caught the drift.

Two databases are built from different starting points -- one empty, one
replaying the pre-migrations schema production was created from -- and both must
end up with the same application-relevant shape. These are the highest-value
tests in the repo; every defect in docs/AUDIT-2026-08.md that reached production
would have been caught by one of them.
"""

from __future__ import annotations

import asyncpg
import pytest

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


# Every (table, column) the application actually reads or writes. If a query in
# python_server/ names something, it belongs here. Growing this list is the
# cheapest possible guard against reintroducing schema drift.
REQUIRED_COLUMNS: list[tuple[str, str]] = [
    ("votes", "voter_user_id"), ("votes", "value"), ("votes", "favorite"),
    ("votes", "weight_applied"), ("votes", "voted_at"),
    ("voting_rounds", "room_code"), ("voting_rounds", "selected_pnm_ids"),
    ("voting_rounds", "started_at"), ("voting_rounds", "ended_at"),
    ("voting_rounds", "settings"), ("voting_rounds", "name"),
    ("voting_rounds", "type"), ("voting_rounds", "status"),
    ("pnms", "email"), ("pnms", "phone"), ("pnms", "fun_fact"),
    ("pnms", "walkout_song"), ("pnms", "weirdest_talent"),
    ("pnms", "chick_fil_a_order"), ("pnms", "archived"), ("pnms", "qr_code_url"),
    ("users", "name"), ("users", "is_exec"), ("users", "chapter_id"),
    ("chapters", "theme"), ("chapters", "school"), ("chapters", "fraternity"),
    ("chapters", "domain_allowlist"),
    ("events", "date"), ("events", "type"), ("events", "is_active"),
    ("events", "check_in_code"),
    ("event_attendance", "notes"), ("pnm_notes", "legacy_id"),
    ("audit_log", "action"),
]

REQUIRED_TABLES = [
    "users", "chapters", "memberships", "pnms", "tags", "pnm_tags",
    "voting_rounds", "round_pnms", "votes", "sessions", "events",
    "event_attendance", "pnm_notes", "questionnaires", "pnm_answers",
    "bid_lists", "bid_list_entries", "audit_log",
]


async def _columns(url: str) -> set[tuple[str, str]]:
    conn = await asyncpg.connect(url)
    try:
        rows = await conn.fetch(
            """SELECT table_name, column_name FROM information_schema.columns
               WHERE table_schema = 'public'"""
        )
        return {(r["table_name"], r["column_name"]) for r in rows}
    finally:
        await conn.close()


@pytest.mark.parametrize("fixture_name", ["fresh_db_url", "legacy_db_url"])
async def test_migrations_apply_from_either_origin(fixture_name, request):
    """The whole migration chain applies cleanly from both starting points.

    This failed before the 2026-08 cleanup: 0005 aborted with a dollar-quoting
    syntax error and 0012 with a missing uuid_generate_v4(), which meant
    `supabase/migrations/` did not apply to an empty database at all.
    """
    url = request.getfixturevalue(fixture_name)
    conn = await asyncpg.connect(url)
    try:
        assert await conn.fetchval("SELECT 1") == 1
    finally:
        await conn.close()


@pytest.mark.parametrize("fixture_name", ["fresh_db_url", "legacy_db_url"])
async def test_required_tables_exist(fixture_name, request):
    url = request.getfixturevalue(fixture_name)
    conn = await asyncpg.connect(url)
    try:
        rows = await conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
        )
        present = {r["table_name"] for r in rows}
    finally:
        await conn.close()
    assert not (set(REQUIRED_TABLES) - present), f"missing: {set(REQUIRED_TABLES) - present}"


@pytest.mark.parametrize("fixture_name", ["fresh_db_url", "legacy_db_url"])
async def test_required_columns_exist(fixture_name, request):
    """Every column the application queries exists, from either origin.

    Before the cleanup a legacy-origin database had no `pnms.email` or
    `pnms.phone` at all, so `GET /pnms` -- which selects both -- failed outright.
    """
    url = request.getfixturevalue(fixture_name)
    present = await _columns(url)
    missing = [f"{t}.{c}" for t, c in REQUIRED_COLUMNS if (t, c) not in present]
    assert not missing, f"missing columns: {missing}"


async def test_both_origins_converge(fresh_db_url, legacy_db_url):
    """The two origins agree on every column the application touches.

    They intentionally still differ on deprecated shadows (legacy `attendance`,
    `notes`, `votes.score`, ...) which 0013 keeps so it can be applied while the
    old backend is still running. Those are dropped by the later contract
    migration, not this one.
    """
    fresh = await _columns(fresh_db_url)
    legacy = await _columns(legacy_db_url)
    for table, column in REQUIRED_COLUMNS:
        assert (table, column) in fresh, f"fresh missing {table}.{column}"
        assert (table, column) in legacy, f"legacy missing {table}.{column}"


@pytest.mark.parametrize("fixture_name", ["fresh_db_url", "legacy_db_url"])
async def test_reconciliation_is_idempotent(fixture_name, request, tmp_path):
    """Re-running 0013 changes nothing.

    A reconciliation you cannot safely re-run is one you cannot safely apply to
    a database whose state you are unsure of -- which is the entire situation
    this migration exists to handle.
    """
    from .conftest import MIGRATIONS_DIR

    url = request.getfixturevalue(fixture_name)
    sql = (MIGRATIONS_DIR / "0013_reconcile_schema.sql").read_text()

    before = await _columns(url)
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(sql)
        await conn.execute(sql)
    finally:
        await conn.close()
    assert await _columns(url) == before


async def test_voting_rounds_accepts_the_values_the_api_writes(fresh_db_url):
    """voting_rounds was incompatible with both schemas at once.

    The legacy definition constrained `type` to ('rush','dinner','interview',
    'final') while having room_code/selected_pnm_ids; 0001's had the enum
    ('GENERAL','INVITE','BID') but none of those columns. The API writes
    type='GENERAL' *and* reads all four, so it could not succeed against either.
    This is why live voting was feature-flagged off.
    """
    conn = await asyncpg.connect(fresh_db_url)
    tx = conn.transaction()
    await tx.start()
    try:
        chapter = await conn.fetchval(
            "INSERT INTO chapters (name) VALUES ('ct') RETURNING id"
        )
        row = await conn.fetchrow(
            """INSERT INTO voting_rounds
                 (chapter_id, type, status, room_code, selected_pnm_ids, started_at)
               VALUES ($1, 'GENERAL', 'ACTIVE', 'ZZ9999', '{}', now())
               RETURNING id, type, status, room_code, selected_pnm_ids,
                         started_at, ended_at, created_at""",
            chapter,
        )
        assert row["type"] == "GENERAL"
        assert row["status"] == "ACTIVE"
    finally:
        await tx.rollback()
        await conn.close()


async def test_legacy_vote_scores_map_to_the_right_values(legacy_db_url):
    """score -> value uses the API's mapping, not the one 0005 shipped.

    votes.score is CHECK(1..10). The original 0005 mapped score=1 to YES and
    score=0 to NO, so had it ever run it would have turned every strong
    downvote into a YES and everything else into UNKNOWN. The correct mapping,
    which the API itself uses, is >=7 YES / <=4 NO / else UNKNOWN.

    Seeds its own legacy-shaped rows and re-runs the reconciliation, so it
    cannot pass vacuously on an empty votes table.
    """
    from .conftest import MIGRATIONS_DIR

    recon = (MIGRATIONS_DIR / "0013_reconcile_schema.sql").read_text()
    cases = [(10, "YES"), (7, "YES"), (6, "UNKNOWN"), (5, "UNKNOWN"), (4, "NO"), (1, "NO")]

    conn = await asyncpg.connect(legacy_db_url)
    tx = conn.transaction()
    await tx.start()
    try:
        user = await conn.fetchval(
            "INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'mapper@test.local') RETURNING id"
        )
        chapter = await conn.fetchval("INSERT INTO chapters (name) VALUES ('mapping') RETURNING id")
        rnd = await conn.fetchval(
            """INSERT INTO voting_rounds (chapter_id, type, status, room_code)
               VALUES ($1, 'GENERAL', 'ACTIVE', 'MAP001') RETURNING id""",
            chapter,
        )
        for score, _expected in cases:
            pnm = await conn.fetchval(
                "INSERT INTO pnms (chapter_id, name, major) VALUES ($1, $2, 'CS') RETURNING id",
                chapter, f"PNM {score}",
            )
            # Legacy-shaped write: score only, no `value`.
            await conn.execute(
                """INSERT INTO votes (round_id, pnm_id, voter_id, voter_user_id, score, is_favorite)
                   VALUES ($1, $2, $3, $3, $4, false)""",
                rnd, pnm, user, score,
            )

        await conn.execute(recon)

        rows = await conn.fetch(
            """SELECT v.score, v.value FROM votes v
               WHERE v.round_id = $1 ORDER BY v.score DESC""",
            rnd,
        )
        assert len(rows) == len(cases), "seeded votes went missing during reconciliation"
        actual = {(r["score"], r["value"]) for r in rows}
        assert actual == set(cases), f"unexpected score -> value mapping: {sorted(actual)}"
    finally:
        await tx.rollback()
        await conn.close()


async def test_reconciliation_log_records_what_it_found(legacy_db_url):
    """The log is the deliverable: it is how you learn what production was."""
    conn = await asyncpg.connect(legacy_db_url)
    try:
        rows = await conn.fetch(
            "SELECT step, action FROM schema_reconciliation_log WHERE migration='0013'"
        )
    finally:
        await conn.close()
    steps = {r["step"] for r in rows}
    assert "assertions" in steps
    assert any(s.startswith("votes") for s in steps)
