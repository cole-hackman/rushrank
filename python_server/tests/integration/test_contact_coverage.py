"""
Who has actually met this PNM.

A chapter votes on sixty PNMs. Any given brother has genuinely spoken to maybe
fifteen. The rest he votes on off a photo -- or abstains, which drags the
yes-percentage around for reasons that have nothing to do with the PNM. Before
this, nothing distinguished "forty people know him and half said no" from "four
people know him and the rest guessed".

The two properties worth pinning: coverage counts *brothers*, never rows, and
tapping the button twice must never inflate it.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture
def pnms(db_manager, monkeypatch):
    from python_server import services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    return services.PNMService()


async def _brother(db, chapter_id, name: str) -> uuid.UUID:
    uid = uuid.uuid4()
    await db.execute(
        "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
        uid, f"{uid}@test.local", name,
    )
    await db.execute(
        "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, 'member')",
        uid, chapter_id,
    )
    return uid


@pytest.mark.asyncio
async def test_logging_a_contact_counts_once(seeded, pnms):
    summary = await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]))
    assert summary["met_count"] == 1
    assert summary["met_by_me"] is True


@pytest.mark.asyncio
async def test_a_double_tap_does_not_inflate_coverage(seeded, db, pnms):
    """The button is on a phone at a crowded event. It will be tapped twice."""
    for _ in range(4):
        summary = await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]))

    assert summary["met_count"] == 1
    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 1


@pytest.mark.asyncio
async def test_meeting_again_at_a_later_event_is_a_second_row_but_not_a_second_brother(
    seeded, db, pnms
):
    """Two encounters is real signal; it is still one person who knows him."""
    other_event = await db.fetchval(
        "INSERT INTO events (chapter_id, name, date) VALUES ($1, 'Sports Night', now()) RETURNING id",
        seeded["chapter"],
    )

    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(seeded["event"]))
    summary = await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(other_event))

    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 2
    assert summary["met_count"] == 1, "coverage counts brothers, not encounters"


@pytest.mark.asyncio
async def test_coverage_counts_distinct_brothers(seeded, db, pnms):
    devin = await _brother(db, seeded["chapter"], "Devin")
    ty = await _brother(db, seeded["chapter"], "Ty")

    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]))
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin))
    summary = await pnms.log_contact(str(seeded["pnm_a"]), str(ty))

    assert summary["met_count"] == 3


@pytest.mark.asyncio
async def test_met_by_me_is_per_brother(seeded, db, pnms):
    """Three people have met him and I am not one of them -- the nudge case."""
    devin = await _brother(db, seeded["chapter"], "Devin")
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin))

    mine = await pnms.get_contact_summary(str(seeded["pnm_a"]), str(seeded["user"]))
    assert mine["met_count"] == 1
    assert mine["met_by_me"] is False


@pytest.mark.asyncio
async def test_removing_a_contact_only_removes_your_own(seeded, db, pnms):
    devin = await _brother(db, seeded["chapter"], "Devin")
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]))
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin))

    summary = await pnms.remove_contact(str(seeded["pnm_a"]), str(seeded["user"]))

    assert summary["met_by_me"] is False
    assert summary["met_count"] == 1, "removing mine must not remove Devin's"


@pytest.mark.asyncio
async def test_removing_a_contact_is_scoped_to_the_event(seeded, db, pnms):
    """Undoing a mis-tap at tonight's event must not erase last week's."""
    other_event = await db.fetchval(
        "INSERT INTO events (chapter_id, name, date) VALUES ($1, 'Later', now()) RETURNING id",
        seeded["chapter"],
    )
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(seeded["event"]))
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(other_event))

    await pnms.remove_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(other_event))

    remaining = await db.fetch(
        "SELECT event_id FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    )
    assert [r["event_id"] for r in remaining] == [seeded["event"]]


@pytest.mark.asyncio
async def test_removing_an_eventless_contact_does_not_erase_event_ones(seeded, db, pnms):
    """The COALESCE sentinel has to work in both directions."""
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), None)
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(seeded["event"]))

    await pnms.remove_contact(str(seeded["pnm_a"]), str(seeded["user"]), None)

    remaining = await db.fetch(
        "SELECT event_id FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    )
    assert [r["event_id"] for r in remaining] == [seeded["event"]]


@pytest.mark.asyncio
async def test_the_contact_list_names_names(seeded, db, pnms):
    """A count does not prompt anyone to act; "ask Devin" does."""
    devin = await _brother(db, seeded["chapter"], "Devin Alvarez")
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin), str(seeded["event"]), "Solid guy")

    contacts = await pnms.list_contacts(str(seeded["pnm_a"]))
    assert len(contacts) == 1
    assert contacts[0]["name"] == "Devin Alvarez"
    assert contacts[0]["event_name"] == "Smoker"
    assert contacts[0]["note"] == "Solid guy"


@pytest.mark.asyncio
async def test_the_contact_list_shows_each_brother_once(seeded, db, pnms):
    """Four encounters with Devin is one line that says Devin, not four."""
    devin = await _brother(db, seeded["chapter"], "Devin")
    other_event = await db.fetchval(
        "INSERT INTO events (chapter_id, name, date) VALUES ($1, 'Second', now()) RETURNING id",
        seeded["chapter"],
    )
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin), str(seeded["event"]))
    await pnms.log_contact(str(seeded["pnm_a"]), str(devin), str(other_event))

    contacts = await pnms.list_contacts(str(seeded["pnm_a"]))
    assert len(contacts) == 1
    # Most recent encounter wins, so the event shown is the last one.
    assert contacts[0]["event_name"] == "Second"


@pytest.mark.asyncio
async def test_coverage_does_not_multiply_vote_counts(seeded, db, pnms):
    """The trap this feature could easily have walked into.

    Coverage is read with subqueries, not another LEFT JOIN. Joining a second
    one-to-many alongside `votes` multiplies the rows, and every vote count on
    the roster silently doubles per contact logged.
    """
    from python_server import services

    voter = await _brother(db, seeded["chapter"], "Voter")
    await db.execute(
        """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
           VALUES ($1, $2, $3, 'YES', true)""",
        seeded["round"], seeded["pnm_a"], voter,
    )

    # Three separate brothers each log a contact.
    for i in range(3):
        brother = await _brother(db, seeded["chapter"], f"Met {i}")
        await pnms.log_contact(str(seeded["pnm_a"]), str(brother))

    results = await services.VotingService().get_round_results(str(seeded["round"]))
    alice = next(r for r in results if r.name == "Alice Example")

    assert alice.vote_count == 1, "one vote, regardless of how many people met him"
    assert alice.yes_count == 1
    assert alice.favorite_count == 1
    assert alice.met_count == 3


@pytest.mark.asyncio
async def test_deleting_a_pnm_takes_its_contacts(seeded, db, pnms):
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]))
    await db.execute("DELETE FROM pnms WHERE id = $1", seeded["pnm_a"])
    assert await db.fetchval(
        "SELECT COUNT(*) FROM pnm_contacts WHERE pnm_id = $1", seeded["pnm_a"]
    ) == 0


@pytest.mark.asyncio
async def test_a_deleted_event_keeps_the_contact(seeded, db, pnms):
    """Who met him is the durable fact; where is incidental."""
    await pnms.log_contact(str(seeded["pnm_a"]), str(seeded["user"]), str(seeded["event"]))
    await db.execute("DELETE FROM events WHERE id = $1", seeded["event"])

    summary = await pnms.get_contact_summary(str(seeded["pnm_a"]), str(seeded["user"]))
    assert summary["met_count"] == 1
    assert summary["met_by_me"] is True
