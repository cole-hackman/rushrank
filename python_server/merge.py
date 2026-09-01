"""
Merging two rows that turned out to be the same person.

The roster now has four independent ways in -- the public intake form, CSV
import, walk-ups typed by hand, and the interest link -- so the same person
arrives more than once as a matter of course. `csv_import` already refuses to
insert a duplicate it recognises, but nothing could reunite two rows that
already exist, so a PNM's notes lived under one id and his event attendance
under another. He then reads as half as engaged as he is, twice.

Design
------
The list of child tables is data, not code, and there is a test that reads the
foreign keys pointing at `pnms` straight out of the catalog and fails if any of
them is missing from that list. This module will be wrong the moment somebody
adds a table -- the point is that they find out from a red test rather than from
a chapter noticing months of contact history vanished during a merge.

Every child move is "reassign what does not collide, drop what does". A
collision means both rows already carry the fact -- the same brother voted on
both duplicates, both were checked in to the same event -- so the loser's copy
is redundant, not information being discarded.

Merging is destructive and cannot be undone from the UI, so the before-state of
both rows goes into `audit_log`. That is deliberately the only record: a
`merged_into` tombstone column would have to be carried by every query in the
codebase forever to avoid resurfacing the loser.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException

from .database import get_db

logger = logging.getLogger(__name__)


class ChildTable:
    """A table whose rows point at a PNM, and what makes a row a duplicate."""

    def __init__(self, table: str, column: str = "pnm_id",
                 conflict_key: Optional[tuple[str, ...]] = None):
        self.table = table
        self.column = column
        # Columns that, together with the PNM, must stay unique. None means
        # rows can always be reassigned.
        self.conflict_key = conflict_key


# Every foreign key that references pnms(id). `test_merge_handles_every_fk`
# reads this list against the live catalog, so adding a table without adding it
# here is a test failure rather than silent data loss.
CHILD_TABLES: list[ChildTable] = [
    ChildTable("pnm_tags", conflict_key=("tag_id",)),
    ChildTable("pnm_notes"),
    ChildTable("pnm_answers"),
    ChildTable("votes", conflict_key=("round_id", "voter_user_id")),
    ChildTable("event_attendance", conflict_key=("event_id",)),
    ChildTable("round_pnms", conflict_key=("round_id",)),
    ChildTable("bid_list_entries", conflict_key=("bid_list_id",)),
    # Not a duplicate risk -- a session points at whoever is on screen. If the
    # loser was up, the session should follow the surviving row.
    ChildTable("sessions", column="current_pnm_id"),
]

# Fields filled in on the survivor when it is missing them. The loser often has
# the half the survivor lacks -- an intake form captured the phone number, the
# CSV had the major -- and losing that is the main way a merge does damage.
MERGEABLE_FIELDS = [
    "email", "phone", "major", "hometown", "year", "photo_url", "fun_fact",
    "walkout_song", "weirdest_talent", "chick_fil_a_order",
]


async def find_duplicate_groups(chapter_id: str) -> list[dict]:
    """Rows that look like the same person, strongest signal first.

    Email is near-certain, phone is very likely, and an identical name is a
    prompt to look rather than a verdict -- two different people called John
    Smith is a real thing, so the caller is shown the match and decides.
    """
    db = get_db()
    rows = await db.execute_query(
        """
        WITH candidates AS (
          SELECT lower(email) AS key, 'email' AS reason, array_agg(id) AS ids
          FROM pnms WHERE chapter_id = $1::uuid AND archived = false AND email IS NOT NULL
          GROUP BY lower(email) HAVING COUNT(*) > 1

          UNION ALL

          SELECT regexp_replace(phone, '\\D', '', 'g') AS key, 'phone', array_agg(id)
          FROM pnms WHERE chapter_id = $1::uuid AND archived = false
            AND phone IS NOT NULL AND length(regexp_replace(phone, '\\D', '', 'g')) >= 10
          GROUP BY regexp_replace(phone, '\\D', '', 'g') HAVING COUNT(*) > 1

          UNION ALL

          SELECT lower(btrim(name)) AS key, 'name', array_agg(id)
          FROM pnms WHERE chapter_id = $1::uuid AND archived = false
          GROUP BY lower(btrim(name)) HAVING COUNT(*) > 1
        )
        SELECT key, reason, ids FROM candidates
        ORDER BY CASE reason WHEN 'email' THEN 0 WHEN 'phone' THEN 1 ELSE 2 END, key
        """,
        chapter_id,
    )

    groups: list[dict] = []
    seen: set[frozenset] = set()
    for row in rows:
        ids = frozenset(str(i) for i in row["ids"])
        # An email match and a name match on the same pair is one duplicate,
        # reported once under the stronger reason.
        if ids in seen:
            continue
        seen.add(ids)

        members = await db.execute_query(
            """
            SELECT p.id, p.name, p.email, p.phone, p.major, p.year, p.photo_url,
                   p.created_at, p.archived,
                   (SELECT COUNT(*) FROM pnm_notes n WHERE n.pnm_id = p.id) AS notes,
                   (SELECT COUNT(*) FROM event_attendance a WHERE a.pnm_id = p.id) AS attendance,
                   (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = p.id) AS votes
            FROM pnms p WHERE p.id = ANY($1::uuid[]) ORDER BY p.created_at
            """,
            list(ids),
        )
        groups.append({
            "reason": row["reason"],
            "key": row["key"],
            "members": [
                {
                    "id": str(m["id"]),
                    "name": m["name"],
                    "email": m["email"],
                    "phone": m["phone"],
                    "major": m["major"],
                    "year": m["year"],
                    "photo_url": m["photo_url"],
                    "created_at": m["created_at"],
                    # Shown so whoever merges can pick the richer row to keep,
                    # rather than guessing from the name alone.
                    "notes": m["notes"],
                    "attendance": m["attendance"],
                    "votes": m["votes"],
                }
                for m in members
            ],
        })
    return groups


async def merge_pnms(winner_id: str, loser_id: str) -> dict:
    """Fold `loser` into `winner` and delete it. Destructive; caller audits.

    Not wrapped in an explicit transaction here: the pool hands out a
    connection per statement, so this cannot be made atomic at this layer
    without restructuring `DatabaseManager`. The order below is chosen so an
    interruption leaves data merged-but-not-deleted -- recoverable and visible
    -- rather than deleted-but-not-merged.
    """
    if winner_id == loser_id:
        raise HTTPException(status_code=400, detail="Cannot merge a PNM into itself")

    db = get_db()
    rows = await db.execute_query(
        "SELECT id, chapter_id, name FROM pnms WHERE id = ANY($1::uuid[])",
        [winner_id, loser_id],
    )
    if len(rows) != 2:
        raise HTTPException(status_code=404, detail="One or both PNMs not found")
    if len({str(r["chapter_id"]) for r in rows}) != 1:
        # Merging across chapters would move one chapter's data into another's.
        raise HTTPException(status_code=400, detail="PNMs belong to different chapters")

    before = await _snapshot(db, winner_id, loser_id)

    moved: dict[str, int] = {}
    dropped: dict[str, int] = {}

    for child in CHILD_TABLES:
        if child.conflict_key:
            predicate = " AND ".join(
                f"existing.{col} = child.{col}" for col in child.conflict_key
            )
            result = await db.execute_command(
                f"""
                UPDATE {child.table} AS child
                   SET {child.column} = $1::uuid
                 WHERE child.{child.column} = $2::uuid
                   AND NOT EXISTS (
                       SELECT 1 FROM {child.table} AS existing
                        WHERE existing.{child.column} = $1::uuid AND {predicate}
                   )
                """,
                winner_id, loser_id,
            )
            moved[child.table] = _rowcount(result)

            # What is left collided: the survivor already carries that fact.
            leftover = await db.execute_command(
                f"DELETE FROM {child.table} WHERE {child.column} = $1::uuid",
                loser_id,
            )
            dropped[child.table] = _rowcount(leftover)
        else:
            result = await db.execute_command(
                f"UPDATE {child.table} SET {child.column} = $1::uuid WHERE {child.column} = $2::uuid",
                winner_id, loser_id,
            )
            moved[child.table] = _rowcount(result)

    filled = await _fill_blanks(db, winner_id, loser_id)

    await db.execute_command("DELETE FROM pnms WHERE id = $1::uuid", loser_id)

    return {
        "winner_id": winner_id,
        "loser_id": loser_id,
        "chapter_id": str(rows[0]["chapter_id"]),
        "moved": {k: v for k, v in moved.items() if v},
        "dropped_as_duplicate": {k: v for k, v in dropped.items() if v},
        "fields_filled": filled,
        "before": before,
    }


async def _fill_blanks(db, winner_id: str, loser_id: str) -> list[str]:
    """Take from the loser only what the winner is missing.

    COALESCE in that order, so the survivor's own values always win. A merge
    that overwrote the row you chose to keep would be a surprise.
    """
    assignments = ", ".join(
        f"{f} = COALESCE(w.{f}, l.{f})" for f in MERGEABLE_FIELDS
    )
    returning = ", ".join(
        f"(w.{f} IS NULL AND l.{f} IS NOT NULL) AS filled_{f}" for f in MERGEABLE_FIELDS
    )
    row = await db.execute_one(
        f"""
        WITH w AS (SELECT * FROM pnms WHERE id = $1::uuid),
             l AS (SELECT * FROM pnms WHERE id = $2::uuid),
             flags AS (SELECT {returning} FROM w, l)
        UPDATE pnms SET {assignments}
          FROM w, l
         WHERE pnms.id = $1::uuid
        RETURNING (SELECT to_jsonb(flags) FROM flags) AS flags
        """,
        winner_id, loser_id,
    )
    flags = row["flags"] if row else None
    if isinstance(flags, str):
        import json
        flags = json.loads(flags)
    return [f for f in MERGEABLE_FIELDS if flags and flags.get(f"filled_{f}")]


async def _snapshot(db, winner_id: str, loser_id: str) -> dict:
    """Both rows as they were. The merge cannot be undone from the UI, so this
    is the only record of what the loser held."""
    rows = await db.execute_query(
        """SELECT id, name, email, phone, major, hometown, year, created_at
             FROM pnms WHERE id = ANY($1::uuid[])""",
        [winner_id, loser_id],
    )
    by_id = {str(r["id"]): dict(r) for r in rows}

    def _plain(record):
        return {
            k: (v.isoformat() if hasattr(v, "isoformat") else str(v) if k == "id" else v)
            for k, v in (record or {}).items()
        }

    return {"winner": _plain(by_id.get(winner_id)), "loser": _plain(by_id.get(loser_id))}


def _rowcount(command_tag) -> int:
    """asyncpg returns 'UPDATE 3' / 'DELETE 0'."""
    try:
        return int(str(command_tag).split()[-1])
    except (ValueError, IndexError):
        return 0
