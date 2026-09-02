"""
Seed a local database with a full, realistic chapter for end-to-end testing.

Deliberately not the demo seeder (`db/scripts/seed_demo.py`), which builds a
small read-only chapter for the marketing demo. This one builds a chapter big
enough that pagination, sorting, tallies, coverage percentages and cutoffs all
have something to chew on, and messy enough that the edge cases show up:
PNMs with no GPA on file, PNMs below the minimum, duplicate rows arriving from
two intake channels, prospects that must stay off the roster, brothers who have
met nobody, and a round where the vote is genuinely close.

Usage:
    E2E_DATABASE_URL=postgresql://... python e2e/seed.py

Everything is deterministic (fixed seed) so a failing assertion in a Playwright
run can be reproduced exactly.
"""

from __future__ import annotations

import asyncio
import os
import random
import sys
from datetime import datetime, timedelta, timezone

import asyncpg

SEED = 20260903
random.seed(SEED)

CHAPTER_NAME = "Beta Theta Pi - Cal Poly SLO"
MIN_GPA = 2.50

FIRST = [
    "Aiden", "Marcus", "Diego", "Tyler", "Jonah", "Elias", "Cole", "Nathan",
    "Owen", "Silas", "Ravi", "Mateo", "Grant", "Julian", "Bennett", "Kai",
    "Desmond", "Felix", "Hugo", "Ibrahim", "Jasper", "Leo", "Micah", "Noel",
    "Omar", "Preston", "Quentin", "Roman", "Soren", "Theo", "Victor", "Wes",
    "Xavier", "Yusuf", "Zane", "Andre", "Brody", "Caleb", "Dominic", "Emmett",
    "Finn", "Gabriel", "Harrison", "Isaac", "Jude", "Knox", "Lucas", "Miles",
    "Nolan", "Oscar", "Parker", "Reid", "Sawyer", "Tobias", "Uriah", "Vaughn",
    "Walker", "Cyrus", "Beckett", "Arlo",
]
LAST = [
    "Alvarez", "Brennan", "Castillo", "Donovan", "Ellison", "Fitzgerald",
    "Gallagher", "Hartley", "Iverson", "Jennings", "Kowalski", "Lindqvist",
    "Marchetti", "Nakamura", "Okonkwo", "Pemberton", "Quintero", "Rasmussen",
    "Sandoval", "Thornton", "Ueda", "Vasquez", "Whitfield", "Xiong", "Yates",
    "Zimmerman", "Ashford", "Barlow", "Calloway", "Dunbar", "Escobar",
    "Ferreira", "Grimaldi", "Halvorsen", "Ingram", "Jaskolski", "Kendrick",
    "Lockhart", "Mendoza", "Novak",
]
MAJORS = [
    "Mechanical Engineering", "Business Administration", "Computer Science",
    "Agricultural Business", "Architecture", "Kinesiology", "Economics",
    "Industrial Technology", "Political Science", "Biology",
    "Civil Engineering", "Graphic Communication", "Statistics", "Psychology",
]
HOMETOWNS = [
    "San Diego, CA", "Danville, CA", "Scottsdale, AZ", "Portland, OR",
    "Bellevue, WA", "Austin, TX", "Denver, CO", "Chicago, IL",
    "Newport Beach, CA", "Boise, ID", "Reno, NV", "Sacramento, CA",
    "Honolulu, HI", "Bend, OR", "Pasadena, CA", "Walnut Creek, CA",
]
YEARS = ["Freshman", "Sophomore", "Junior", "Senior"]
FUN_FACTS = [
    "Rode a unicycle across campus for a bet",
    "Eagle Scout, still carries the pocket knife",
    "Has seen the same movie 47 times",
    "Grew up on a walnut farm",
    "Can name every county in California",
    "Played junior hockey in Michigan",
    "Makes his own hot sauce",
    "Was an extra in a car commercial",
    "Can solve a Rubik's cube one-handed",
    "Surfs before 6am class",
]
TAGS = [
    ("Legacy", "#b8860b"), ("Athlete", "#2e7d32"), ("STEM", "#1565c0"),
    ("Greek Week", "#6a1b9a"), ("Referred", "#00838f"), ("Local", "#ef6c00"),
    ("Transfer", "#5d4037"), ("Needs 2nd Look", "#c62828"),
]
NOTE_BODIES = [
    "Carried the conversation at the BBQ, asked good questions about the house.",
    "Quiet at first but opened up once we talked about climbing.",
    "Knows three guys in the pledge class already.",
    "Seemed more interested in the parties than the chapter.",
    "Strong handshake, made a point of meeting the exec board.",
    "Left early, did not say goodbye to anyone.",
    "Talked about his service work for ten minutes without being asked.",
    "Would be a great rush chair in two years.",
    "Bit of a red flag: talked over two other PNMs.",
    "Genuinely funny, the whole table was laughing.",
    "Asked about GPA requirements and study hours, took it seriously.",
    "Followed up with a thank-you text the next morning.",
]
DECLINE_REASONS = [
    "Accepted a bid elsewhere", "Going through fall recruitment instead",
    "Family said no", "",
]


