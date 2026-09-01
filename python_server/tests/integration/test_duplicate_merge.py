"""
Merging two rows that turned out to be the same person.

With four ways into the roster -- intake form, CSV import, walk-ups, and the
interest link -- the same person arrives more than once as a matter of course.
Until now nothing could reunite two rows that already existed, so a PNM's notes
lived under one id and his attendance under another, and he read as half as
engaged as he was, twice.

The test that matters most here is `test_merge_handles_every_fk`: it reads the
foreign keys pointing at `pnms` out of the catalog and fails if any is missing
from the handled list. Merging is destructive, and the failure mode of an
unhandled table is silent data loss discovered months later.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture
def merge(db_manager, monkeypatch):
    from python_server import merge as merge_module

    monkeypatch.setattr(merge_module, "get_db", lambda: db_manager)
    return merge_module


@pytest.mark.asyncio
async def test_merge_handles_every_fk(db, merge):
    """The guard. Add a table that references pnms and this fails until the
    merge knows about it -- which is the only reason it stays correct."""
    rows = await db.fetch(
        """
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'pnms' AND ccu.column_name = 'id'
        """
    )
    in_db = {(r["table_name"], r["column_name"]) for r in rows}
    handled = {(c.table, c.column) for c in merge.CHILD_TABLES}

    missing = in_db - handled
    assert not missing, (
        f"These tables reference pnms(id) but merge_pnms ignores them: {sorted(missing)}. "
        "Add them to CHILD_TABLES with the right conflict_key, or a merge will "
        "silently drop their rows."
    )

    stale = handled - in_db
    assert not stale, f"CHILD_TABLES lists tables that no longer reference pnms: {sorted(stale)}"


@pytest.mark.asyncio
async def test_notes_and_attendance_are_reunited(seeded, db, merge):
    """The symptom this exists to fix: half his history under each id."""
    await db.execute(
        """INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous)
           VALUES ($1, $2, 'Great at the BBQ', false)""",
        seeded["pnm_b"], seeded["user"],
    )
    await db.execute(
        "INSERT INTO event_attendance (event_id, pnm_id, method) VALUES ($1, $2, 'SEARCH')",
        seeded["event"], seeded["pnm_b"],
    )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert result["moved"]["pnm_notes"] == 1
    assert result["moved"]["event_attendance"] == 1
    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_notes WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 1
    assert await db.fetchval("SELECT COUNT(*) FROM pnms WHERE id = $1", seeded["pnm_b"]) == 0


@pytest.mark.asyncio
async def test_a_collision_is_dropped_not_duplicated(seeded, db, merge):
    """Both rows checked in to the same event. That is one attendance, not two."""
    for pnm in (seeded["pnm_a"], seeded["pnm_b"]):
        await db.execute(
            "INSERT INTO event_attendance (event_id, pnm_id, method) VALUES ($1, $2, 'SEARCH')",
            seeded["event"], pnm,
        )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert result["dropped_as_duplicate"]["event_attendance"] == 1
    assert await db.fetchval(
        "SELECT COUNT(*) FROM event_attendance WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 1


@pytest.mark.asyncio
async def test_a_vote_collision_respects_the_full_unique_key(seeded, db, merge):
    """votes is unique on (round, pnm, voter). Two *different* voters must both
    survive; the same voter twice is one vote."""
    other_voter = uuid.uuid4()
    await db.execute(
        "INSERT INTO users (id, email) VALUES ($1, $2)", other_voter, f"{other_voter}@t.local"
    )
    # Same voter on both duplicates -> collision.
    for pnm in (seeded["pnm_a"], seeded["pnm_b"]):
        await db.execute(
            """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
               VALUES ($1, $2, $3, 'YES', false)""",
            seeded["round"], pnm, seeded["user"],
        )
    # A different voter, only on the loser -> must move.
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
           VALUES ($1, $2, $3, 'NO', false)""",
        seeded["round"], seeded["pnm_b"], other_voter,
    )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert result["moved"]["votes"] == 1
    assert result["dropped_as_duplicate"]["votes"] == 1
    voters = await db.fetch(
        "SELECT voter_user_id FROM votes WHERE pnm_id = $1", seeded["pnm_a"]
    )
    assert {str(v["voter_user_id"]) for v in voters} == {str(seeded["user"]), str(other_voter)}


