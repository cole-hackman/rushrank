"""
Roster import from a spreadsheet.

The landing page has advertised this since the beginning -- `HowItWorks.tsx`
step 02 reads "Import your PNMs -- CSV upload or one-by-one" -- and only the
one-by-one half existed. A chapter with 120 rushees was expected to type them
in.

Parsing happens here rather than in the browser for two reasons: the frontend
has no CSV library and adding one to ship a single feature is a poor trade, and
validation has to agree with the database anyway. Doing it in one place means
the dry-run preview is produced by exactly the code that will do the insert, so
what the user approves is what runs.

The default column order matches `ExportService.export_pnms_csv`, so a file
exported from RushRank re-imports with no manual mapping.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from typing import Any, Optional

from fastapi import HTTPException

from .database import get_db

logger = logging.getLogger(__name__)

# Bounds. A chapter's rush roster is hundreds of rows, not tens of thousands;
# anything past this is a mistake or an attack, and either way the useful
# response is a clear error rather than a timeout.
MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 2000
PREVIEW_ROWS = 20

# Fields we can populate. `name` is the only one that is required -- 0013
# relaxed the legacy NOT NULL on `pnms.major` precisely so partial rosters
# and walk-up intake could succeed.
FIELDS = ["name", "email", "phone", "major", "hometown", "year", "photo_url", "tags"]

# Header aliases, keyed by the normalized form (lowercased, non-alphanumerics
# stripped). Covers what chapters actually have in their spreadsheets.
_HEADER_ALIASES: dict[str, str] = {
    "name": "name",
    "fullname": "name",
    "pnmname": "name",
    "pnm": "name",
    "firstlast": "name",
    "email": "email",
    "emailaddress": "email",
    "e mail": "email",
    "phone": "phone",
    "phonenumber": "phone",
    "cell": "phone",
    "cellphone": "phone",
    "mobile": "phone",
    "major": "major",
    "studyingmajor": "major",
    "hometown": "hometown",
    "city": "hometown",
    "homecity": "hometown",
    "year": "year",
    "classyear": "year",
    "grade": "year",
    "gradyear": "year",
    "photourl": "photo_url",
    "photo": "photo_url",
    "picture": "photo_url",
    "image": "photo_url",
    "imageurl": "photo_url",
    "headshot": "photo_url",
    "tags": "tags",
    "tag": "tags",
    "labels": "tags",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_header(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (header or "").strip().lower())


def detect_mapping(columns: list[str]) -> dict[str, str]:
    """Guess csv-column -> pnm-field. Unrecognized columns are simply omitted."""
    mapping: dict[str, str] = {}
    for col in columns:
        field = _HEADER_ALIASES.get(_normalize_header(col))
        # First column wins, so a file with both "Name" and "PNM Name" does not
        # flip-flop depending on dict ordering.
        if field and field not in mapping.values():
            mapping[col] = field
    return mapping


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _split_tags(value: Optional[str]) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[;,|]", value)
    seen: list[str] = []
    for part in parts:
        label = part.strip()
        if label and label not in seen:
            seen.append(label)
    return seen


def parse_csv(raw: bytes, mapping_override: Optional[dict[str, str]] = None) -> dict:
    """Decode, map and validate. Pure -- touches no database."""
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large (limit {MAX_BYTES // (1024 * 1024)} MB)",
        )

    try:
        # utf-8-sig strips the byte-order mark Excel writes, which would
        # otherwise turn the first header into "﻿Name" and defeat detection.
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Could not read the file as text")

    reader = csv.DictReader(io.StringIO(text))
    columns = [c for c in (reader.fieldnames or []) if c is not None]
    if not columns:
        raise HTTPException(status_code=400, detail="The file has no header row")

    mapping = dict(detect_mapping(columns))
    if mapping_override:
        # An override of "" means "ignore this column".
        for col, field in mapping_override.items():
            if field:
                if field not in FIELDS:
                    raise HTTPException(status_code=400, detail=f"Unknown field: {field}")
                mapping[col] = field
            else:
                mapping.pop(col, None)

    if "name" not in mapping.values():
        raise HTTPException(
            status_code=400,
            detail="No column maps to 'name'. Pick which column holds the PNM's name.",
        )

    rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    seen_emails: dict[str, int] = {}
    seen_names: dict[str, int] = {}

    for index, raw_row in enumerate(reader):
        # +2: one for the header, one because humans count from 1.
        line = index + 2
        if index >= MAX_ROWS:
            errors.append({"row": line, "message": f"Stopped at the {MAX_ROWS}-row limit"})
            break

        mapped: dict[str, Any] = {}
        for col, field in mapping.items():
            mapped[field] = _clean(raw_row.get(col))

        name = mapped.get("name")
        if not name:
            errors.append({"row": line, "message": "Missing name"})
            continue

        email = (mapped.get("email") or "").lower() or None
        if email and not _EMAIL_RE.match(email):
            errors.append({"row": line, "message": f"'{email}' does not look like an email address"})
            continue
        mapped["email"] = email

        key_email = email
        key_name = name.strip().lower()
        if key_email and key_email in seen_emails:
            errors.append({
                "row": line,
                "message": f"Duplicate of row {seen_emails[key_email]} in this file ({email})",
            })
            continue
        if not key_email and key_name in seen_names:
            errors.append({
                "row": line,
                "message": f"Duplicate of row {seen_names[key_name]} in this file ({name})",
            })
            continue

        if key_email:
            seen_emails[key_email] = line
        seen_names[key_name] = line

        mapped["tags"] = _split_tags(mapped.get("tags"))
        mapped["_row"] = line
        rows.append(mapped)

    return {"columns": columns, "mapping": mapping, "rows": rows, "errors": errors}


async def _find_existing(chapter_id: str, rows: list[dict]) -> list[dict]:
    """Match parsed rows against PNMs the chapter already has.

    Email first, since it is the reliable key; name only when the row has no
    email at all. Two different people named John Smith is a real thing, so a
    name match is reported as a duplicate but the operator sees it listed and
    can decide.
    """
    if not rows:
        return []

    db = get_db()
    emails = [r["email"] for r in rows if r.get("email")]
    names = [r["name"].strip().lower() for r in rows if not r.get("email")]

    existing = await db.execute_query(
        """
        SELECT id, name, email FROM pnms
        WHERE chapter_id = $1::uuid
          AND (lower(email) = ANY($2::text[]) OR lower(name) = ANY($3::text[]))
        """,
        chapter_id, emails, names,
    )

    by_email = {(r["email"] or "").lower(): r for r in existing if r["email"]}
    by_name = {(r["name"] or "").strip().lower(): r for r in existing}

    duplicates = []
    for row in rows:
        match = by_email.get(row["email"]) if row.get("email") else by_name.get(row["name"].strip().lower())
        if match:
            duplicates.append({
                "row": row["_row"],
                "name": row["name"],
                "email": row.get("email"),
                "existing_id": str(match["id"]),
            })
    return duplicates


async def _insert_rows(chapter_id: str, rows: list[dict]) -> list[str]:
    """Bulk-insert new PNMs and attach their tags.

    Deliberately does not go through `PNMService.create_pnm`: that generates and
    uploads a QR code per PNM, which is fine for one row at a time and would mean
    hundreds of round trips here. QR codes are served on demand by
    `GET /pnms/{id}/qr`, so nothing is lost.
    """
    if not rows:
        return []

    db = get_db()
    inserted = await db.execute_query(
        """
        INSERT INTO pnms (chapter_id, name, email, phone, major, hometown, year, photo_url)
        SELECT $1::uuid, x.name, x.email, x.phone, x.major, x.hometown, x.year, x.photo_url
        FROM unnest(
            $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[]
        ) AS x(name, email, phone, major, hometown, year, photo_url)
        RETURNING id, lower(name) AS lname, lower(email) AS lemail
        """,
        chapter_id,
        [r["name"] for r in rows],
        [r.get("email") for r in rows],
        [r.get("phone") for r in rows],
        [r.get("major") for r in rows],
        [r.get("hometown") for r in rows],
        [r.get("year") for r in rows],
        [r.get("photo_url") for r in rows],
    )

    pnm_ids = [str(r["id"]) for r in inserted]

    tagged = [(pnm_ids[i], r["tags"]) for i, r in enumerate(rows) if r.get("tags")]
    if tagged:
        labels = sorted({label for _, tags in tagged for label in tags})
        await db.execute_command(
            """
            INSERT INTO tags (chapter_id, label)
            SELECT $1::uuid, x.label FROM unnest($2::text[]) AS x(label)
            ON CONFLICT DO NOTHING
            """,
            chapter_id, labels,
        )
        tag_rows = await db.execute_query(
            "SELECT id, label FROM tags WHERE chapter_id = $1::uuid AND label = ANY($2::text[])",
            chapter_id, labels,
        )
        tag_ids = {r["label"]: str(r["id"]) for r in tag_rows}

        pairs_pnm: list[str] = []
        pairs_tag: list[str] = []
        for pnm_id, tags in tagged:
            for label in tags:
                if label in tag_ids:
                    pairs_pnm.append(pnm_id)
                    pairs_tag.append(tag_ids[label])
        if pairs_pnm:
            await db.execute_command(
                """
                INSERT INTO pnm_tags (pnm_id, tag_id)
                SELECT x.pnm_id::uuid, x.tag_id::uuid
                FROM unnest($1::text[], $2::text[]) AS x(pnm_id, tag_id)
                ON CONFLICT DO NOTHING
                """,
                pairs_pnm, pairs_tag,
            )

    return pnm_ids


async def parse_and_import(
    chapter_id: str,
    raw: bytes,
    mapping_override: Optional[dict[str, str]] = None,
    dry_run: bool = True,
) -> dict:
    """Entry point for both the preview and the commit.

    The same call with dry_run flipped is the whole difference, which is what
    makes the preview trustworthy.
    """
    parsed = parse_csv(raw, mapping_override)
    rows = parsed["rows"]

    duplicates = await _find_existing(chapter_id, rows)
    duplicate_rows = {d["row"] for d in duplicates}
    importable = [r for r in rows if r["_row"] not in duplicate_rows]

    result = {
        "columns": parsed["columns"],
        "mapping": parsed["mapping"],
        "total": len(rows) + len(parsed["errors"]),
        "valid": len(importable),
        "skipped": len(parsed["errors"]) + len(duplicates),
        "errors": parsed["errors"],
        "duplicates": duplicates,
        "preview": [
            {k: v for k, v in r.items() if k != "_row"} | {"row": r["_row"]}
            for r in rows[:PREVIEW_ROWS]
        ],
        "dry_run": dry_run,
        "imported": 0,
        "pnm_ids": [],
    }

    if dry_run:
        return result

    if not importable:
        raise HTTPException(
            status_code=400,
            detail="Nothing to import -- every row was either invalid or already present",
        )

    pnm_ids = await _insert_rows(chapter_id, importable)
    result["imported"] = len(pnm_ids)
    result["pnm_ids"] = pnm_ids
    return result