def name_pool(n: int, offset: int = 0) -> list[str]:
    out, seen = [], set()
    i = offset
    while len(out) < n:
        nm = f"{FIRST[i % len(FIRST)]} {LAST[(i // 3 + i) % len(LAST)]}"
        if nm not in seen:
            seen.add(nm)
            out.append(nm)
        i += 1
    return out


async def main() -> None:
    url = os.environ.get("E2E_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set E2E_DATABASE_URL")
    conn = await asyncpg.connect(url)
    now = datetime.now(timezone.utc)

    # Idempotent: wipe the app tables, keep the schema.
    await conn.execute("""
        TRUNCATE pnm_contacts, pnm_tags, pnm_notes, pnm_answers, votes,
                 round_pnms, sessions, bid_list_entries, bid_lists,
                 event_attendance, events, voting_rounds, tags, pnms,
                 memberships, questionnaires, users, chapters
        RESTART IDENTITY CASCADE
    """)

    chapter_id = await conn.fetchval(
        """INSERT INTO chapters (name, school, fraternity, min_gpa, theme)
           VALUES ($1,$2,$3,$4,$5) RETURNING id""",
        CHAPTER_NAME, "Cal Poly San Luis Obispo", "Beta Theta Pi", MIN_GPA,
        # The shape migration 0009 defines and update_theme writes.
        '{"enabled": true, "accent_hex": "#0F2B5B", "source": "manual"}',
    )

    # ---- Brothers -----------------------------------------------------------
    # One chair (admin), three exec, the rest members. Two members deliberately
    # never vote and never log a contact, so "who hasn't voted" and coverage
    # gaps have something real to surface.
    brothers = []
    names = name_pool(32)
    for i, nm in enumerate(names):
        if i == 0:
            m_role, u_role, is_exec = "admin", "ADMIN", True
        elif i < 4:
            m_role, u_role, is_exec = "exec", "EXEC", True
        else:
            m_role, u_role, is_exec = "member", "BROTHER", False
        email = f"{nm.split()[0].lower()}.{nm.split()[1].lower()}@calpoly.edu"
        uid = await conn.fetchval(
            """INSERT INTO users (chapter_id, email, name, role, is_exec)
               VALUES ($1,$2,$3,$4::role_type,$5) RETURNING id""",
            chapter_id, email, nm, u_role, is_exec)
        await conn.execute(
            "INSERT INTO memberships (user_id, chapter_id, role) VALUES ($1,$2,$3)",
            uid, chapter_id, m_role)
        brothers.append({"id": uid, "name": nm, "email": email, "role": m_role})

    chair = brothers[0]

    # ---- Tags ---------------------------------------------------------------
    tag_ids = []
    for label, color in TAGS:
        tag_ids.append(await conn.fetchval(
            "INSERT INTO tags (chapter_id, label, color) VALUES ($1,$2,$3) RETURNING id",
            chapter_id, label, color))

    # ---- PNMs ---------------------------------------------------------------
    # 52 in formal rush, 8 prospects still on the pipeline board. GPA is a
    # three-way split on purpose: on file and fine, on file and below the
    # chapter minimum, and genuinely not on file (NULL) -- which must never be
    # treated as failing.
    pnms = []
    pnm_names = name_pool(60, offset=17)
    for i, nm in enumerate(pnm_names):
        prospect = i >= 52
        stage = "prospect" if prospect else ("bid" if i < 4 else "pnm")
        if i % 7 == 0:
            gpa = None
        elif i % 11 == 0:
            gpa = round(random.uniform(1.9, 2.45), 2)
        else:
            gpa = round(random.uniform(2.55, 4.0), 2)
        archived = (i in (50, 51))
        waived = gpa is not None and gpa < MIN_GPA and i % 22 == 0
        pid = await conn.fetchval(
            """INSERT INTO pnms (chapter_id, name, email, phone, hometown, major,
                                 year, fun_fact, created_by, archived, stage,
                                 source, contact_status, instagram_handle, gpa,
                                 gpa_waived, gpa_waived_by_user_id,
                                 gpa_waived_reason, gpa_waived_at, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
               RETURNING id""",
            chapter_id, nm,
            f"{nm.split()[0].lower()}{i}@example.com",
            f"805555{1000+i:04d}",
            random.choice(HOMETOWNS), random.choice(MAJORS),
            random.choice(YEARS), random.choice(FUN_FACTS), chair["id"],
            archived, stage,
            random.choice(["intake_form", "referral", "tabling", "walk_up", "instagram"]),
            random.choice(["new", "contacted", "responded", "invited"]),
            f"@{nm.split()[0].lower()}_{i}" if prospect else None,
            gpa, waived,
            chair["id"] if waived else None,
            "Transferred mid-year; transcript pending from Cuesta." if waived else None,
            now - timedelta(days=2) if waived else None,
            now - timedelta(days=random.randint(1, 30)),
        )
        pnms.append({"id": pid, "name": nm, "stage": stage, "archived": archived})

    roster = [p for p in pnms if p["stage"] != "prospect" and not p["archived"]]

    # A deliberate duplicate: the same person through the intake form and the
    # CSV import, which is what the duplicate-merge screen exists to catch.
    dup_of = roster[3]
    dup_id = await conn.fetchval(
        """INSERT INTO pnms (chapter_id, name, email, phone, major, stage, source, created_by)
           VALUES ($1,$2,$3,$4,$5,'pnm','import',$6) RETURNING id""",
        chapter_id, dup_of["name"],
        f"{dup_of['name'].split()[0].lower()}.dupe@example.com",
        f"805555{9000:04d}", "Undeclared", chair["id"])

    # ---- Tag assignments ----------------------------------------------------
    for p in pnms:
        for t in random.sample(tag_ids, random.randint(0, 3)):
            await conn.execute(
                "INSERT INTO pnm_tags (pnm_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
                p["id"], t)

    # ---- Events + attendance ------------------------------------------------
    events = []
    for n, (label, days_ago, etype) in enumerate([
        ("Info Night", 12, "optional"), ("BBQ at the House", 9, "optional"),
        ("Bowling Social", 7, "optional"), ("Philanthropy Day", 5, "mandatory"),
        ("Sports Night", 3, "optional"), ("Formal Smoker", 1, "invite_only"),
    ]):
        eid = await conn.fetchval(
            """INSERT INTO events (chapter_id, name, date, starts_at, location,
                                   type, check_in_code, is_active, description)
               VALUES ($1,$2,$3,$3,$4,$5,$6,true,$7) RETURNING id""",
            chapter_id, label, now - timedelta(days=days_ago),
            random.choice(["Chapter House", "Dexter Lawn", "Mustang Lanes", "UU 220"]),
            etype, f"RUSH{100+n}", f"{label} - open to all PNMs.")
        events.append(eid)
        for p in random.sample(roster, random.randint(22, 40)):
            await conn.execute(
                """INSERT INTO event_attendance (event_id, pnm_id, checked_in_by_user_id,
                                                 checked_in_at, method)
                   VALUES ($1,$2,$3,$4,$5::attendance_method) ON CONFLICT DO NOTHING""",
                eid, p["id"], random.choice(brothers)["id"],
                now - timedelta(days=days_ago, hours=random.randint(0, 3)),
                random.choice(["QR", "SEARCH"]))

    # ---- Contact coverage ---------------------------------------------------
    # Uneven on purpose: a handful of PNMs nobody has met, so the coverage
    # signal has a reason to exist. The last two brothers meet nobody.
    active_brothers = brothers[:-2]
    for p in roster:
        met = random.sample(active_brothers, random.randint(0, 14))
        for b in met:
            await conn.execute(
                """INSERT INTO pnm_contacts (pnm_id, user_id, event_id, note)
                   VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING""",
                p["id"], b["id"],
                random.choice(events + [None]),
                random.choice([None, None, "Talked about his major."]))

    # ---- Notes --------------------------------------------------------------
    for p in roster:
        for _ in range(random.randint(0, 5)):
            await conn.execute(
                """INSERT INTO pnm_notes (pnm_id, author_user_id, body, anonymous, created_at)
                   VALUES ($1,$2,$3,$4,$5)""",
                p["id"], random.choice(active_brothers)["id"],
                random.choice(NOTE_BODIES), random.random() < 0.15,
                now - timedelta(days=random.randint(0, 10)))

    # ---- Rounds -------------------------------------------------------------
    # Round 1 ended with everyone voting. Round 2 ended close, so the cutoff
    # screen has a real decision in it. Round 3 is a draft the chair will run
    # live in the Playwright session.
    async def make_round(name, rtype, status, members, voters, started, ended):
        rid = await conn.fetchval(
            """INSERT INTO voting_rounds (chapter_id, name, type, status, created_by,
                                          room_code, selected_pnm_ids, started_at, ended_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id""",
            chapter_id, name, rtype, status, chair["id"],
            f"R{random.randint(1000,9999)}",
            # selected_pnm_ids is text[], not uuid[]
            [str(p["id"]) for p in members], started, ended)
        for idx, p in enumerate(members):
            await conn.execute(
                "INSERT INTO round_pnms (round_id, pnm_id, order_index) VALUES ($1,$2,$3)",
                rid, p["id"], idx)
        for p in members:
            for b in voters:
                if random.random() < 0.08:
                    continue  # not everyone votes on everyone
                val = random.choices(["YES", "NO", "UNKNOWN"], weights=[62, 26, 12])[0]
                await conn.execute(
                    """INSERT INTO votes (round_id, pnm_id, voter_user_id, value, favorite)
                       VALUES ($1,$2,$3,$4::vote_value,$5)
                       ON CONFLICT (round_id, pnm_id, voter_user_id) DO NOTHING""",
                    rid, p["id"], b["id"], val, random.random() < 0.12)
        return rid

    r1 = await make_round("Round 1 - After Info Night", "GENERAL", "ENDED",
                          roster, active_brothers,
                          now - timedelta(days=8), now - timedelta(days=8, hours=-2))
    r2_members = roster[:34]
    r2 = await make_round("Round 2 - Invite Only", "INVITE", "ENDED",
                          r2_members, active_brothers,
                          now - timedelta(days=4), now - timedelta(days=4, hours=-2))
    r3 = await conn.fetchval(
        """INSERT INTO voting_rounds (chapter_id, name, type, status, created_by,
                                      room_code, selected_pnm_ids)
           VALUES ($1,'Round 3 - Bid Vote','BID','DRAFT',$2,'LIVE01',$3) RETURNING id""",
        chapter_id, chair["id"], [str(p["id"]) for p in roster[:12]])
    for idx, p in enumerate(roster[:12]):
        await conn.execute(
            "INSERT INTO round_pnms (round_id, pnm_id, order_index) VALUES ($1,$2,$3)",
            r3, p["id"], idx)

    # ---- Bid list -----------------------------------------------------------
    bl = await conn.fetchval(
        """INSERT INTO bid_lists (chapter_id, source_round_id, name, bid_cap)
           VALUES ($1,$2,'Fall 2026 Bid List',18) RETURNING id""",
        chapter_id, r2)
    for pos, p in enumerate(r2_members[:24]):
        bucket = "bid" if pos < 14 else ("maybe" if pos < 19 else "cut")
        outcome = None
        if bucket == "bid":
            outcome = random.choice(["pending", "offered", "offered", "accepted", "declined"])
        await conn.execute(
            """INSERT INTO bid_list_entries (bid_list_id, pnm_id, bucket, position,
                                             outcome, outcome_at, outcome_by_user_id,
                                             declined_reason)
               VALUES ($1,$2,$3::bid_bucket,$4,$5,$6,$7,$8)""",
            bl, p["id"], bucket, pos, outcome,
            now - timedelta(days=1) if outcome and outcome != "pending" else None,
            chair["id"] if outcome and outcome != "pending" else None,
            random.choice(DECLINE_REASONS) if outcome == "declined" else None)

    counts = {}
    for t in ("chapters", "users", "memberships", "pnms", "tags", "pnm_tags",
              "events", "event_attendance", "pnm_contacts", "pnm_notes",
              "voting_rounds", "round_pnms", "votes", "bid_lists", "bid_list_entries"):
        counts[t] = await conn.fetchval(f"SELECT count(*) FROM {t}")

    print(f"chapter_id={chapter_id}")
    print(f"chair={chair['email']} ({chair['id']})")
    print(f"live_round_id={r3}")
    print(f"duplicate_pnm_id={dup_id}")
    for k, v in counts.items():
        print(f"  {k:20} {v}")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
