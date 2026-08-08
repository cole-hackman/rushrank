"""
Round cutoffs and the audit trail.

Cuts are the highest-stakes action in the product: they are irreversible from
the chapter's point of view and they are made in a room full of people in about
four seconds. The two things that must hold are that the preview the chair
approves is the split that executes, and that afterwards there is a record of
who made it.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


async def _vote(db, round_id, pnm_id, chapter_id, yes: int, no: int = 0, unknown: int = 0):
    """Cast n votes of each value by throwaway voters."""
    for value, count in (("YES", yes), ("NO", no), ("UNKNOWN", unknown)):
        for _ in range(count):
            voter = uuid.uuid4()
            await db.execute(
                "INSERT INTO users (id, email) VALUES ($1, $2)", voter, f"{voter}@test.local"
            )
            await db.execute(
                "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'member')",
                voter, chapter_id,
            )
            await db.execute(
                """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
                   VALUES ($1, $2, $3, $4, false)""",
                round_id, pnm_id, voter, value,
            )


@pytest.fixture
def voting(db_manager, monkeypatch):
    from python_server import services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    return services.VotingService()


async def _ranked_chapter(db, chapter_id, round_id, spread):
    """Create PNMs with the given (name, yes, no) vote spreads."""
    ids = {}
    for order, (name, yes, no) in enumerate(spread):
        pnm = uuid.uuid4()
        ids[name] = pnm
        await db.execute(
            "INSERT INTO pnms (id, chapter_id, name) VALUES ($1, $2, $3)", pnm, chapter_id, name
        )
        await db.execute(
            "INSERT INTO round_pnms (round_id, pnm_id, order_index) VALUES ($1, $2, $3)",
            round_id, pnm, order,
        )
        await _vote(db, round_id, pnm, chapter_id, yes=yes, no=no)
    return ids


@pytest.mark.asyncio
async def test_dry_run_returns_the_split_and_changes_nothing(seeded, db, voting):
    await _vote(db, seeded["round"], seeded["pnm_a"], seeded["chapter"], yes=8, no=2)
    await _vote(db, seeded["round"], seeded["pnm_b"], seeded["chapter"], yes=2, no=8)

    result = await voting.apply_cutoff(
        str(seeded["round"]), mode="min_yes_pct", value=50, dry_run=True
    )

    assert result["advanced_count"] == 1
    assert result["cut_count"] == 1
    assert result["advanced"][0]["name"] == "Alice Example"
    assert result["next_round_id"] is None

    assert await db.fetchval(
        "SELECT status FROM voting_rounds WHERE id = $1", seeded["round"]
    ) == "ACTIVE"
    assert await db.fetchval(
        "SELECT COUNT(*) FROM voting_rounds WHERE chapter_id = $1", seeded["chapter"]
    ) == 1


@pytest.mark.asyncio
async def test_committing_ends_the_round_and_seeds_the_next(seeded, db, voting):
    await _vote(db, seeded["round"], seeded["pnm_a"], seeded["chapter"], yes=9, no=1)
    await _vote(db, seeded["round"], seeded["pnm_b"], seeded["chapter"], yes=1, no=9)

    result = await voting.apply_cutoff(
        str(seeded["round"]), mode="min_yes_pct", value=50, dry_run=False
    )

    assert await db.fetchval(
        "SELECT status FROM voting_rounds WHERE id = $1", seeded["round"]
    ) == "ENDED"

    next_id = result["next_round_id"]
    assert next_id

    # round_pnms is the read side for results and exports. A next round that did
    # not populate it would come back empty -- the original bug in this area.
    advanced = await db.fetch(
        "SELECT pnm_id FROM round_pnms WHERE round_id = $1::uuid", next_id
    )
    assert [str(r["pnm_id"]) for r in advanced] == [str(seeded["pnm_a"])]


@pytest.mark.asyncio
async def test_top_n_includes_everyone_tied_at_the_boundary(seeded, db, voting):
    """Three PNMs share the cutoff score. Cutting one of them arbitrarily is not
    a rounding detail -- it is a person who does not get a bid."""
    await db.execute("DELETE FROM round_pnms WHERE round_id = $1", seeded["round"])
    await _ranked_chapter(db, seeded["chapter"], seeded["round"], [
        ("Top", 10, 0),      # 100%
        ("Tied A", 5, 5),    # 50%
        ("Tied B", 5, 5),    # 50%
        ("Tied C", 5, 5),    # 50%
        ("Bottom", 1, 9),    # 10%
    ])

    result = await voting.apply_cutoff(str(seeded["round"]), mode="top_n", value=2, dry_run=True)

    assert result["requested_count"] == 2
    assert result["advanced_count"] == 4, "all three tied at 50% must advance together"
    assert {r["name"] for r in result["cut"]} == {"Bottom"}


@pytest.mark.asyncio
async def test_top_n_larger_than_the_field_advances_everyone(seeded, db, voting):
    await _vote(db, seeded["round"], seeded["pnm_a"], seeded["chapter"], yes=5)
    await _vote(db, seeded["round"], seeded["pnm_b"], seeded["chapter"], yes=5)

    result = await voting.apply_cutoff(str(seeded["round"]), mode="top_n", value=99, dry_run=True)
    assert result["advanced_count"] == 2
    assert result["cut_count"] == 0


@pytest.mark.asyncio
async def test_a_cutoff_that_advances_nobody_is_refused(seeded, db, voting):
    from fastapi import HTTPException

    await _vote(db, seeded["round"], seeded["pnm_a"], seeded["chapter"], yes=0, no=5)
    await _vote(db, seeded["round"], seeded["pnm_b"], seeded["chapter"], yes=0, no=5)

    with pytest.raises(HTTPException) as exc:
        await voting.apply_cutoff(
            str(seeded["round"]), mode="min_yes_pct", value=90, dry_run=False
        )
    assert exc.value.status_code == 400

    assert await db.fetchval(
        "SELECT status FROM voting_rounds WHERE id = $1", seeded["round"]
    ) == "ACTIVE", "a refused cutoff must not have ended the round first"


@pytest.mark.asyncio
async def test_archive_cut_is_opt_in(seeded, db, voting):
    await _vote(db, seeded["round"], seeded["pnm_a"], seeded["chapter"], yes=9, no=1)
    await _vote(db, seeded["round"], seeded["pnm_b"], seeded["chapter"], yes=1, no=9)

    await voting.apply_cutoff(
        str(seeded["round"]), mode="min_yes_pct", value=50, dry_run=False, archive_cut=False
    )
    assert await db.fetchval("SELECT archived FROM pnms WHERE id = $1", seeded["pnm_b"]) is False


@pytest.mark.asyncio
async def test_audit_record_writes_a_readable_row(seeded, db, db_manager, monkeypatch):
    from python_server import audit

    monkeypatch.setattr(audit, "get_db", lambda: db_manager)

    await audit.record(
        str(seeded["chapter"]), str(seeded["user"]), "round.cutoff",
        entity_type="voting_round", entity_id=str(seeded["round"]),
        before={"mode": "top_n", "value": 25},
        after={"advanced_count": 25, "cut_count": 7},
    )

    entries = await audit.list_entries(str(seeded["chapter"]))
    assert len(entries) == 1
    assert entries[0]["action"] == "round.cutoff"
    assert entries[0]["actor_email"] == "admin@test.local"
    assert entries[0]["before"]["mode"] == "top_n"
    assert entries[0]["after"]["cut_count"] == 7


@pytest.mark.asyncio
async def test_audit_failure_never_propagates(seeded, db_manager, monkeypatch):
    """A broken audit write must not fail the cut it was recording."""
    from python_server import audit

    monkeypatch.setattr(audit, "get_db", lambda: db_manager)

    # A chapter_id that violates the foreign key.
    await audit.record(str(uuid.uuid4()), str(seeded["user"]), "round.cutoff")
    # Reaching here at all is the assertion.


@pytest.mark.asyncio
async def test_audit_log_filters_by_action_prefix(seeded, db, db_manager, monkeypatch):
    from python_server import audit

    monkeypatch.setattr(audit, "get_db", lambda: db_manager)

    for action in ("round.create", "round.cutoff", "pnm.import"):
        await audit.record(str(seeded["chapter"]), str(seeded["user"]), action)

    rounds = await audit.list_entries(str(seeded["chapter"]), action_prefix="round.")
    assert {e["action"] for e in rounds} == {"round.create", "round.cutoff"}


@pytest.mark.asyncio
async def test_audit_log_is_scoped_to_one_chapter(seeded, db, db_manager, monkeypatch):
    """Multi-tenancy: another chapter's history must never appear."""
    from python_server import audit

    monkeypatch.setattr(audit, "get_db", lambda: db_manager)

    other = await db.fetchval("INSERT INTO chapters (name) VALUES ('Other') RETURNING id")
    await audit.record(str(seeded["chapter"]), str(seeded["user"]), "pnm.delete")
    await audit.record(str(other), str(seeded["user"]), "pnm.delete")

    entries = await audit.list_entries(str(seeded["chapter"]))
    assert len(entries) == 1
