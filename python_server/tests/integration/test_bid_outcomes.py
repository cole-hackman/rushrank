"""
What happened after the bid list was finalized.

The bid list finalized and the trail went cold. A chapter's real question in the
last week of rush is not "who is on the list" -- that was settled -- but "how
many bids do we have left", and the cap counted rows in the `bid` bucket, which
is bids *offered*. Two people declining did not give the chapter two bids back.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture
def bids(db_manager, monkeypatch):
    from python_server import bid_list

    monkeypatch.setattr(bid_list, "get_db", lambda: db_manager)
    return bid_list.BidListService()


@pytest.fixture
async def bid_list_id(seeded, db):
    """A finalized list: both seeded PNMs in the bid bucket, cap of 2."""
    list_id = await db.fetchval(
        """INSERT INTO bid_lists (chapter_id, source_round_id, name, bid_cap, finalized_at)
           VALUES ($1, $2, 'Fall Bids', 2, NOW()) RETURNING id""",
        seeded["chapter"], seeded["round"],
    )
    for position, key in enumerate(("pnm_a", "pnm_b")):
        await db.execute(
            """INSERT INTO bid_list_entries (bid_list_id, pnm_id, bucket, position)
               VALUES ($1, $2, 'bid', $3)""",
            list_id, seeded[key], position,
        )
    return list_id


@pytest.mark.asyncio
async def test_entries_start_pending(bid_list_id, bids):
    board = await bids.get_with_entries(str(bid_list_id))
    assert {e["outcome"] for e in board["entries"]} == {"pending"}
    assert board["outcomes"]["pending"] == 2
    assert board["outcomes"]["accepted"] == 0


@pytest.mark.asyncio
async def test_the_cap_counts_acceptances_not_offers(seeded, bid_list_id, bids):
    """The whole point. Cap 2, both offered, one declines -> one bid back."""
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "offered", str(seeded["user"]))
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_b"]), "offered", str(seeded["user"]))

    board = await bids.get_with_entries(str(bid_list_id))
    assert board["outcomes"]["offered"] == 2
    assert board["outcomes"]["remaining"] == 0

    await bids.set_outcome(
        str(bid_list_id), str(seeded["pnm_b"]), "declined", str(seeded["user"]),
        "Went Sigma Nu",
    )

    board = await bids.get_with_entries(str(bid_list_id))
    assert board["outcomes"]["declined"] == 1
    assert board["outcomes"]["remaining"] == 1, "a decline gives the bid back"


@pytest.mark.asyncio
async def test_accepting_holds_the_bid(seeded, bid_list_id, bids):
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "accepted", str(seeded["user"]))
    board = await bids.get_with_entries(str(bid_list_id))
    assert board["outcomes"]["accepted"] == 1
    assert board["outcomes"]["remaining"] == 1


@pytest.mark.asyncio
async def test_a_decline_reason_is_kept(seeded, bid_list_id, bids, db):
    await bids.set_outcome(
        str(bid_list_id), str(seeded["pnm_a"]), "declined", str(seeded["user"]), "Cost",
    )
    row = await db.fetchrow(
        "SELECT outcome, declined_reason, outcome_at, outcome_by_user_id "
        "FROM bid_list_entries WHERE pnm_id = $1", seeded["pnm_a"],
    )
    assert row["declined_reason"] == "Cost"
    assert row["outcome_at"] is not None
    assert row["outcome_by_user_id"] == seeded["user"]


@pytest.mark.asyncio
async def test_a_stale_reason_is_cleared_when_the_outcome_changes(seeded, bid_list_id, bids, db):
    """Marked declined by mistake, then corrected. Leaving "Cost" behind would
    misreport why the chapter lost people."""
    await bids.set_outcome(
        str(bid_list_id), str(seeded["pnm_a"]), "declined", str(seeded["user"]), "Cost",
    )
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "accepted", str(seeded["user"]))

    row = await db.fetchrow(
        "SELECT outcome, declined_reason FROM bid_list_entries WHERE pnm_id = $1",
        seeded["pnm_a"],
    )
    assert row["outcome"] == "accepted"
    assert row["declined_reason"] is None


@pytest.mark.asyncio
async def test_returning_to_pending_clears_the_timestamp(seeded, bid_list_id, bids, db):
    """A correction is not an event, so it should not read as one."""
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "accepted", str(seeded["user"]))
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "pending", str(seeded["user"]))

    row = await db.fetchrow(
        "SELECT outcome, outcome_at FROM bid_list_entries WHERE pnm_id = $1", seeded["pnm_a"],
    )
    assert row["outcome"] == "pending"
    assert row["outcome_at"] is None


@pytest.mark.asyncio
async def test_a_cut_pnm_cannot_be_accepted(seeded, db, bids, bid_list_id):
    """Nobody offered him anything. Allowing this would corrupt the cap."""
    from fastapi import HTTPException

    await db.execute(
        "UPDATE bid_list_entries SET bucket = 'cut' WHERE pnm_id = $1", seeded["pnm_b"],
    )
    with pytest.raises(HTTPException) as exc:
        await bids.set_outcome(
            str(bid_list_id), str(seeded["pnm_b"]), "accepted", str(seeded["user"]),
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_cut_entries_are_excluded_from_the_tally(seeded, db, bids, bid_list_id):
    """A maybe or a cut is not an outstanding bid and must not consume the cap."""
    await db.execute(
        "UPDATE bid_list_entries SET bucket = 'maybe' WHERE pnm_id = $1", seeded["pnm_b"],
    )
    await bids.set_outcome(str(bid_list_id), str(seeded["pnm_a"]), "accepted", str(seeded["user"]))

    board = await bids.get_with_entries(str(bid_list_id))
    assert board["outcomes"]["accepted"] == 1
    assert board["outcomes"]["pending"] == 0, "the maybe bucket is not a pending bid"
    assert board["outcomes"]["remaining"] == 1


@pytest.mark.asyncio
async def test_an_unknown_outcome_is_refused(seeded, bid_list_id, bids):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        await bids.set_outcome(
            str(bid_list_id), str(seeded["pnm_a"]), "maybe_later", str(seeded["user"]),
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_a_list_with_no_cap_reports_no_remaining(seeded, db, bids):
    """Not every chapter has a cap; "0 bids left" would be a lie for them."""
    list_id = await db.fetchval(
        """INSERT INTO bid_lists (chapter_id, name, bid_cap) VALUES ($1, 'Uncapped', NULL)
           RETURNING id""",
        seeded["chapter"],
    )
    await db.execute(
        """INSERT INTO bid_list_entries (bid_list_id, pnm_id, bucket, position)
           VALUES ($1, $2, 'bid', 0)""",
        list_id, seeded["pnm_a"],
    )
    board = await bids.get_with_entries(str(list_id))
    assert board["outcomes"]["remaining"] is None


@pytest.mark.asyncio
async def test_the_trigger_folds_messy_input(seeded, db, bid_list_id):
    """Same defence-in-depth as 0013 and 0015."""
    await db.execute(
        "UPDATE bid_list_entries SET outcome = '  ACCEPTED ' WHERE pnm_id = $1",
        seeded["pnm_a"],
    )
    assert await db.fetchval(
        "SELECT outcome FROM bid_list_entries WHERE pnm_id = $1", seeded["pnm_a"]
    ) == "accepted"


@pytest.mark.asyncio
async def test_existing_entries_default_to_pending(seeded, db):
    """Rows that predate 0017 must not read as anything having happened."""
    list_id = await db.fetchval(
        "INSERT INTO bid_lists (chapter_id, name) VALUES ($1, 'Legacy') RETURNING id",
        seeded["chapter"],
    )
    await db.execute(
        """INSERT INTO bid_list_entries (bid_list_id, pnm_id, bucket, position)
           VALUES ($1, $2, 'bid', 0)""",
        list_id, seeded["pnm_a"],
    )
    assert await db.fetchval(
        "SELECT outcome FROM bid_list_entries WHERE bid_list_id = $1", list_id
    ) == "pending"
