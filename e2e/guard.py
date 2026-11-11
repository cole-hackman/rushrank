"""
Database guard for the Python side of the e2e harness.

e2e/seed.py TRUNCATEs eighteen tables (users and chapters included) on
`E2E_DATABASE_URL or DATABASE_URL`, with no check on where that points. This
wrapper is how the runbook invokes it instead:

    python3 e2e/guard.py            # check only: print the target and exit
    python3 e2e/guard.py --seed     # check, then run seed.py and fixtures.py

It refuses unless all of the following hold:

  1. E2E_DATABASE_URL is set explicitly (DATABASE_URL is never a fallback).
  2. The host is localhost / 127.0.0.1 / ::1, or a unix socket.
  3. The database name ends in `_e2e` or `_test`.
  4. The URL does not look hosted (supabase, render, pooler, neon, amazonaws).
  5. The server agrees: current_database() matches and the server address is
     loopback.
  6. Every chapter already present is the seed chapter (or a leftover
     "E2E Temp ..." chapter from api-contract.mjs). A database holding any
     other chapter is not ours to wipe.

With --seed it then runs seed.py and fixtures.py in this process with
DATABASE_URL forced equal to E2E_DATABASE_URL, so neither can fall through to
a real database even if the shell has one exported.

Exit code 0 means safe; 2 means refused.
"""

from __future__ import annotations

import asyncio
import os
import re
import runpy
import sys
from urllib.parse import unquote, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
SEED_CHAPTER_NAME = "Beta Theta Pi - Cal Poly SLO"
TEMP_CHAPTER_PREFIX = "E2E Temp "  # api-contract.mjs creates and deletes these
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", ""}
FORBIDDEN = re.compile(r"supabase|render\.com|onrender|pooler|neon\.tech|amazonaws|rds\.|azure|gcp|cloud", re.I)
NAME_OK = re.compile(r"(_e2e|_test)$")


def refuse(reason: str) -> None:
    print(f"\nGUARD REFUSED: {reason}", file=sys.stderr)
    print("Nothing was written. Fix the environment and run again.\n", file=sys.stderr)
    sys.exit(2)


def vet_url() -> tuple[str, str, str]:
    raw = os.environ.get("E2E_DATABASE_URL")
    if not raw:
        refuse(
            "E2E_DATABASE_URL is not set. This guard never falls back to DATABASE_URL. "
            "Export E2E_DATABASE_URL=postgresql://<you>@localhost:5432/rushrank_e2e"
        )
    u = urlparse(raw)
    host = u.hostname or ""
    name = unquote((u.path or "").lstrip("/"))
    shown = f"{u.scheme}://{u.username or '?'}@{host or '(socket)'}:{u.port or 5432}/{name}"
    if FORBIDDEN.search(raw):
        refuse(f"the URL looks like a hosted database: {shown}")
    if host not in LOCAL_HOSTS:
        refuse(f'host "{host}" is not local: {shown}')
    if not NAME_OK.search(name):
        refuse(f'database name "{name}" does not end in _e2e or _test: {shown}')
    return raw, name, shown


async def check() -> str:
    raw, name, shown = vet_url()
    try:
        import asyncpg
    except ImportError:
        refuse("asyncpg is not installed in this Python. pip install asyncpg python-jose")

    try:
        conn = await asyncpg.connect(raw)
    except Exception as exc:  # noqa: BLE001 - any connection failure is a refusal
        refuse(f"could not connect to {shown}: {exc}")

    try:
        row = await conn.fetchrow(
            "select current_database() as db, coalesce(host(inet_server_addr()), 'socket') as addr, current_user as usr"
        )
        if row["db"] != name:
            refuse(f'server reports database "{row["db"]}", URL says "{name}"')
        if row["addr"] not in ("socket", "127.0.0.1", "::1"):
            refuse(f"server address {row['addr']} is not loopback")

        has_chapters = await conn.fetchval("select to_regclass('public.chapters') is not null")
        if not has_chapters:
            refuse(f'database "{name}" has no chapters table. Apply supabase/migrations/*.sql to it first.')

        chapters = await conn.fetch("select name from chapters")
        foreign = [
            c["name"] for c in chapters
            if c["name"] != SEED_CHAPTER_NAME and not c["name"].startswith(TEMP_CHAPTER_PREFIX)
        ]
        if foreign:
            refuse(
                f'database "{name}" contains {len(foreign)} chapter(s) the seed did not create '
                f'(first: "{foreign[0]}"). Refusing to touch a database with someone else\'s data in it.'
            )
        print(
            f"guard: database OK -> {shown} (server says db={row['db']}, addr={row['addr']}, "
            f"user={row['usr']}, seed chapters={len(chapters)})"
        )
    finally:
        await conn.close()
    return raw


def main() -> None:
    raw = asyncio.run(check())
    if "--seed" not in sys.argv:
        print("guard: safe to proceed. (check only; pass --seed to wipe and reseed)")
        return

    # Close the fallback: both scripts read `E2E_DATABASE_URL or DATABASE_URL`.
    os.environ["DATABASE_URL"] = raw
    os.environ["E2E_DATABASE_URL"] = raw
    if not os.environ.get("SUPABASE_JWT_SECRET"):
        refuse("SUPABASE_JWT_SECRET is not set. Source e2e/env.sh first: set -a && . ./e2e/env.sh && set +a")

    print("guard: running seed.py (TRUNCATE + reseed) against the database above")
    runpy.run_path(os.path.join(HERE, "seed.py"), run_name="__main__")
    print("guard: running fixtures.py")
    runpy.run_path(os.path.join(HERE, "fixtures.py"), run_name="__main__")


if __name__ == "__main__":
    main()
