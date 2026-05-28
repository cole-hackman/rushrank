"""Bid-list builder service.

Owns CRUD + locking + exports for the post-rush bid-list workflow.
Kept separate from python_server/services.py to avoid further bloat.
"""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from .database import get_db


LOCK_TTL_SECONDS = 600  # 10 minutes
_POS_STEP = 1024        # gap between entries to avoid constant renumbering


class BidListService:
    """All bid-list business logic. Stateless; uses the global db pool."""

    _BUCKET_ORDER = ("bid", "maybe", "cut")
    _BUCKET_LABEL = {"bid": "Bid", "maybe": "Maybe", "cut": "Cut"}

    async def create_from_round(
        self,
        chapter_id: str,
        source_round_id: str,
        name: str,
        bid_cap: Optional[int],
        user_id: str,
    ) -> dict:
        """Create a new bid list seeded from a completed voting round.

        Every PNM in the round's selected_pnm_ids is inserted as bucket='maybe',
        positioned by their final score (highest score = position 0).
        """
        db = get_db()
        round_row = await db.execute_one(
            "SELECT selected_pnm_ids FROM voting_rounds WHERE id = $1",
            source_round_id,
        )
        if not round_row:
            raise HTTPException(status_code=404, detail="Source round not found")
        pnm_ids: list[str] = list(round_row["selected_pnm_ids"] or [])
        if not pnm_ids:
            raise HTTPException(status_code=400, detail="Round has no PNMs to seed")

        scored = await db.execute_query(
            """SELECT v.pnm_id,
                      SUM(CASE WHEN v.score >= 7 THEN 1
                               WHEN v.score <= 4 THEN -1
                               ELSE 0 END)
                      + SUM(CASE WHEN v.is_favorite THEN 1 ELSE 0 END) AS score
                 FROM votes v
                WHERE v.round_id = $1 AND v.pnm_id = ANY($2::uuid[])
             GROUP BY v.pnm_id""",
            source_round_id, pnm_ids,
        )
        score_map = {str(r["pnm_id"]): int(r["score"] or 0) for r in scored}
        ordered = sorted(pnm_ids, key=lambda pid: -score_map.get(str(pid), 0))

        new_list = await db.execute_one(
            """INSERT INTO bid_lists (chapter_id, source_round_id, name, bid_cap)
               VALUES ($1, $2, $3, $4)
               RETURNING id, chapter_id, source_round_id, name, bid_cap,
                         locked_by, locked_at, finalized_at, created_at, updated_at""",
            chapter_id, source_round_id, name, bid_cap,
        )

        for i, pid in enumerate(ordered):
            await db.execute_command(
                """INSERT INTO bid_list_entries
                     (bid_list_id, pnm_id, bucket, position)
                   VALUES ($1, $2, 'maybe', $3)""",
                new_list["id"], pid, i * _POS_STEP,
            )

        return self._row_to_dict(new_list)

    async def get_active(self, chapter_id: str) -> Optional[dict]:
        """Most recent bid list for the chapter, regardless of finalized state."""
        db = get_db()
        row = await db.execute_one(
            """SELECT id, chapter_id, source_round_id, name, bid_cap,
                      locked_by, locked_at, finalized_at, created_at, updated_at
                 FROM bid_lists
                WHERE chapter_id = $1
             ORDER BY created_at DESC
                LIMIT 1""",
            chapter_id,
        )
        return self._row_to_dict(row) if row else None

    async def get_with_entries(self, bid_list_id: str) -> dict:
        """Return the bid list + all entries (with PNM info + vote summary)."""
        db = get_db()
        row = await db.execute_one(
            """SELECT id, chapter_id, source_round_id, name, bid_cap,
                      locked_by, locked_at, finalized_at, created_at, updated_at
                 FROM bid_lists WHERE id = $1""",
            bid_list_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Bid list not found")

        rows = await db.execute_query(
            """SELECT e.pnm_id, e.bucket::text AS bucket, e.position,
                      p.name, p.year, p.major, p.photo_url,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.score >= 7)       AS up_count,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.score <= 4)       AS down_count,
                      (SELECT COUNT(*) FROM votes v WHERE v.pnm_id = e.pnm_id AND v.is_favorite = true) AS star_count
                 FROM bid_list_entries e
                 JOIN pnms p ON p.id = e.pnm_id
                WHERE e.bid_list_id = $1
             ORDER BY e.bucket, e.position""",
            bid_list_id,
        )
        entries = [
            {
                "pnm_id": str(r["pnm_id"]),
                "bucket": r["bucket"],
                "position": int(r["position"]),
                "name": r["name"],
                "year": r.get("year") or "",
                "major": r.get("major") or "",
                "photo_url": r.get("photo_url"),
                "vote_summary": {
                    "up": int(r.get("up_count") or 0),
                    "down": int(r.get("down_count") or 0),
                    "star": int(r.get("star_count") or 0),
                },
            }
            for r in rows
        ]
        return {"bid_list": self._row_to_dict(row), "entries": entries}

    async def acquire_lock(self, bid_list_id: str, user_id: str) -> dict:
        """Acquire the editor lock, taking over a stale (>10min old) lock if needed."""
        db = get_db()
        current = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not current:
            raise HTTPException(status_code=404, detail="Bid list not found")
        held_by = current["locked_by"]
        held_at = current["locked_at"]
        if held_by and str(held_by) != str(user_id) and held_at is not None:
            age = (datetime.now(timezone.utc) - held_at).total_seconds()
            if age < LOCK_TTL_SECONDS:
                raise HTTPException(
                    status_code=409,
                    detail={"reason": "locked", "locked_by": str(held_by),
                            "locked_at": held_at.isoformat()},
                )
        updated = await db.execute_one(
            """UPDATE bid_lists
                  SET locked_by = $1, locked_at = NOW(), updated_at = NOW()
                WHERE id = $2
            RETURNING locked_by, locked_at""",
            user_id, bid_list_id,
        )
        return {
            "locked_by": str(updated["locked_by"]),
            "locked_at": updated["locked_at"].isoformat(),
        }

    async def refresh_lock(self, bid_list_id: str, user_id: str) -> dict:
        db = get_db()
        current = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not current or str(current["locked_by"] or "") != str(user_id):
            raise HTTPException(status_code=409, detail="You do not hold the lock")
        await db.execute_command(
            "UPDATE bid_lists SET locked_at = NOW(), updated_at = NOW() WHERE id = $1",
            bid_list_id,
        )
        return {"locked_by": str(user_id), "locked_at": datetime.now(timezone.utc).isoformat()}

    async def release_lock(self, bid_list_id: str, user_id: str) -> None:
        db = get_db()
        await db.execute_command(
            """UPDATE bid_lists
                  SET locked_by = NULL, locked_at = NULL, updated_at = NOW()
                WHERE id = $1 AND locked_by = $2""",
            bid_list_id, user_id,
        )

    async def _require_lock(self, bid_list_id: str, user_id: str) -> None:
        db = get_db()
        row = await db.execute_one(
            "SELECT locked_by, locked_at FROM bid_lists WHERE id = $1",
            bid_list_id,
        )
        if not row or str(row["locked_by"] or "") != str(user_id):
            raise HTTPException(status_code=409, detail="You must hold the lock to edit")
        if row["locked_at"] is not None:
            age = (datetime.now(timezone.utc) - row["locked_at"]).total_seconds()
            if age >= LOCK_TTL_SECONDS:
                raise HTTPException(status_code=409, detail="Your lock has expired")

    async def update_entry(
        self,
        bid_list_id: str,
        pnm_id: str,
        bucket: str,
        position: int,
        user_id: str,
    ) -> dict:
        if bucket not in ("cut", "maybe", "bid"):
            raise HTTPException(status_code=400, detail=f"Invalid bucket: {bucket}")
        await self._require_lock(bid_list_id, user_id)
        db = get_db()
        await db.execute_command(
            """UPDATE bid_list_entries
                  SET bucket = $1::bid_bucket, position = $2, updated_at = NOW()
                WHERE bid_list_id = $3 AND pnm_id = $4""",
            bucket, position, bid_list_id, pnm_id,
        )
        return {"pnm_id": pnm_id, "bucket": bucket, "position": position}

    async def finalize(self, bid_list_id: str, user_id: str) -> dict:
        await self._require_lock(bid_list_id, user_id)
        db = get_db()
        row = await db.execute_one(
            """UPDATE bid_lists
                  SET finalized_at = NOW(), updated_at = NOW()
                WHERE id = $1
            RETURNING finalized_at""",
            bid_list_id,
        )
        return {"finalized_at": row["finalized_at"].isoformat()}

    async def export_csv(self, bid_list_id: str) -> str:
        data = await self.get_with_entries(bid_list_id)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["bucket", "name", "year", "major", "up", "down", "star"])
        for bucket in self._BUCKET_ORDER:
            for e in data["entries"]:
                if e["bucket"] != bucket:
                    continue
                w.writerow([
                    e["bucket"], e["name"], e["year"], e["major"],
                    e["vote_summary"]["up"], e["vote_summary"]["down"], e["vote_summary"]["star"],
                ])
        return buf.getvalue()

    async def export_pdf(self, bid_list_id: str) -> bytes:
        data = await self.get_with_entries(bid_list_id)
        bid_list = data["bid_list"]
        entries = data["entries"]

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=LETTER,
                                topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                                leftMargin=0.6 * inch, rightMargin=0.6 * inch)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22, leading=26)
        header_style = ParagraphStyle("header", parent=styles["Heading2"], fontSize=14, spaceAfter=6)
        flow = []
        flow.append(Paragraph(bid_list["name"], title_style))
        meta = f"Bid cap: {bid_list['bid_cap'] or '—'}"
        if bid_list.get("finalized_at"):
            meta += f" · Finalized {bid_list['finalized_at'][:10]}"
        flow.append(Paragraph(meta, styles["Normal"]))
        flow.append(Spacer(1, 0.25 * inch))

        for bucket in self._BUCKET_ORDER:
            rows = [e for e in entries if e["bucket"] == bucket]
            if not rows:
                continue
            flow.append(Paragraph(f"{self._BUCKET_LABEL[bucket]} ({len(rows)})", header_style))
            tbl_data = [["Name", "Year", "Major", "Vote"]]
            for e in rows:
                v = e["vote_summary"]
                tbl_data.append([
                    e["name"], e["year"] or "", e["major"] or "",
                    f"👍 {v['up']}  👎 {v['down']}  ⭐ {v['star']}",
                ])
            tbl = Table(tbl_data, colWidths=[2.4 * inch, 0.9 * inch, 1.9 * inch, 1.8 * inch])
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F4F0E4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0A0A0A")),
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
                ("FONT", (0, 1), (-1, -1), "Helvetica", 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                    [colors.white, colors.HexColor("#FBF9F2")]),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E8E3D6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E8E3D6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            flow.append(tbl)
            flow.append(Spacer(1, 0.2 * inch))

        doc.build(flow)
        return buf.getvalue()

    @staticmethod
    def _row_to_dict(row) -> dict:
        return {
            "id": str(row["id"]),
            "chapter_id": str(row["chapter_id"]),
            "source_round_id": str(row["source_round_id"]) if row["source_round_id"] else None,
            "name": row["name"],
            "bid_cap": row["bid_cap"],
            "locked_by": str(row["locked_by"]) if row["locked_by"] else None,
            "locked_at": row["locked_at"].isoformat() if row["locked_at"] else None,
            "finalized_at": row["finalized_at"].isoformat() if row["finalized_at"] else None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
