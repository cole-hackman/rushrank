#!/usr/bin/env python3
"""
Seed the read-only demo chapter.

A chapter deciding whether to run rush on RushRank will not sign up to look at
empty tables. This builds a chapter that has already been through rush: a full
roster, four events with real attendance, two completed rounds whose results
have an actual shape to them, and a finalized bid list.

The visitor reaches it through `POST /public/demo-session`, and cannot change
anything: their membership role is `observer`, and `auth.get_current_user`
rejects every non-GET request from a user whose memberships are all observer.

Usage
-----
    DATABASE_URL=postgresql://... python db/scripts/seed_demo.py

    # also create/repair the Supabase auth user for the demo login:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
    DEMO_USER_EMAIL=demo@rushrank.app DEMO_USER_PASSWORD=... \
    DATABASE_URL=postgresql://... python db/scripts/seed_demo.py

Idempotent: every id below is fixed, every write is an upsert, and re-running
converges on the same chapter rather than minting a second one. Safe to wire
into a deploy hook.

Superseded `db/seed_dev.sql`, which was written against the pre-0013 schema
(`users.chapter_id`, `users.role`, `email_allowlist`) and no longer applies.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

# Fixed namespace so every id is derived deterministically. Re-running the
# script targets the same rows instead of creating parallel copies.
NS = uuid.UUID("d3f0d3f0-0000-4000-8000-000000000000")


def _id(*parts: str) -> uuid.UUID:
    return uuid.uuid5(NS, ":".join(parts))


CHAPTER_ID = _id("chapter")
CHAPTER_NAME = "Sigma Demo at Riverside"

BROTHERS = [
    ("Marcus Webb", "marcus@demo.rushrank.app", "admin"),
    ("Devin Alvarez", "devin@demo.rushrank.app", "exec"),
    ("Ty Nakamura", "ty@demo.rushrank.app", "exec"),
    ("Jonah Pierce", "jonah@demo.rushrank.app", "member"),
    ("Reed Callahan", "reed@demo.rushrank.app", "member"),
    ("Owen Brandt", "owen@demo.rushrank.app", "member"),
]

FIRST = [
    "Aiden", "Beckett", "Caleb", "Dominic", "Elliot", "Finn", "Grant", "Hayes",
    "Isaac", "Jasper", "Kellan", "Landon", "Miles", "Nolan", "Oscar", "Porter",
    "Quinn", "Rowan", "Silas", "Tobias", "Uriah", "Vaughn", "Wesley", "Xavier",
    "Yusuf", "Zane", "Bennett", "Cormac", "Declan", "Everett",
]
LAST = [
    "Whitfield", "Ramos", "Okafor", "Lindqvist", "Bhatt", "Castellano", "Nguyen",
    "Delacroix", "Sorensen", "Ibarra", "Kowalski", "Mensah", "Petrov", "Ferrari",
    "Adeyemi", "Vasquez", "Thornton", "Haddad", "Yoshida", "Marchetti", "O'Rourke",
    "Sandoval", "Kimura", "Beaumont", "Aguilar", "Novak", "Rahman", "Espinoza",
    "Larkin", "Dumont",
]
MAJORS = [
    "Mechanical Engineering", "Finance", "Computer Science", "Biology",
    "Economics", "Political Science", "Marketing", "Kinesiology",
    "Civil Engineering", "Psychology", "Accounting", "Communications",
]
YEARS = ["Freshman", "Freshman", "Freshman", "Sophomore", "Sophomore", "Junior"]
HOMETOWNS = [
    "Austin, TX", "Denver, CO", "Naperville, IL", "Scottsdale, AZ", "Marietta, GA",
    "Bellevue, WA", "Newton, MA", "Plano, TX", "Boise, ID", "Charlotte, NC",
]
TAG_LABELS = [
    ("Legacy", "#818cf8"),
    ("Athlete", "#34d399"),
    ("Referred", "#fbbf24"),
    ("Out of state", "#60a5fa"),
]

EVENTS = [
    ("Fall Kickoff BBQ", -21, "Chapter House Lawn"),
    ("Sports Night", -17, "Rec Center Court 3"),
    ("Chapter Dinner", -12, "Chapter House"),
    ("Interview Night", -8, "Student Union 214"),
]


async def _upsert_chapter(conn) -> None:
    # `school` and `fraternity` are guaranteed present after 0013 §8, so this is
    # one statement rather than a probe-and-patch. That matters: everything here
    # runs inside a transaction, and an error inside a transaction aborts the
    # whole thing -- catching it in Python does not undo that.
    await conn.execute(
        """
        INSERT INTO chapters (id, name, theme, school, fraternity)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, theme = EXCLUDED.theme,
            school = EXCLUDED.school, fraternity = EXCLUDED.fraternity
        """,
        CHAPTER_ID, CHAPTER_NAME,
        json.dumps({"enabled": True, "accent_hex": "#1d4ed8", "source": "manual"}),
        "Riverside University", "Sigma Demo",
    )


async def _upsert_brothers(conn) -> dict[str, uuid.UUID]:
    ids: dict[str, uuid.UUID] = {}
    for name, email, role in BROTHERS:
        uid = _id("user", email)
        ids[email] = uid
        await conn.execute(
            """
            INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
            """,
            uid, email, name,
        )
        await conn.execute(
            """
            INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1, $2, $3)
            ON CONFLICT (user_id, chapter_id) DO UPDATE SET role = EXCLUDED.role
            """,
            uid, CHAPTER_ID, role,
        )
    return ids


async def _upsert_tags(conn) -> dict[str, uuid.UUID]:
    ids: dict[str, uuid.UUID] = {}
    for label, color in TAG_LABELS:
        tag_id = _id("tag", label)
        ids[label] = tag_id
        await conn.execute(
            """
            INSERT INTO tags (id, chapter_id, label, color) VALUES ($1, $2, $3, $4)
            ON CONFLICT (chapter_id, label) DO UPDATE SET color = EXCLUDED.color
            """,
            tag_id, CHAPTER_ID, label, color,
        )
    # ON CONFLICT on (chapter_id, label) may have kept a pre-existing id.
    rows = await conn.fetch("SELECT id, label FROM tags WHERE chapter_id = $1", CHAPTER_ID)
    return {r["label"]: r["id"] for r in rows}


async def _upsert_pnms(conn, rng: random.Random, tag_ids: dict) -> list[uuid.UUID]:
    pnm_ids: list[uuid.UUID] = []
    for i in range(30):
        name = f"{FIRST[i]} {LAST[i]}"
        email = f"{FIRST[i].lower()}.{LAST[i].lower().replace(chr(39), '')}@riverside.edu"
        pnm_id = _id("pnm", name)
        pnm_ids.append(pnm_id)
        await conn.execute(
            """
            INSERT INTO pnms (id, chapter_id, name, email, phone, major, hometown, year)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
                major = EXCLUDED.major, hometown = EXCLUDED.hometown, year = EXCLUDED.year
            """,
            pnm_id, CHAPTER_ID, name, email,
            f"555-01{i:02d}", MAJORS[i % len(MAJORS)],
            HOMETOWNS[i % len(HOMETOWNS)], YEARS[i % len(YEARS)],
        )
        for label in rng.sample(list(tag_ids), rng.choice([0, 1, 1, 2])):
            await conn.execute(
                "INSERT INTO pnm_tags (pnm_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                pnm_id, tag_ids[label],
            )
    return pnm_ids


async def _upsert_events(conn, rng, pnm_ids, brother_ids) -> None:
    now = datetime.now(timezone.utc)
    checker = next(iter(brother_ids.values()))
    for name, offset_days, location in EVENTS:
        event_id = _id("event", name)
        await conn.execute(
            """
            INSERT INTO events (id, chapter_id, name, date, location, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, date = EXCLUDED.date, location = EXCLUDED.location
            """,
            event_id, CHAPTER_ID, name, now + timedelta(days=offset_days), location,
        )
        # Attendance thins out as rush progresses, which is what real events look like.
        turnout = max(8, int(len(pnm_ids) * (0.9 + offset_days / 60)))
        for pnm_id in rng.sample(pnm_ids, min(turnout, len(pnm_ids))):
            await conn.execute(
                """
                INSERT INTO event_attendance (event_id, pnm_id, checked_in_by_user_id, method)
                VALUES ($1, $2, $3, 'SEARCH')
                ON CONFLICT DO NOTHING
                """,
                event_id, pnm_id, checker,
            )


def _vote_value(rng: random.Random, strength: float) -> str:
    """Sample a vote from a PNM's underlying strength.

    Strength near 0.5 produces genuinely split votes, which is what makes the
    controversy score visible on the results page instead of a column of zeros.
    """
    roll = rng.random()
    if roll < strength * 0.9:
        return "YES"
    if roll < strength * 0.9 + 0.12:
        return "UNKNOWN"
    return "NO"


async def _upsert_contacts(conn, rng, pnm_ids, brother_ids) -> None:
    """Who has actually met whom.

    Uneven on purpose. The top of the list is well known and the bottom is
    barely known at all, which is the real pattern -- and it means the demo
    shows a PNM being voted on that almost nobody has spoken to, which is the
    argument for the feature.
    """
    voters = list(brother_ids.values())
    for i, pnm_id in enumerate(pnm_ids):
        if i < 8:
            met = rng.sample(voters, rng.randint(4, 6))
        elif i < 20:
            met = rng.sample(voters, rng.randint(2, 4))
        elif i < 27:
            met = rng.sample(voters, rng.randint(0, 2))
        else:
            met = []  # nobody has met these -- the list the rush chair needs
        for user_id in met:
            await conn.execute(
                """
                INSERT INTO pnm_contacts (pnm_id, user_id, event_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (pnm_id, user_id,
                             COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid))
                DO NOTHING
                """,
                pnm_id, user_id, _id("event", EVENTS[i % len(EVENTS)][0]),
            )


async def _upsert_rounds(conn, rng, pnm_ids, brother_ids) -> list[uuid.UUID]:
    now = datetime.now(timezone.utc)
    voters = list(brother_ids.values())

    # Deliberate spread: a clear top group, a clear bottom, and a handful sitting
    # right on the fence so the "Controversial" badge has something to mark.
    strengths = {}
    for i, pnm_id in enumerate(pnm_ids):
        if i < 8:
            strengths[pnm_id] = rng.uniform(0.82, 0.98)
        elif i < 14:
            strengths[pnm_id] = rng.uniform(0.44, 0.56)   # the contested ones
        elif i < 24:
            strengths[pnm_id] = rng.uniform(0.58, 0.78)
        else:
            strengths[pnm_id] = rng.uniform(0.10, 0.35)

    round_ids: list[uuid.UUID] = []
    rounds = [
        ("Round 1 - After Kickoff", "GENERAL", pnm_ids, -14),
        ("Round 2 - After Interviews", "INVITE", pnm_ids[:18], -6),
    ]

    for name, rtype, members, offset_days in rounds:
        round_id = _id("round", name)
        round_ids.append(round_id)
        await conn.execute(
            """
            INSERT INTO voting_rounds
                (id, chapter_id, name, type, status, room_code, selected_pnm_ids,
                 started_at, ended_at, created_by)
            VALUES ($1, $2, $3, $4, 'ENDED', $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, status = 'ENDED', ended_at = EXCLUDED.ended_at
            """,
            round_id, CHAPTER_ID, name, rtype,
            f"DEMO{len(round_ids):02d}", [str(p) for p in members],
            now + timedelta(days=offset_days),
            now + timedelta(days=offset_days, hours=1),
            voters[0],
        )
        for order, pnm_id in enumerate(members):
            await conn.execute(
                """
                INSERT INTO round_pnms (round_id, pnm_id, order_index) VALUES ($1, $2, $3)
                ON CONFLICT (round_id, pnm_id) DO UPDATE SET order_index = EXCLUDED.order_index
                """,
                round_id, pnm_id, order,
            )
            for voter in voters:
                await conn.execute(
                    """
                    INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite, weight_applied)
                    VALUES ($1, $2, $3, $4, $5, 1.0)
                    ON CONFLICT (round_id, pnm_id, voter_user_id)
                    DO UPDATE SET value = EXCLUDED.value, favorite = EXCLUDED.favorite
                    """,
                    round_id, pnm_id, voter,
                    _vote_value(rng, strengths[pnm_id]),
                    rng.random() < strengths[pnm_id] * 0.25,
                )
    return round_ids


async def _upsert_bid_list(conn, pnm_ids, round_ids, brother_ids) -> uuid.UUID:
    bid_list_id = _id("bid_list", "final")
    await conn.execute(
        """
        INSERT INTO bid_lists (id, chapter_id, source_round_id, name, bid_cap, finalized_at)
        VALUES ($1, $2, $3, 'Fall Bid List', 12, NOW())
        ON CONFLICT (id) DO UPDATE SET finalized_at = NOW(), bid_cap = EXCLUDED.bid_cap
        """,
        bid_list_id, CHAPTER_ID, round_ids[-1],
    )
    buckets = [("bid", pnm_ids[:10]), ("maybe", pnm_ids[10:18]), ("cut", pnm_ids[18:24])]
    for bucket, members in buckets:
        for position, pnm_id in enumerate(members):
            await conn.execute(
                """
                INSERT INTO bid_list_entries (bid_list_id, pnm_id, bucket, position)
                VALUES ($1, $2, $3::bid_bucket, $4)
                ON CONFLICT (bid_list_id, pnm_id)
                DO UPDATE SET bucket = EXCLUDED.bucket, position = EXCLUDED.position
                """,
                bid_list_id, pnm_id, bucket, position,
            )
    return bid_list_id


async def _upsert_audit(conn, brother_ids, round_ids, bid_list_id) -> None:
    """A few entries so the audit viewer opens onto something real."""
    await conn.execute("DELETE FROM audit_log WHERE chapter_id = $1", CHAPTER_ID)
    admin = brother_ids[BROTHERS[0][1]]
    exec_user = brother_ids[BROTHERS[1][1]]
    entries = [
        (admin, "pnm.import", "pnm", None, None, {"filename": "fall_roster.csv", "imported": 30, "skipped": 0}),
        (admin, "round.create", "voting_round", round_ids[0], None, {"type": "GENERAL", "pnm_count": 30}),
        (admin, "round.end", "voting_round", round_ids[0], None, None),
        (admin, "round.cutoff", "voting_round", round_ids[0],
         {"mode": "top_n", "value": 18},
         {"advanced_count": 18, "cut_count": 12, "next_round_id": str(round_ids[1])}),
        (exec_user, "round.end", "voting_round", round_ids[1], None, None),
        (exec_user, "bid_list.finalize", "bid_list", bid_list_id, None, {"bid_cap": 12}),
    ]
    for actor, action, entity_type, entity_id, before, after in entries:
        await conn.execute(
            """
            INSERT INTO audit_log
                (chapter_id, actor_user_id, action, entity_type, entity_id, before, after)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
            """,
            CHAPTER_ID, actor, action, entity_type, entity_id,
            json.dumps(before) if before else None,
            json.dumps(after) if after else None,
        )


async def _provision_demo_login(conn) -> str:
    """Create (or repair) the Supabase auth user the demo endpoint signs in as.

    Without SUPABASE_SERVICE_ROLE_KEY this is skipped and the data is still
    seeded -- useful for a local database, where there is no Supabase project
    to talk to.
    """
    email = os.getenv("DEMO_USER_EMAIL")
    password = os.getenv("DEMO_USER_PASSWORD")
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not (email and password and supabase_url and service_key):
        return "skipped (set DEMO_USER_EMAIL, DEMO_USER_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"

    import httpx

    headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}
    async with httpx.AsyncClient(timeout=30.0) as client:
        existing = await client.get(
            f"{supabase_url}/auth/v1/admin/users", params={"email": email}, headers=headers
        )
        users = existing.json().get("users", []) if existing.status_code == 200 else []

        if users:
            user_id = users[0]["id"]
            await client.put(
                f"{supabase_url}/auth/v1/admin/users/{user_id}",
                json={"password": password, "email_confirm": True}, headers=headers,
            )
            outcome = "password reset"
        else:
            created = await client.post(
                f"{supabase_url}/auth/v1/admin/users",
                json={"email": email, "password": password, "email_confirm": True},
                headers=headers,
            )
            if created.status_code not in (200, 201):
                return f"failed: {created.status_code} {created.text[:120]}"
            user_id = created.json()["id"]
            outcome = "created"

    await conn.execute(
        """
        INSERT INTO users (id, email, name) VALUES ($1::uuid, $2, 'Demo Visitor')
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
        """,
        user_id, email,
    )
    # observer is what makes the account read-only; see auth.get_current_user.
    await conn.execute(
        """
        INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1::uuid, $2, 'observer')
        ON CONFLICT (user_id, chapter_id) DO UPDATE SET role = 'observer'
        """,
        user_id, CHAPTER_ID,
    )
    return f"{outcome} ({email}, observer)"


async def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    # Fixed seed: re-running produces the same chapter, not a reshuffled one.
    rng = random.Random(20260807)

    conn = await asyncpg.connect(database_url)
    try:
        async with conn.transaction():
            await _upsert_chapter(conn)
            brother_ids = await _upsert_brothers(conn)
            tag_ids = await _upsert_tags(conn)
            pnm_ids = await _upsert_pnms(conn, rng, tag_ids)
            await _upsert_events(conn, rng, pnm_ids, brother_ids)
            await _upsert_contacts(conn, rng, pnm_ids, brother_ids)
            round_ids = await _upsert_rounds(conn, rng, pnm_ids, brother_ids)
            bid_list_id = await _upsert_bid_list(conn, pnm_ids, round_ids, brother_ids)
            await _upsert_audit(conn, brother_ids, round_ids, bid_list_id)

        login = await _provision_demo_login(conn)

        counts = await conn.fetchrow(
            """
            SELECT (SELECT COUNT(*) FROM pnms WHERE chapter_id = $1) AS pnms,
                   (SELECT COUNT(*) FROM events WHERE chapter_id = $1) AS events,
                   (SELECT COUNT(*) FROM voting_rounds WHERE chapter_id = $1) AS rounds,
                   (SELECT COUNT(*) FROM votes v JOIN voting_rounds r ON r.id = v.round_id
                     WHERE r.chapter_id = $1) AS votes,
                   (SELECT COUNT(*) FROM memberships WHERE chapter_id = $1) AS members
            """,
            CHAPTER_ID,
        )
    finally:
        await conn.close()

    print(f"Demo chapter {CHAPTER_ID} ({CHAPTER_NAME})")
    print(f"  {counts['pnms']} PNMs, {counts['events']} events, {counts['rounds']} rounds, "
          f"{counts['votes']} votes, {counts['members']} members")
    print(f"  demo login: {login}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
