"""
Adding PNMs to a live session that is already running.

A live session's round is built from the whole active roster when the chair
presses Start Session (routes.py create_session). Anyone who joined the roster
after that -- a walk-up added in Rush Mode, a prospect moved to rush, an
unarchived PNM, a CSV import -- used to be left out until the next session,
with nothing on screen to say so.

The rule here: while a live session is open, a PNM who becomes eligible
(not archived, not a prospect) is appended to the end of that session's
running order, so the chair reaches them after everyone already queued.

Only rounds with an open live session are touched. Rounds created by
"Make cuts" are deliberately the survivors of the previous round and never
grow on their own.
"""

from __future__ import annotations

import logging
from typing import Iterable

from .database import get_db

logger = logging.getLogger(__name__)


async def add_to_live_session(chapter_id: str, pnm_ids: Iterable[str]) -> int:
    """Append newly eligible PNMs to the chapter's open live session.

    Returns how many were added. Never raises: a failure here must not stop
    the PNM itself from being created or updated, so it is logged instead.
    """
    ids = [str(p) for p in pnm_ids if p]
    if not ids or not chapter_id:
        return 0
    try:
        db = get_db()
        # One statement, so two PNMs added at the same moment cannot both read
        # the same "last position" and collide.
        row = await db.execute_one(
            """
            WITH live AS (
                SELECT vr.id AS round_id
                FROM sessions s
                JOIN voting_rounds vr ON vr.id = s.round_id
                WHERE vr.chapter_id = $1::uuid
                  AND s.ended_at IS NULL
                  AND vr.status = 'ACTIVE'
                ORDER BY s.started_at DESC
                LIMIT 1
                FOR UPDATE OF vr
            ),
            fresh AS (
                SELECT p.id, p.name
                FROM pnms p, live
                WHERE p.id = ANY($2::uuid[])
                  AND p.chapter_id = $1::uuid
                  AND p.archived = false
                  AND p.stage <> 'prospect'
                  AND NOT EXISTS (
                      SELECT 1 FROM round_pnms rp
                      WHERE rp.round_id = live.round_id AND rp.pnm_id = p.id
                  )
            ),
            base AS (
                SELECT COALESCE(MAX(rp.order_index), -1) AS last_index
                FROM round_pnms rp, live
                WHERE rp.round_id = live.round_id
            ),
            ins AS (
                INSERT INTO round_pnms (round_id, pnm_id, order_index)
                SELECT live.round_id, f.id,
                       base.last_index + ROW_NUMBER() OVER (ORDER BY f.name, f.id)
                FROM fresh f, live, base
                ON CONFLICT (round_id, pnm_id) DO NOTHING
                RETURNING pnm_id, order_index
            ),
            upd AS (
                UPDATE voting_rounds vr
                SET selected_pnm_ids = COALESCE(vr.selected_pnm_ids, ARRAY[]::text[])
                    || ARRAY(SELECT pnm_id::text FROM ins ORDER BY order_index)
                FROM live
                WHERE vr.id = live.round_id
                  AND EXISTS (SELECT 1 FROM ins)
                RETURNING vr.id
            )
            SELECT (SELECT COUNT(*) FROM ins) AS added,
                   (SELECT round_id FROM live) AS round_id
            """,
            chapter_id,
            ids,
        )
        added = int(row["added"]) if row else 0
        if added:
            logger.info("Added %s PNM(s) to live round %s", added, row["round_id"])
        return added
    except Exception:
        logger.exception("Could not add PNMs to the live session for chapter %s", chapter_id)
        return 0
