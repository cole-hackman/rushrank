"""
Dump the seeded chapter to JSON, with a signed token per brother.

The Playwright harness is JavaScript and the database is Postgres; rather than
adding a node pg client just to look up ids, this emits everything the browser
side needs in one file. Tokens are HS256 signed with SUPABASE_JWT_SECRET, which
python_server/auth.py verifies directly (no Supabase round trip), so each
browser context can be a different brother.

    E2E_DATABASE_URL=... SUPABASE_JWT_SECRET=... python e2e/fixtures.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time

import asyncpg
from jose import jwt

OUT = os.path.join(os.path.dirname(__file__), "fixtures.json")
TTL = 12 * 60 * 60  # long enough that supabase-js never tries to refresh


def mint(secret: str, user_id: str, email: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": str(user_id),
            "email": email,
            "role": "authenticated",
            "aud": "authenticated",
            "iat": now,
            "exp": now + TTL,
        },
        secret,
        algorithm="HS256",
    )


async def main() -> None:
    url = os.environ.get("E2E_DATABASE_URL") or os.environ.get("DATABASE_URL")
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not url or not secret:
        sys.exit("set E2E_DATABASE_URL and SUPABASE_JWT_SECRET")

    conn = await asyncpg.connect(url)
    chapter = await conn.fetchrow("SELECT id, name, min_gpa FROM chapters LIMIT 1")
    users = await conn.fetch(
        """SELECT u.id, u.email, u.name, m.role
           FROM users u JOIN memberships m ON m.user_id = u.id
           WHERE m.chapter_id = $1
           ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'exec' THEN 1 ELSE 2 END, u.name""",
        chapter["id"],
    )
    live_round = await conn.fetchrow(
        "SELECT id, name FROM voting_rounds WHERE chapter_id=$1 AND status='DRAFT' LIMIT 1",
        chapter["id"],
    )
    ended_round = await conn.fetchrow(
        "SELECT id, name FROM voting_rounds WHERE chapter_id=$1 AND status='ENDED' ORDER BY started_at DESC LIMIT 1",
        chapter["id"],
    )
    roster = await conn.fetch(
        """SELECT id, name FROM pnms
           WHERE chapter_id=$1 AND archived=false AND stage <> 'prospect'
           ORDER BY name LIMIT 20""",
        chapter["id"],
    )
    event = await conn.fetchrow(
        "SELECT id, name, check_in_code FROM events WHERE chapter_id=$1 ORDER BY date DESC LIMIT 1",
        chapter["id"],
    )
    bid_list = await conn.fetchrow(
        "SELECT id, name FROM bid_lists WHERE chapter_id=$1 LIMIT 1", chapter["id"]
    )

    data = {
        "chapter": {
            "id": str(chapter["id"]),
            "name": chapter["name"],
            "min_gpa": float(chapter["min_gpa"]) if chapter["min_gpa"] is not None else None,
        },
        "users": [
            {
                "id": str(u["id"]),
                "email": u["email"],
                "name": u["name"],
                "role": u["role"],
                "token": mint(secret, u["id"], u["email"]),
            }
            for u in users
        ],
        "liveRound": {"id": str(live_round["id"]), "name": live_round["name"]} if live_round else None,
        "endedRound": {"id": str(ended_round["id"]), "name": ended_round["name"]} if ended_round else None,
        "roster": [{"id": str(p["id"]), "name": p["name"]} for p in roster],
        "event": {"id": str(event["id"]), "name": event["name"], "code": event["check_in_code"]} if event else None,
        "bidList": {"id": str(bid_list["id"]), "name": bid_list["name"]} if bid_list else None,
    }

    with open(OUT, "w") as fh:
        json.dump(data, fh, indent=2)

    print(f"wrote {OUT}")
    print(f"  chapter  {data['chapter']['name']}")
    print(f"  users    {len(data['users'])} (chair: {data['users'][0]['email']})")
    print(f"  roster   {len(data['roster'])}")
    print(f"  live rd  {data['liveRound']['name'] if data['liveRound'] else 'none'}")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