@pytest.mark.asyncio
async def test_the_survivors_blanks_are_filled_from_the_loser(seeded, db, merge):
    """The main way a merge does damage: the loser held the half you needed."""
    await db.execute(
        "UPDATE pnms SET email = NULL, phone = NULL WHERE id = $1", seeded["pnm_a"]
    )
    await db.execute(
        "UPDATE pnms SET email = 'found@test.local', phone = '555-0199', major = 'History' "
        "WHERE id = $1",
        seeded["pnm_b"],
    )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    row = await db.fetchrow(
        "SELECT email, phone, major FROM pnms WHERE id = $1", seeded["pnm_a"]
    )
    assert row["email"] == "found@test.local"
    assert row["phone"] == "555-0199"
    assert set(result["fields_filled"]) >= {"email", "phone"}
    # The survivor already had a major; it must not be overwritten.
    assert row["major"] == "CS"


@pytest.mark.asyncio
async def test_the_survivor_is_never_overwritten(seeded, db, merge):
    await db.execute("UPDATE pnms SET email = 'keep@test.local' WHERE id = $1", seeded["pnm_a"])
    await db.execute("UPDATE pnms SET email = 'lose@test.local' WHERE id = $1", seeded["pnm_b"])

    await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert await db.fetchval(
        "SELECT email FROM pnms WHERE id = $1", seeded["pnm_a"]
    ) == "keep@test.local"


@pytest.mark.asyncio
async def test_a_live_session_follows_the_survivor(seeded, db, merge):
    """If the loser was on screen when someone merged, the session must not be
    left pointing at a deleted row."""
    session_id = await db.fetchval(
        """INSERT INTO sessions (round_id, join_code, current_pnm_id)
           VALUES ($1, 'ABC123', $2) RETURNING id""",
        seeded["round"], seeded["pnm_b"],
    )
    await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))
    assert await db.fetchval(
        "SELECT current_pnm_id FROM sessions WHERE id = $1", session_id
    ) == seeded["pnm_a"]


@pytest.mark.asyncio
async def test_merging_across_chapters_is_refused(seeded, db, merge):
    """Would move one chapter's data into another's."""
    from fastapi import HTTPException

    other_chapter = await db.fetchval(
        "INSERT INTO chapters (name) VALUES ('Other House') RETURNING id"
    )
    outsider = await db.fetchval(
        "INSERT INTO pnms (chapter_id, name) VALUES ($1, 'Someone Else') RETURNING id",
        other_chapter,
    )

    with pytest.raises(HTTPException) as exc:
        await merge.merge_pnms(str(seeded["pnm_a"]), str(outsider))
    assert exc.value.status_code == 400
    assert await db.fetchval("SELECT COUNT(*) FROM pnms WHERE id = $1", outsider) == 1


