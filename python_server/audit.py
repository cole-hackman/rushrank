"""
Append-only record of who changed what.

`0013_reconcile_schema.sql` §10 created the `audit_log` table for exactly this,
and nothing ever wrote to it. Two of the things a chapter asks about a voting
tool -- "who cut him?" and "who changed my role?" -- had no answer at all.

The single rule here is that recording must never be able to fail the operation
it is recording. Cutting a round is the meaningful act; the log entry is a
side effect. So `record` swallows everything and logs a warning, the same
posture as `auth.ensure_user_row`.

That is only safe because every statement runs on its own pooled connection --
there is no enclosing request transaction for a failed INSERT to poison. If a
caller ever wraps several statements in an explicit transaction, `record` must
be moved outside it, because in Postgres an error aborts the whole transaction
and catching the exception in Python does not undo that.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .database import get_db

logger = logging.getLogger(__name__)


async def record(
    chapter_id: Optional[str],
    actor_user_id: Optional[str],
    action: str,
    *,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    before: Optional[Any] = None,
    after: Optional[Any] = None,
) -> None:
    """Append one row to `audit_log`. Never raises.

    `action` is a dotted verb -- `round.cutoff`, `pnm.import`,
    `membership.role_change` -- so the viewer can filter on a prefix.
    `before`/`after` are free-form JSON; keep them small and human-readable,
    since the viewer renders them.
    """
    try:
        db = get_db()
        await db.execute_command(
            """
            INSERT INTO audit_log
                (chapter_id, actor_user_id, action, entity_type, entity_id, before, after)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::jsonb, $7::jsonb)
            """,
            str(chapter_id) if chapter_id else None,
            str(actor_user_id) if actor_user_id else None,
            action,
            entity_type,
            str(entity_id) if entity_id else None,
            json.dumps(before) if before is not None else None,
            json.dumps(after) if after is not None else None,
        )
    except Exception as e:  # noqa: BLE001 -- deliberate: see module docstring
        logger.warning(f"audit_log write failed for action={action}: {type(e).__name__}: {e}")


async def list_entries(
    chapter_id: str,
    *,
    limit: int = 100,
    before: Optional[str] = None,
    action_prefix: Optional[str] = None,
) -> list[dict]:
    """Reverse-chronological page of a chapter's audit log.

    Keyset pagination on `created_at` rather than OFFSET, so the
    `(chapter_id, created_at DESC)` index from 0013 does the work and pages
    stay stable while new entries land at the head.
    """
    db = get_db()
    limit = max(1, min(int(limit), 500))

    conditions = ["a.chapter_id = $1::uuid"]
    args: list[Any] = [chapter_id]

    if before:
        args.append(before)
        conditions.append(f"a.created_at < ${len(args)}::timestamptz")
    if action_prefix:
        args.append(f"{action_prefix}%")
        conditions.append(f"a.action LIKE ${len(args)}")

    args.append(limit)

    rows = await db.execute_query(
        f"""
        SELECT a.id, a.action, a.entity_type, a.entity_id, a.before, a.after,
               a.created_at, a.actor_user_id,
               u.name AS actor_name, u.email AS actor_email
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE {' AND '.join(conditions)}
        ORDER BY a.created_at DESC
        LIMIT ${len(args)}
        """,
        *args,
    )

    def _json(value):
        # asyncpg returns jsonb as str unless a codec is registered.
        if isinstance(value, str):
            try:
                return json.loads(value)
            except ValueError:
                return value
        return value

    return [
        {
            "id": str(r["id"]),
            "action": r["action"],
            "entity_type": r["entity_type"],
            "entity_id": str(r["entity_id"]) if r["entity_id"] else None,
            "before": _json(r["before"]),
            "after": _json(r["after"]),
            "created_at": r["created_at"],
            "actor_user_id": str(r["actor_user_id"]) if r["actor_user_id"] else None,
            "actor_name": r["actor_name"],
            "actor_email": r["actor_email"],
        }
        for r in rows
    ]
