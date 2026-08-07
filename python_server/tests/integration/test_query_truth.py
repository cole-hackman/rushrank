"""
One test per defect fixed by the query-truth pass.

Each of these fails against the pre-fix code and passes after. They exercise the
service layer against a real database, which is the only way to catch queries
that name tables or columns the migrations do not create -- the class of bug
that produced every P0 in docs/AUDIT-2026-08.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import asyncpg
import pytest

from python_server import models

# asyncio is applied per-test rather than file-wide; the model tests are sync.
pytestmark = pytest.mark.integration


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------

def test_bulk_archive_accepts_the_body_the_frontend_sends():
    """Four vote-statistic fields had landed on BulkArchiveRequest.

    The PNMs page posts only {pnm_ids, archived}; the model demanded
    dont_know_count, favorite_count, yes_percentage and controversy_score as
    well, so every bulk archive returned 422.
    """
    req = models.BulkArchiveRequest(pnm_ids=[str(uuid.uuid4())], archived=True)
    assert req.archived is True
    assert set(models.BulkArchiveRequest.model_fields) == {"pnm_ids", "archived"}


def test_pnm_with_votes_declares_the_statistics_it_is_given():
    """Undeclared kwargs are silently dropped by Pydantic.

    get_round_results computes all four in SQL and passes them to the model; if
    the model does not declare them the results endpoint returns 0% for every
    PNM even once the underlying query works.
    """
    for field in ("dont_know_count", "favorite_count", "yes_percentage", "controversy_score"):
        assert field in models.PNMWithVotes.model_fields, field


def test_pnm_tolerates_the_columns_a_query_omits():
    """`Optional[str]` without a default is *required* in Pydantic v2.

    get_round_results never selects email/phone/fun_fact, and GET /pnms/{id}
    selects p.* which has no walkout_song column -- both raised ValidationError
    on every row until these gained explicit `= None` defaults.
    """
    pnm = models.PNM(
        id=str(uuid.uuid4()),
        chapter_id=str(uuid.uuid4()),
        name="No Major",
        created_at=datetime.now(timezone.utc),
    )
    assert pnm.major is None and pnm.email is None and pnm.fun_fact is None
    assert pnm.tags == []


def test_round_enums_reject_the_legacy_vocabulary():
    """create_round binds `round_data.type.value` straight into the INSERT.

    Leaving 'rush'/'completed' in the enums would let a client write a value the
    CHECK constraint rejects.
    """
    for bad in ("rush", "dinner", "interview", "final"):
        with pytest.raises(ValueError):
            models.RoundType(bad)
    for bad in ("pending", "completed"):
        with pytest.raises(ValueError):
            models.RoundStatus(bad)


# --------------------------------------------------------------------------
# Schema-level behaviour
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_legacy_round_vocabulary_is_normalized_on_write(db):
    """0013 adds a CHECK on voting_rounds.type/status.

    The currently-deployed backend still writes status='active' and
    status='completed', so without the normalizing trigger, applying 0013 would
    start failing those writes -- the exact outage the additive-only design is
    meant to prevent.
    """
    chapter = await db.fetchval("INSERT INTO chapters (name) VALUES ('vocab') RETURNING id")
    await db.execute(
        """INSERT INTO voting_rounds (chapter_id, type, status, room_code)
           VALUES ($1, 'rush', 'active', 'VOCAB1')""",
        chapter,
    )
    row = await db.fetchrow("SELECT type, status FROM voting_rounds WHERE room_code = 'VOCAB1'")
    assert (row["type"], row["status"]) == ("GENERAL", "ACTIVE")

    await db.execute("UPDATE voting_rounds SET status = 'completed' WHERE room_code = 'VOCAB1'")
    assert await db.fetchval("SELECT status FROM voting_rounds WHERE room_code = 'VOCAB1'") == "ENDED"


@pytest.mark.asyncio
async def test_check_in_roster_reads_the_table_that_is_written(seeded, db):
    """The roster read `attendance`; check-in writes `event_attendance`.

    On a migrated database `attendance` does not exist at all, so the Rush page
    -- which polls this every five seconds -- got nothing back.
    """
    await db.execute(
        """INSERT INTO event_attendance (event_id, pnm_id, checked_in_by_user_id, method)
           VALUES ($1, $2, $3, 'SEARCH')""",
        seeded["event"], seeded["pnm_a"], seeded["user"],
    )
    rows = await db.fetch(
        """SELECT a.pnm_id, a.checked_in_at, a.checked_in_by_user_id, a.notes,
                  p.name as pnm_name, p.photo_url as pnm_photo_url
           FROM event_attendance a
           JOIN pnms p ON p.id = a.pnm_id
           WHERE a.event_id = $1""",
        seeded["event"],
    )
    assert len(rows) == 1
    assert rows[0]["pnm_name"] == "Alice Example"


@pytest.mark.asyncio
async def test_pnm_attendance_history_exposes_event_fields(seeded, db):
    """A different shape from the event roster: the PNM detail page reads
    event_name / event_date, not pnm_name / pnm_photo_url."""
    await db.execute(
        "INSERT INTO event_attendance (event_id, pnm_id, method) VALUES ($1, $2, 'SEARCH')",
        seeded["event"], seeded["pnm_a"],
    )
    row = await db.fetchrow(
        """SELECT a.checked_in_at, e.name as event_name, e.date as event_date
           FROM event_attendance a
           JOIN events e ON e.id = a.event_id
           WHERE a.pnm_id = $1""",
        seeded["pnm_a"],
    )
    assert row["event_name"] == "Smoker"
    assert row["event_date"] is not None


@pytest.mark.asyncio
async def test_pnm_list_counts_attendance_from_the_canonical_table(seeded, db):
    """Auto-check-in on PNM creation wrote only the legacy table, so those
    check-ins never appeared in the PNM list's attendance_count."""
    await db.execute(
        "INSERT INTO event_attendance (event_id, pnm_id, method) VALUES ($1, $2, 'SEARCH')",
        seeded["event"], seeded["pnm_a"],
    )
    count = await db.fetchval(
        """SELECT COUNT(DISTINCT ea.event_id)
           FROM event_attendance ea
           JOIN events e ON e.id = ea.event_id
           WHERE ea.pnm_id = $1 AND e.is_active = true""",
        seeded["pnm_a"],
    )
    assert count == 1


