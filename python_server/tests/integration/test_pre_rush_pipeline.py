"""
The pre-rush pipeline.

A chapter spends two or three months before formal rush gathering names --
Instagram DMs, the activities fair, referrals -- and until now none of it had
anywhere to live. Migration 0015 puts prospects in the same table as PNMs so
notes, tags and photos work from first contact.

The property those tests exist to protect is the boundary: a prospect must not
leak into anything that treats a row as a rush candidate. If prospects appear on
the roster they inflate the PNM count, land in voting rounds, and skew analytics
-- and nobody notices until someone is being voted on who has never been to an
event.
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


async def _prospect(db, chapter_id, name, **kw):
    return await db.fetchval(
        """INSERT INTO pnms (chapter_id, name, stage, source, contact_status,
                             instagram_handle, owner_user_id)
           VALUES ($1, $2, 'prospect', $3, $4, $5, $6) RETURNING id""",
        chapter_id, name, kw.get("source"), kw.get("contact_status", "new"),
        kw.get("instagram_handle"), kw.get("owner_user_id"),
    )


@pytest.mark.asyncio
async def test_existing_pnms_are_untouched_by_the_migration(seeded, db):
    """Every row that predates 0015 must still be a PNM on the roster."""
    stages = await db.fetch(
        "SELECT stage FROM pnms WHERE chapter_id = $1", seeded["chapter"]
    )
    assert {r["stage"] for r in stages} == {"pnm"}


@pytest.mark.asyncio
async def test_a_prospect_needs_only_a_handle(seeded, db, pnms):
    """The July DM case: a name and an Instagram handle, nothing else.

    Requiring an email here would push exactly these people back into the inbox
    the feature exists to empty.
    """
    from python_server.models import PNMCreate, PNMSource, PNMStage

    created = await pnms.create_pnm(
        PNMCreate(
            name="Sam Interested",
            stage=PNMStage.PROSPECT,
            source=PNMSource.INSTAGRAM,
            instagram_handle="@Sam_Interested",
        ),
        str(seeded["chapter"]),
    )
    assert created.stage == "prospect"
    assert created.email is None
    # Stored bare and lowercased, so @handle, handle and a profile URL all match.
    assert created.instagram_handle == "sam_interested"


@pytest.mark.asyncio
async def test_a_formal_pnm_still_requires_an_email(seeded, pnms):
    from fastapi import HTTPException
    from python_server.models import PNMCreate

    with pytest.raises(HTTPException) as exc:
        await pnms.create_pnm(PNMCreate(name="No Email"), str(seeded["chapter"]))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_a_prospect_with_no_contact_details_at_all_is_refused(seeded, pnms):
    """A row with only a name is not a prospect, it is a typo."""
    from fastapi import HTTPException
    from python_server.models import PNMCreate, PNMStage

    with pytest.raises(HTTPException) as exc:
        await pnms.create_pnm(
            PNMCreate(name="Ghost", stage=PNMStage.PROSPECT), str(seeded["chapter"])
        )
    assert exc.value.status_code == 400
    assert "Instagram" in exc.value.detail


@pytest.mark.asyncio
async def test_prospects_stay_off_the_roster(seeded, db):
    """The boundary that matters. A prospect must not read as a rush candidate."""
    await _prospect(db, seeded["chapter"], "Not Yet Rushing")

    roster = await db.fetch(
        "SELECT name FROM pnms WHERE chapter_id = $1 AND stage <> 'prospect'",
        seeded["chapter"],
    )
    names = {r["name"] for r in roster}
    assert names == {"Alice Example", "Bob Example"}
    assert "Not Yet Rushing" not in names


@pytest.mark.asyncio
async def test_converting_a_prospect_keeps_their_notes_and_tags(seeded, db, pnms):
    """The reason prospects share a table with PNMs.

    A separate prospects table would mean conversion is a copy, and a copy is
    where the notes from three months of conversation get dropped.
    """
    from python_server.models import ContactStatus, PipelineUpdate, PNMStage

    prospect = await _prospect(db, seeded["chapter"], "Owen Convert", source="instagram")
    await db.execute(
        """INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous)
           VALUES ($1, $2, 'Met him at the fair, seemed sharp', false)""",
        prospect, seeded["user"],
    )
    tag = await db.fetchval(
        "INSERT INTO tags (chapter_id, label) VALUES ($1, 'Referred') RETURNING id",
        seeded["chapter"],
    )
    await db.execute("INSERT INTO pnm_tags (pnm_id, tag_id) VALUES ($1, $2)", prospect, tag)

    await pnms.update_pipeline(str(prospect), PipelineUpdate(stage=PNMStage.PNM))

    assert await db.fetchval("SELECT stage FROM pnms WHERE id = $1", prospect) == "pnm"
    assert await db.fetchval("SELECT COUNT(*) FROM pnm_notes WHERE pnm_id = $1", prospect) == 1
    assert await db.fetchval("SELECT COUNT(*) FROM pnm_tags WHERE pnm_id = $1", prospect) == 1
    # And the source survives, so conversion rate by channel stays computable.
    assert await db.fetchval("SELECT source FROM pnms WHERE id = $1", prospect) == "instagram"


@pytest.mark.asyncio
async def test_the_normalizing_trigger_folds_messy_input(seeded, db):
    """Rush week is not the time to reject a request over letter case."""
    pnm = await db.fetchval(
        """INSERT INTO pnms (chapter_id, name, stage, source, contact_status, instagram_handle)
           VALUES ($1, 'Messy Case', 'PROSPECT', 'Instagram', 'CONTACTED', '  @Mixed_Case ')
           RETURNING id""",
        seeded["chapter"],
    )
    row = await db.fetchrow(
        "SELECT stage, source, contact_status, instagram_handle FROM pnms WHERE id = $1", pnm
    )
    assert row["stage"] == "prospect"
    assert row["source"] == "instagram"
    assert row["contact_status"] == "contacted"
    assert row["instagram_handle"] == "mixed_case"


@pytest.mark.asyncio
async def test_an_unknown_source_is_kept_as_other_not_rejected(seeded, db):
    """A mistyped ?source= in a shared link must not lose the submission."""
    pnm = await db.fetchval(
        """INSERT INTO pnms (chapter_id, name, stage, source)
           VALUES ($1, 'Odd Source', 'prospect', 'tiktok') RETURNING id""",
        seeded["chapter"],
    )
    assert await db.fetchval("SELECT source FROM pnms WHERE id = $1", pnm) == "other"


@pytest.mark.asyncio
async def test_the_board_groups_prospects_and_counts_unowned(seeded, db, pnms):
    """"Nobody owns this one" is the number the rush chair acts on."""
    await _prospect(db, seeded["chapter"], "Unclaimed A")
    await _prospect(db, seeded["chapter"], "Unclaimed B", contact_status="contacted")
    await _prospect(db, seeded["chapter"], "Claimed", owner_user_id=seeded["user"],
                    contact_status="responded")

    board = await pnms.list_pipeline(str(seeded["chapter"]))

    assert board["counts"]["prospects"] == 3
    assert board["counts"]["unowned"] == 2
    assert board["counts"]["contacted"] == 1
    assert board["counts"]["responded"] == 1
    # The seeded chapter's two real PNMs are counted separately, not mixed in.
    assert board["counts"]["pnms"] == 2

    claimed = next(p for p in board["prospects"] if p["name"] == "Claimed")
    assert claimed["owner_name"] == "admin@test.local"


@pytest.mark.asyncio
async def test_mine_filters_to_one_brother_but_counts_stay_chapter_wide(seeded, db, pnms):
    """"My 1 of the chapter's 3" -- filtering the board must not hide the total."""
    await _prospect(db, seeded["chapter"], "Someone Elses")
    await _prospect(db, seeded["chapter"], "Not Mine Either")
    await _prospect(db, seeded["chapter"], "Mine", owner_user_id=seeded["user"])

    board = await pnms.list_pipeline(str(seeded["chapter"]), owner_user_id=str(seeded["user"]))

    assert [p["name"] for p in board["prospects"]] == ["Mine"]
    assert board["counts"]["prospects"] == 3


@pytest.mark.asyncio
async def test_touch_stamps_the_time_server_side(seeded, db, pnms):
    """Clients get time zones wrong; the server does not."""
    from python_server.models import ContactStatus, PipelineUpdate

    prospect = await _prospect(db, seeded["chapter"], "Touched")
    assert await db.fetchval("SELECT last_contacted_at FROM pnms WHERE id = $1", prospect) is None

    await pnms.update_pipeline(
        str(prospect),
        PipelineUpdate(contact_status=ContactStatus.CONTACTED, touch=True),
    )

    row = await db.fetchrow(
        "SELECT contact_status, last_contacted_at FROM pnms WHERE id = $1", prospect
    )
    assert row["contact_status"] == "contacted"
    assert row["last_contacted_at"] is not None


@pytest.mark.asyncio
async def test_an_owner_can_be_cleared(seeded, db, pnms):
    """Unassigning is how a prospect gets handed back to the pool."""
    from python_server.models import PipelineUpdate

    prospect = await _prospect(db, seeded["chapter"], "Handed Back", owner_user_id=seeded["user"])
    await pnms.update_pipeline(str(prospect), PipelineUpdate(owner_user_id=""))
    assert await db.fetchval("SELECT owner_user_id FROM pnms WHERE id = $1", prospect) is None


@pytest.mark.asyncio
async def test_an_empty_patch_is_refused(seeded, db, pnms):
    """Silently succeeding on a no-op update hides a broken client."""
    from fastapi import HTTPException
    from python_server.models import PipelineUpdate

    prospect = await _prospect(db, seeded["chapter"], "Nothing To Do")
    with pytest.raises(HTTPException) as exc:
        await pnms.update_pipeline(str(prospect), PipelineUpdate())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_source_conversion_rates_are_reported(seeded, db, pnms):
    """Which channel actually works, which is the point of tracking source."""
    await _prospect(db, seeded["chapter"], "IG One", source="instagram")
    await _prospect(db, seeded["chapter"], "IG Two", source="instagram")
    await db.execute(
        """INSERT INTO pnms (chapter_id, name, stage, source)
           VALUES ($1, 'IG Converted', 'pnm', 'instagram')""",
        seeded["chapter"],
    )
    await _prospect(db, seeded["chapter"], "Table One", source="tabling")

    board = await pnms.list_pipeline(str(seeded["chapter"]))
    by_source = {r["source"]: r for r in board["by_source"]}

    assert by_source["instagram"]["total"] == 3
    assert by_source["instagram"]["converted"] == 1
    assert by_source["tabling"]["converted"] == 0


@pytest.mark.asyncio
async def test_duplicates_are_surfaced_across_channels(seeded, db, pnms):
    """The same person DMs, then fills in the form, then walks up at tabling."""
    await _prospect(db, seeded["chapter"], "Chris Twice",
                    source="instagram", instagram_handle="chris_t")

    by_handle = await pnms.find_possible_duplicates(
        str(seeded["chapter"]), "Totally Different Name", instagram_handle="@Chris_T"
    )
    assert [m["name"] for m in by_handle] == ["Chris Twice"]

    by_name = await pnms.find_possible_duplicates(str(seeded["chapter"]), "chris twice")
    assert [m["name"] for m in by_name] == ["Chris Twice"]

    assert await pnms.find_possible_duplicates(str(seeded["chapter"]), "Nobody At All") == []


@pytest.mark.asyncio
async def test_a_prospect_is_not_emailed_or_checked_in(seeded, db, pnms, monkeypatch):
    """Creating a PNM mails them a QR code and checks them in to today's event.

    Doing either to somebody who has only sent a DM would be a rush violation on
    most campuses and is wrong regardless.
    """
    from python_server.models import PNMCreate, PNMSource, PNMStage

    sent: list = []

    async def spy(*args, **kwargs):
        sent.append(args)

    monkeypatch.setattr(pnms, "send_qr_email", spy)
    monkeypatch.setattr(pnms, "generate_qr_code", lambda _id: _none())

    async def _none():
        return None

    await pnms.create_pnm(
        PNMCreate(name="Quiet Prospect", stage=PNMStage.PROSPECT,
                  source=PNMSource.INSTAGRAM, instagram_handle="quiet"),
        str(seeded["chapter"]),
    )

    import asyncio
    await asyncio.sleep(0)  # let the fire-and-forget background task run

    assert sent == []
    assert await db.fetchval(
        """SELECT COUNT(*) FROM event_attendance ea
           JOIN pnms p ON p.id = ea.pnm_id WHERE p.name = 'Quiet Prospect'"""
    ) == 0


@pytest.mark.asyncio
async def test_the_roster_query_survives_both_features(seeded, db, db_manager, monkeypatch):
    """A merge hazard, not a feature.

    The roster query carries a correlated `met_by_me` subquery from contact
    coverage that is bound to `$2`, and a stage filter from the pipeline that
    appends its own placeholder. Numbering them independently is how one of them
    ends up reading the other's parameter -- a wrong answer if the types happen
    to line up, a runtime error if they do not. This drives the real handler so
    the numbering is exercised rather than assumed.
    """
    from python_server import routes, services

    monkeypatch.setattr(services, "get_db", lambda: db_manager)
    monkeypatch.setattr(routes, "get_db", lambda: db_manager)

    await _prospect(db, seeded["chapter"], "Still A Prospect", source="instagram")
    await db.execute(
        "INSERT INTO pnm_contacts (pnm_id, user_id) VALUES ($1, $2)",
        seeded["pnm_a"], seeded["user"],
    )
    user = {"user_id": str(seeded["user"])}

    # Default: formal rush only, and the viewer's own contact is reflected.
    roster = await routes.get_pnms(
        chapter_id=str(seeded["chapter"]), include_archived=False,
        stage=None, current_user=user,
    )
    assert "Still A Prospect" not in {p["name"] for p in roster}
    met = next(p for p in roster if p["id"] == str(seeded["pnm_a"]))
    assert met["met_by_me"] is True and met["met_count"] == 1

    # With a stage filter the placeholder shifts to $3. If the two numbering
    # schemes disagree this is where it shows.
    prospects = await routes.get_pnms(
        chapter_id=str(seeded["chapter"]), include_archived=False,
        stage="prospect", current_user=user,
    )
    assert {p["name"] for p in prospects} == {"Still A Prospect"}
    assert prospects[0]["met_by_me"] is False

    everyone = await routes.get_pnms(
        chapter_id=str(seeded["chapter"]), include_archived=False,
        stage="all", current_user=user,
    )
    assert "Still A Prospect" in {p["name"] for p in everyone}
    assert len(everyone) > len(prospects)
