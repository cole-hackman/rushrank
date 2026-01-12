#!/usr/bin/env python3
"""
One-time DB schema check for RushRank.
Connects via DATABASE_URL and asserts existence of required tables.
"""
import asyncio
import os
from pathlib import Path
from typing import Dict, List, Tuple

import asyncpg

EXPECTED = [
	# name_in_db, aliases (accepted)
	("users", []),
	("pnms", []),
	("tags", []),
	("pnm_tags", []),
	("events", []),
	("event_attendance", ["attendance"]),
	("voting_rounds", ["rounds"]),
	("round_pnms", []),
	("votes", []),
	("pnm_notes", ["comments"]),
	("questionnaires", []),
	("pnm_answers", []),
	("sessions", []),
]

def load_env():
	"""Lightweight loader to read root .env or backend/.env if present."""
	repo_root = Path(__file__).resolve().parents[2]
	for p in [repo_root / ".env", repo_root / "backend" / ".env"]:
		if p.exists():
			for line in p.read_text().splitlines():
				line = line.strip()
				if not line or line.startswith("#") or "=" not in line:
					continue
				k, v = line.split("=", 1)
				if k and k not in os.environ:
					os.environ[k.strip()] = v.strip().strip("'").strip('"')

async def table_exists(conn: asyncpg.Connection, table: str) -> bool:
	sql = """
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	"""
	return await conn.fetchval(sql, table)

async def main() -> int:
	load_env()
	db_url = os.getenv("DATABASE_URL")
	if not db_url:
		print("ERROR: DATABASE_URL not set. Export it or place it in .env.")
		return 2

	try:
		conn = await asyncpg.connect(db_url, server_settings={"search_path": "public"})
	except Exception as e:
		print(f"ERROR: Could not connect to database: {e}")
		return 2

	results: List[Tuple[str, bool]] = []
	try:
		for name, aliases in EXPECTED:
			exists = await table_exists(conn, name)
			if not exists and aliases:
				# try aliases
				for alt in aliases:
					if await table_exists(conn, alt):
						exists = True
						break
			results.append((name, exists))
	finally:
		await conn.close()

	ok = all(exists for _, exists in results)

	print("RushRank DB Schema Check")
	print("=======================")
	for name, exists in results:
		print(f"- {name:16} : {'OK' if exists else 'MISSING'}")
	print(f"\nOverall: {'OK' if ok else 'INCOMPLETE'}")
	return 0 if ok else 1

if __name__ == "__main__":
	raise SystemExit(asyncio.run(main()))