@pytest.mark.asyncio
async def test_merging_a_pnm_into_itself_is_refused(seeded, db, merge):
    """Would delete the row it just merged into."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_a"]))
    assert exc.value.status_code == 400
    assert await db.fetchval("SELECT COUNT(*) FROM pnms WHERE id = $1", seeded["pnm_a"]) == 1


@pytest.mark.asyncio
async def test_the_snapshot_records_what_was_lost(seeded, db, merge):
    """The merge cannot be undone from the UI, so audit_log is the only record."""
    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))
    assert result["before"]["loser"]["name"] == "Bob Example"
    assert result["before"]["winner"]["name"] == "Alice Example"


@pytest.mark.asyncio
async def test_duplicates_are_found_by_email_phone_and_name(seeded, db, merge):
    chapter = seeded["chapter"]
    await db.execute(
        "UPDATE pnms SET email = 'same@test.local' WHERE id = ANY($1::uuid[])",
        [seeded["pnm_a"], seeded["pnm_b"]],
    )
    await db.execute(
        "INSERT INTO pnms (chapter_id, name, phone) VALUES ($1, 'Carl Twin', '(555) 010-0000')",
        chapter,
    )
    await db.execute(
        "INSERT INTO pnms (chapter_id, name, phone) VALUES ($1, 'Carl Twin', '555-010-0000')",
        chapter,
    )

    groups = await merge.find_duplicate_groups(str(chapter))
    reasons = {g["reason"] for g in groups}

    assert "email" in reasons
    # Formatting differs; the digits are the same person.
    assert "phone" in reasons
    # The email pair must be reported once, under the stronger reason.
    email_group = next(g for g in groups if g["reason"] == "email")
    assert len(email_group["members"]) == 2


@pytest.mark.asyncio
async def test_a_group_shows_which_row_is_richer(seeded, db, merge):
    """Whoever merges has to choose a survivor; a bare name gives them nothing."""
    await db.execute(
        "UPDATE pnms SET email = 'same@test.local' WHERE id = ANY($1::uuid[])",
        [seeded["pnm_a"], seeded["pnm_b"]],
    )
    await db.execute(
        """INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous)
           VALUES ($1, $2, 'note', false)""",
        seeded["pnm_b"], seeded["user"],
    )

    groups = await merge.find_duplicate_groups(str(seeded["chapter"]))
    members = {m["id"]: m for m in groups[0]["members"]}
    assert members[str(seeded["pnm_b"])]["notes"] == 1
    assert members[str(seeded["pnm_a"])]["notes"] == 0


@pytest.mark.asyncio
async def test_a_clean_roster_reports_nothing(seeded, merge):
    assert await merge.find_duplicate_groups(str(seeded["chapter"])) == []


@pytest.mark.asyncio
async def test_a_contact_logged_outside_an_event_still_collides(seeded, db, merge):
    """The NULL case, which is the common one.

    Most contacts are logged from a PNM's profile with no event attached, so
    `pnm_contacts.event_id` is NULL on both duplicates. `existing.event_id =
    child.event_id` evaluates to NULL there, the row reads as collision-free,
    and the move trips `pnm_contacts_unique_per_event` -- whose COALESCE folds
    both NULLs onto one sentinel precisely because they are not distinct.
    The predicate uses IS NOT DISTINCT FROM for that reason.
    """
    for pnm in (seeded["pnm_a"], seeded["pnm_b"]):
        await db.execute(
            "INSERT INTO pnm_contacts (pnm_id, user_id) VALUES ($1, $2)",
            pnm, seeded["user"],
        )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert result["dropped_as_duplicate"]["pnm_contacts"] == 1
    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 1


@pytest.mark.asyncio
async def test_the_same_brother_at_two_events_keeps_both_contacts(seeded, db, merge):
    """Coverage counts distinct brothers, so this does not change the number --
    but the contact history is where it came from, and it is worth keeping."""
    second_event = await db.fetchval(
        """INSERT INTO events (chapter_id, name, date)
           VALUES ($1, 'Sports Night', now()) RETURNING id""",
        seeded["chapter"],
    )
    await db.execute(
        "INSERT INTO pnm_contacts (pnm_id, user_id, event_id) VALUES ($1, $2, $3)",
        seeded["pnm_a"], seeded["user"], seeded["event"],
    )
    await db.execute(
        "INSERT INTO pnm_contacts (pnm_id, user_id, event_id) VALUES ($1, $2, $3)",
        seeded["pnm_b"], seeded["user"], second_event,
    )

    result = await merge.merge_pnms(str(seeded["pnm_a"]), str(seeded["pnm_b"]))

    assert result["moved"]["pnm_contacts"] == 1
    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 2
    # One brother, two meetings -> still one for coverage.
    assert await db.fetchval(
        "SELECT COUNT(DISTINCT user_id) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 1
