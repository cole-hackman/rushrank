"""
Roster import: the feature the landing page has advertised and never had.

The tests that matter here are the ones about *not* importing. A dry run that
writes rows, or a commit that silently drops the rows it could not parse, is
worse than no import at all -- a chapter would discover the gap during rush.
"""

from __future__ import annotations

import uuid

import pytest

from python_server import csv_import

pytestmark = pytest.mark.integration


def _csv(*lines: str) -> bytes:
    return "\n".join(lines).encode("utf-8")


@pytest.mark.asyncio
async def test_dry_run_reports_every_problem_and_writes_nothing(seeded, db, db_manager, monkeypatch):
    """One good row, one nameless, one malformed email, one in-file duplicate."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    before = await db.fetchval("SELECT COUNT(*) FROM pnms WHERE chapter_id = $1", seeded["chapter"])

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]),
        _csv(
            "Name,Email,Major",
            "Carl New,carl@test.local,History",
            ",orphan@test.local,Art",
            "Bad Email,not-an-email,Math",
            "Carl Again,carl@test.local,Physics",
        ),
        dry_run=True,
    )

    assert result["valid"] == 1
    messages = " ".join(e["message"] for e in result["errors"])
    assert "Missing name" in messages
    assert "not-an-email" in messages
    assert "Duplicate of row 2" in messages

    after = await db.fetchval("SELECT COUNT(*) FROM pnms WHERE chapter_id = $1", seeded["chapter"])
    assert after == before, "a dry run must not write"


@pytest.mark.asyncio
async def test_commit_inserts_rows_and_resolves_tags(seeded, db, db_manager, monkeypatch):
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]),
        _csv(
            "Full Name,Email,Phone,Major,Hometown,Class Year,Tags",
            "Dana Rush,dana@test.local,555-0101,Econ,Boise ID,Sophomore,Legacy; Athlete",
            "Eli Rush,eli@test.local,,Bio,,Freshman,Athlete",
        ),
        dry_run=False,
    )

    assert result["imported"] == 2

    dana = await db.fetchrow(
        "SELECT id, phone, major, hometown, year FROM pnms WHERE email = 'dana@test.local'"
    )
    assert dana["phone"] == "555-0101"
    assert dana["hometown"] == "Boise ID"
    assert dana["year"] == "Sophomore"

    labels = await db.fetch(
        """SELECT t.label FROM pnm_tags pt JOIN tags t ON t.id = pt.tag_id
           WHERE pt.pnm_id = $1 ORDER BY t.label""",
        dana["id"],
    )
    assert [r["label"] for r in labels] == ["Athlete", "Legacy"]

    # "Athlete" appears on both rows and must be one tag, not two.
    assert await db.fetchval(
        "SELECT COUNT(*) FROM tags WHERE chapter_id = $1 AND label = 'Athlete'",
        seeded["chapter"],
    ) == 1


@pytest.mark.asyncio
async def test_reimporting_the_same_file_adds_nobody(seeded, db, db_manager, monkeypatch):
    """Someone will click import twice. That must be harmless."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)
    payload = _csv("Name,Email", "Fred Twice,fred@test.local")

    first = await csv_import.parse_and_import(str(seeded["chapter"]), payload, dry_run=False)
    assert first["imported"] == 1

    second = await csv_import.parse_and_import(str(seeded["chapter"]), payload, dry_run=True)
    assert second["valid"] == 0
    assert second["duplicates"][0]["existing_id"] == first["pnm_ids"][0]

    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnms WHERE email = 'fred@test.local'"
    ) == 1


@pytest.mark.asyncio
async def test_a_file_exported_by_rushrank_reimports_with_no_mapping(seeded, db, db_manager, monkeypatch):
    """The round trip. Export headers and import aliases must not drift apart."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)
    from python_server import services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    exported = await services.ExportService().export_pnms_csv(str(seeded["chapter"]))

    other_chapter = await db.fetchval(
        "INSERT INTO chapters (name) VALUES ('Round Trip') RETURNING id"
    )
    result = await csv_import.parse_and_import(
        str(other_chapter), exported.encode("utf-8"), dry_run=False
    )

    assert result["imported"] == 2, f"expected both seeded PNMs, got {result['errors']}"
    assert set(result["mapping"].values()) >= {"name", "email", "major", "hometown", "year"}


@pytest.mark.asyncio
async def test_a_mapping_override_can_correct_a_bad_guess(seeded, db_manager, monkeypatch):
    """Real spreadsheets have columns like "Who" that nothing can auto-detect."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    payload = _csv("Who,Contact", "Gus Manual,gus@test.local")

    with pytest.raises(Exception) as exc:
        await csv_import.parse_and_import(str(seeded["chapter"]), payload, dry_run=True)
    assert "name" in str(exc.value)

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]), payload,
        mapping_override={"Who": "name", "Contact": "email"},
        dry_run=False,
    )
    assert result["imported"] == 1


@pytest.mark.asyncio
async def test_excel_byte_order_mark_does_not_break_detection(seeded, db_manager, monkeypatch):
    """Excel writes a BOM. Without utf-8-sig the first header becomes '﻿Name'."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    raw = "﻿Name,Email\nHank BOM,hank@test.local".encode("utf-8")
    result = await csv_import.parse_and_import(str(seeded["chapter"]), raw, dry_run=True)
    assert result["valid"] == 1


@pytest.mark.asyncio
async def test_import_survives_a_row_with_only_a_name(seeded, db, db_manager, monkeypatch):
    """0013 relaxed pnms.major NOT NULL for exactly this case."""
    monkeypatch.setattr(csv_import, "get_db", lambda: db_manager)

    result = await csv_import.parse_and_import(
        str(seeded["chapter"]), _csv("Name", "Ivan Sparse"), dry_run=False
    )
    assert result["imported"] == 1
    row = await db.fetchrow("SELECT email, major FROM pnms WHERE name = 'Ivan Sparse'")
    assert row["email"] is None and row["major"] is None