@pytest.mark.asyncio
async def test_export_query_uses_canonical_votes_and_notes(seeded, db):
    """list_for_export drives the PowerPoint export.

    It read votes.score / votes.is_favorite and a `notes` table -- none of which
    exist on a migrated database, so the .pptx export 500'd.
    """
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
           VALUES ($1, $2, $3, 'YES', true)""",
        seeded["round"], seeded["pnm_a"], seeded["user"],
    )
    await db.execute(
        "INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous) VALUES ($1, $2, 'Strong', false)",
        seeded["pnm_a"], seeded["user"],
    )
    row = await db.fetchrow(
        """SELECT
             (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'YES')   AS up_count,
             (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'NO')    AS down_count,
             (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id AND v.favorite = true) AS star_count,
             (SELECT n.body FROM pnm_notes n WHERE n.pnm_id = p.id
                ORDER BY n.created_at DESC LIMIT 1) AS latest_note_body,
             (SELECT u.email FROM pnm_notes n LEFT JOIN users u ON u.id = n.author_user_id
                WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note_author
           FROM pnms p WHERE p.id = $1""",
        seeded["pnm_a"],
    )
    assert row["up_count"] == 1
    assert row["star_count"] == 1
    assert row["latest_note_body"] == "Strong"
    assert row["latest_note_author"] == "admin@test.local"


@pytest.mark.asyncio
async def test_pnm_delete_cleanup_targets_a_real_table(seeded, db):
    """`DELETE FROM event_attendances` (plural) raised, and being last in the
    cleanup block its exception was swallowed by a logger.warning."""
    await db.execute(
        "INSERT INTO event_attendance (event_id, pnm_id, method) VALUES ($1, $2, 'SEARCH')",
        seeded["event"], seeded["pnm_a"],
    )
    for table, col in (
        ("pnm_tags", "pnm_id"), ("pnm_notes", "pnm_id"), ("votes", "pnm_id"),
        ("round_pnms", "pnm_id"), ("event_attendance", "pnm_id"),
    ):
        await db.execute(f"DELETE FROM {table} WHERE {col} = $1", seeded["pnm_a"])
    await db.execute("DELETE FROM pnms WHERE id = $1", seeded["pnm_a"])
    assert await db.fetchval("SELECT COUNT(*) FROM pnms WHERE id = $1", seeded["pnm_a"]) == 0


@pytest.mark.asyncio
async def test_round_results_returns_rows_and_real_statistics(seeded, db):
    """Two independent failures met here.

    get_round_results filters on round_pnms, which no code path ever wrote to,
    so every round returned []. And controversy_score was hardcoded to 0, so
    nothing was ever flagged as contentious.
    """
    voters = []
    for i, value in enumerate(("YES", "NO", "YES", "UNKNOWN")):
        uid = uuid.uuid4()
        await db.execute("INSERT INTO users (id, email) VALUES ($1, $2)", uid, f"v{i}@test.local")
        await db.execute(
            "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'member')",
            uid, seeded["chapter"],
        )
        await db.execute(
            """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
               VALUES ($1, $2, $3, $4, $5)""",
            seeded["round"], seeded["pnm_a"], uid, value, i == 0,
        )
        voters.append(uid)

    row = await db.fetchrow(
        """SELECT COUNT(v.id) as vote_count,
                  COUNT(CASE WHEN v.value = 'YES' THEN 1 END) as yes_count,
                  COUNT(CASE WHEN v.value = 'UNKNOWN' THEN 1 END) as dont_know_count,
                  COUNT(CASE WHEN v.favorite THEN 1 END) as favorite_count,
                  COALESCE(STDDEV_POP(
                      CASE v.value WHEN 'YES' THEN 1.0 WHEN 'UNKNOWN' THEN 0.5 ELSE 0.0 END
                  ), 0) * 20 as controversy_score
           FROM pnms p
           LEFT JOIN votes v ON v.pnm_id = p.id AND v.round_id = $1
           WHERE p.id IN (SELECT pnm_id FROM round_pnms WHERE round_id = $1)
             AND p.id = $2
           GROUP BY p.id""",
        seeded["round"], seeded["pnm_a"],
    )
    assert row is not None, "round_pnms was empty -- results would be [] for this round"
    assert row["vote_count"] == 4
    assert row["yes_count"] == 2
    assert row["dont_know_count"] == 1
    assert row["favorite_count"] == 1
    assert float(row["controversy_score"]) > 0, "controversy_score is still hardcoded"


@pytest.mark.asyncio
async def test_round_pnms_fan_out_survives_reordering(seeded, db):
    """set_round_pnms must be idempotent -- it is called on every round create,
    and re-running should update order rather than conflict."""
    ids = [str(seeded["pnm_b"]), str(seeded["pnm_a"])]
    await db.execute(
        """INSERT INTO round_pnms (round_id, pnm_id, order_index)
           SELECT $1, x.pnm_id::uuid, (x.ord - 1)::int
           FROM unnest($2::text[]) WITH ORDINALITY AS x(pnm_id, ord)
           WHERE EXISTS (SELECT 1 FROM pnms p WHERE p.id = x.pnm_id::uuid)
           ON CONFLICT (round_id, pnm_id) DO UPDATE SET order_index = EXCLUDED.order_index""",
        seeded["round"], ids,
    )
    rows = await db.fetch(
        "SELECT pnm_id, order_index FROM round_pnms WHERE round_id = $1 ORDER BY order_index",
        seeded["round"],
    )
    assert [str(r["pnm_id"]) for r in rows] == ids


@pytest.mark.asyncio
async def test_notes_expose_an_author_for_the_detail_page(seeded, db):
    """The PNM detail page renders `author`; the model had only author_id."""
    await db.execute(
        "INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous) VALUES ($1, $2, 'Named', false)",
        seeded["pnm_a"], seeded["user"],
    )
    await db.execute(
        "INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous) VALUES ($1, $2, 'Secret', true)",
        seeded["pnm_a"], seeded["user"],
    )
    rows = await db.fetch(
        """SELECT n.body, n.anonymous,
                  CASE WHEN n.anonymous THEN NULL ELSE u.email END AS author_email
           FROM pnm_notes n
           LEFT JOIN users u ON u.id = n.author_user_id
           WHERE n.pnm_id = $1 ORDER BY n.body""",
        seeded["pnm_a"],
    )
    by_body = {r["body"]: r for r in rows}
    assert by_body["Named"]["author_email"] == "admin@test.local"
    assert by_body["Secret"]["author_email"] is None, "anonymous notes must not leak the author"


@pytest.mark.asyncio
async def test_exec_role_is_storable(seeded, db):
    """_require_admin_or_exec tests for 'exec', which the original CHECK
    constraint could never hold -- so bid-list routes were admin-only."""
    uid = uuid.uuid4()
    await db.execute("INSERT INTO users (id, email) VALUES ($1, 'exec@test.local')", uid)
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'exec')",
        uid, seeded["chapter"],
    )
    assert await db.fetchval(
        "SELECT role FROM memberships WHERE user_id = $1", uid
    ) == "exec"


async def _noop():
    return None


@pytest.mark.asyncio
async def test_voting_service_populates_round_pnms(seeded, db_manager, db, monkeypatch):
    """The real service method, not equivalent SQL.

    No code path had ever written to round_pnms -- 0013 backfills existing rows,
    but without this fan-out every newly created round would immediately regress
    to empty results.
    """
    from python_server import services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.VotingService()

    fresh_round = uuid.uuid4()
    await db.execute(
        """INSERT INTO voting_rounds (id, chapter_id, type, status, room_code)
           VALUES ($1, $2, 'GENERAL', 'ACTIVE', 'FANOUT')""",
        fresh_round, seeded["chapter"],
    )
    assert await db.fetchval(
        "SELECT COUNT(*) FROM round_pnms WHERE round_id = $1", fresh_round
    ) == 0

    await svc.set_round_pnms(str(fresh_round), [str(seeded["pnm_a"]), str(seeded["pnm_b"])])

    rows = await db.fetch(
        "SELECT pnm_id, order_index FROM round_pnms WHERE round_id = $1 ORDER BY order_index",
        fresh_round,
    )
    assert [str(r["pnm_id"]) for r in rows] == [str(seeded["pnm_a"]), str(seeded["pnm_b"])]
    assert [r["order_index"] for r in rows] == [0, 1]

    # Idempotent: called again on every round create.
    await svc.set_round_pnms(str(fresh_round), [str(seeded["pnm_a"]), str(seeded["pnm_b"])])
    assert await db.fetchval(
        "SELECT COUNT(*) FROM round_pnms WHERE round_id = $1", fresh_round
    ) == 2


@pytest.mark.asyncio
async def test_set_round_pnms_ignores_unknown_pnm_ids(seeded, db_manager, db, monkeypatch):
    """A stale id in selected_pnm_ids must not abort the whole fan-out."""
    from python_server import services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    svc = services.VotingService()

    await svc.set_round_pnms(
        str(seeded["round"]), [str(seeded["pnm_a"]), str(uuid.uuid4())]
    )
    count = await db.fetchval(
        "SELECT COUNT(*) FROM round_pnms WHERE round_id = $1", seeded["round"]
    )
    assert count == 2  # the two seeded rows; the unknown id was skipped
