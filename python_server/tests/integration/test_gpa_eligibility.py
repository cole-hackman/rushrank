"""
Academic eligibility.

Most chapters have a GPA minimum and most campuses require the chapter to
certify that every man it bids meets it. There was no GPA field, so the check
came off a spreadsheet the academic chair kept and the certification came off
memory.

Two properties carry the weight here:

  - "not on file" is not "below the minimum". A transfer in his first semester
    genuinely has no GPA, and rendering that as failing gets him cut for a
    missing spreadsheet row.
  - A waiver cannot exist without an author and a reason. The alternative to a
    recorded exception is not "no exceptions" -- it is someone quietly editing
    the GPA upward.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


def _eligibility(gpa, min_gpa, waived):
    from python_server.routes import _eligibility as fn

    return fn(gpa, min_gpa, waived)


@pytest.mark.asyncio
async def test_no_minimum_means_the_check_is_off():
    """Not every chapter enforces a floor; inventing one for them is wrong."""
    assert _eligibility(2.0, None, False) == "no_minimum"
    assert _eligibility(None, None, False) == "no_minimum"


@pytest.mark.asyncio
async def test_missing_gpa_is_unknown_not_below():
    """The distinction this feature lives or dies on."""
    assert _eligibility(None, 2.5, False) == "unknown"


@pytest.mark.asyncio
async def test_the_boundary_is_inclusive():
    """A 2.5 against a 2.5 floor meets it. Off-by-one here cuts a real person."""
    assert _eligibility(2.5, 2.5, False) == "eligible"
    assert _eligibility(2.49, 2.5, False) == "below"
    assert _eligibility(2.51, 2.5, False) == "eligible"


@pytest.mark.asyncio
async def test_a_waiver_overrides_being_below():
    assert _eligibility(2.1, 2.5, True) == "waived"


@pytest.mark.asyncio
async def test_a_waiver_with_no_reason_is_refused_by_the_database(seeded, db):
    """Not just by the route. A waiver with no author and no reason is the
    group-chat decision this replaces, so the row cannot hold one."""
    import asyncpg

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "UPDATE pnms SET gpa_waived = true WHERE id = $1", seeded["pnm_a"]
        )


@pytest.mark.asyncio
async def test_a_complete_waiver_is_accepted(seeded, db):
    await db.execute(
        """UPDATE pnms SET gpa_waived = true, gpa_waived_reason = 'Transfer, no GPA on file',
                           gpa_waived_by_user_id = $2, gpa_waived_at = NOW()
            WHERE id = $1""",
        seeded["pnm_a"], seeded["user"],
    )
    row = await db.fetchrow(
        "SELECT gpa_waived, gpa_waived_reason FROM pnms WHERE id = $1", seeded["pnm_a"]
    )
    assert row["gpa_waived"] is True
    assert row["gpa_waived_reason"] == "Transfer, no GPA on file"


@pytest.mark.asyncio
async def test_a_blank_reason_does_not_count_as_a_reason(seeded, db):
    """'   ' would satisfy NOT NULL and record nothing."""
    import asyncpg

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            """UPDATE pnms SET gpa_waived = true, gpa_waived_reason = '   ',
                               gpa_waived_by_user_id = $2 WHERE id = $1""",
            seeded["pnm_a"], seeded["user"],
        )


@pytest.mark.asyncio
async def test_a_wildly_wrong_gpa_is_refused_by_the_column_type(seeded, db):
    """A typo'd 35 instead of 3.5 would make someone look like the best
    candidate in the chapter.

    numeric(4,3) tops out below 10, so this is caught by the type before the
    CHECK is even consulted -- a different exception, but refused either way.
    """
    import asyncpg

    with pytest.raises(asyncpg.NumericValueOutOfRangeError):
        await db.execute("UPDATE pnms SET gpa = 35 WHERE id = $1", seeded["pnm_a"])


# One violation per test: in Postgres an error aborts the whole transaction, so
# a second assertion in the same test fails with InFailedSQLTransactionError
# rather than the constraint error it was checking for.
@pytest.mark.asyncio
async def test_a_plausible_but_impossible_gpa_is_refused_by_the_check(seeded, db):
    """6.5 fits the column type comfortably; only the CHECK stops it. This is
    the case the constraint actually exists for."""
    import asyncpg

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute("UPDATE pnms SET gpa = 6.5 WHERE id = $1", seeded["pnm_a"])


@pytest.mark.asyncio
async def test_a_negative_gpa_is_refused(seeded, db):
    import asyncpg

    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute("UPDATE pnms SET gpa = -1 WHERE id = $1", seeded["pnm_a"])


@pytest.mark.asyncio
async def test_a_weighted_scale_above_four_is_allowed(seeded, db):
    """Some schools weight to 5.0; pinning the CHECK to 4.0 would reject them."""
    await db.execute("UPDATE pnms SET gpa = 4.4 WHERE id = $1", seeded["pnm_a"])
    assert float(await db.fetchval(
        "SELECT gpa FROM pnms WHERE id = $1", seeded["pnm_a"]
    )) == 4.4


@pytest.mark.asyncio
async def test_gpa_precision_survives_the_round_trip(seeded, db):
    """numeric(4,3) so 3.475 does not silently become 3.48 and cross a floor."""
    await db.execute("UPDATE pnms SET gpa = 3.475 WHERE id = $1", seeded["pnm_a"])
    assert float(await db.fetchval(
        "SELECT gpa FROM pnms WHERE id = $1", seeded["pnm_a"]
    )) == 3.475


@pytest.mark.asyncio
async def test_existing_rows_are_untouched_by_the_migration(seeded, db):
    """Nobody becomes ineligible because a column was added."""
    rows = await db.fetch(
        "SELECT gpa, gpa_waived FROM pnms WHERE chapter_id = $1", seeded["chapter"]
    )
    assert all(r["gpa"] is None and r["gpa_waived"] is False for r in rows)

    min_gpa = await db.fetchval(
        "SELECT min_gpa FROM chapters WHERE id = $1", seeded["chapter"]
    )
    assert min_gpa is None
    # No floor set means the check is off, not that everyone fails it.
    assert _eligibility(None, min_gpa, False) == "no_minimum"


@pytest.mark.asyncio
async def test_revoking_a_waiver_clears_its_record(seeded, db):
    """A revoked waiver must not leave a reason behind implying one stands."""
    await db.execute(
        """UPDATE pnms SET gpa_waived = true, gpa_waived_reason = 'Exec vote',
                           gpa_waived_by_user_id = $2, gpa_waived_at = NOW()
            WHERE id = $1""",
        seeded["pnm_a"], seeded["user"],
    )
    await db.execute(
        """UPDATE pnms SET gpa_waived = false, gpa_waived_reason = NULL,
                           gpa_waived_by_user_id = NULL, gpa_waived_at = NULL
            WHERE id = $1""",
        seeded["pnm_a"],
    )
    row = await db.fetchrow(
        "SELECT gpa_waived, gpa_waived_reason, gpa_waived_at FROM pnms WHERE id = $1",
        seeded["pnm_a"],
    )
    assert row["gpa_waived"] is False
    assert row["gpa_waived_reason"] is None
    assert row["gpa_waived_at"] is None


@pytest.mark.asyncio
async def test_the_chapter_floor_is_per_chapter(seeded, db):
    """Multi-tenancy: one chapter's standard must not bind another's."""
    other = await db.fetchval(
        "INSERT INTO chapters (name, min_gpa) VALUES ('Strict House', 3.0) RETURNING id"
    )
    await db.execute("UPDATE chapters SET min_gpa = 2.5 WHERE id = $1", seeded["chapter"])

    assert float(await db.fetchval(
        "SELECT min_gpa FROM chapters WHERE id = $1", seeded["chapter"]
    )) == 2.5
    assert float(await db.fetchval("SELECT min_gpa FROM chapters WHERE id = $1", other)) == 3.0

    # 2.8 passes at one house and not the other -- which is the real situation.
    assert _eligibility(2.8, 2.5, False) == "eligible"
    assert _eligibility(2.8, 3.0, False) == "below"


@pytest.mark.asyncio
async def test_csv_import_reads_a_gpa_column(seeded, db, db_manager, monkeypatch):
    """A registrar export has a GPA column; typing 120 of them by hand is how
    the spreadsheet stayed the source of truth."""
    from python_server import csv_import

    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]),
        b"Name,Email,Cumulative GPA\nGrady Marks,grady@test.local,3.42",
        dry_run=False,
    )
    assert result["imported"] == 1
    assert float(await db.fetchval(
        "SELECT gpa FROM pnms WHERE email = 'grady@test.local'"
    )) == 3.42


@pytest.mark.asyncio
async def test_a_bad_gpa_cell_skips_one_row_not_the_import(seeded, db_manager, monkeypatch):
    """Reaching the column with '35' or 'n/a' would surface as a database error
    for the whole file instead of one reported row."""
    from python_server import csv_import

    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]),
        b"Name,Email,GPA\nGood Row,good@test.local,3.1\n"
        b"Typo Row,typo@test.local,35\nWords Row,words@test.local,n/a",
        dry_run=True,
    )
    assert result["valid"] == 1
    messages = " ".join(e["message"] for e in result["errors"])
    assert "outside 0-5" in messages
    assert "not a GPA" in messages
