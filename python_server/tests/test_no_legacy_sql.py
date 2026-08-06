"""
Static guard against reintroducing the schema drift.

Every defect in docs/AUDIT-2026-08.md that reached production was a query naming
a table or column that the migrations do not create. This test greps the backend
for those names. It is crude, runs in milliseconds, needs no database, and would
have caught all of them.

Entries are removed from EXPECTED_REMAINING as the corresponding queries are
migrated (PR 2 of the cleanup). The list is deliberately explicit rather than a
blanket skip, so the remaining work is visible and shrinking.
"""

from __future__ import annotations

import pathlib
import re

BACKEND = pathlib.Path(__file__).resolve().parents[1]

# (pattern, why it is wrong)
FORBIDDEN: list[tuple[str, str]] = [
    (r"\bFROM\s+attendance\b",       "legacy table; migrations create event_attendance"),
    (r"\bINTO\s+attendance\b",       "legacy table; migrations create event_attendance"),
    (r"\bJOIN\s+attendance\b",       "legacy table; migrations create event_attendance"),
    (r"\bevent_attendances\b",       "typo: the table is event_attendance, singular"),
    (r"\bFROM\s+notes\b",            "legacy table; migrations create pnm_notes"),
    (r"\bJOIN\s+notes\b",            "legacy table; migrations create pnm_notes"),
    (r"\bis_favorite\b",             "legacy votes column; use votes.favorite"),
    (r"\bv\.score\b",                "legacy votes column; use votes.value"),
    (r"information_schema\.columns", "runtime schema sniffing; the schema is now known"),
]

# Counts that exist today and are fixed in the next PR of this cleanup. A count
# going UP fails the test; going down means an entry should be lowered or removed.
EXPECTED_REMAINING: dict[str, int] = {
    r"\bFROM\s+attendance\b": 3,
    r"\bINTO\s+attendance\b": 2,
    r"\bJOIN\s+attendance\b": 0,
    r"\bevent_attendances\b": 2,
    r"\bFROM\s+notes\b": 4,
    r"\bJOIN\s+notes\b": 0,
    r"\bis_favorite\b": 24,
    r"\bv\.score\b": 8,
    r"information_schema\.columns": 6,
}


def _python_sources() -> list[pathlib.Path]:
    return [
        p for p in BACKEND.glob("*.py")
        if p.name not in {"__init__.py"}
    ]


def test_legacy_sql_references_do_not_increase():
    """No new references to tables and columns the migrations do not create."""
    problems: list[str] = []

    for pattern, reason in FORBIDDEN:
        hits: list[str] = []
        for path in _python_sources():
            for lineno, line in enumerate(path.read_text().splitlines(), start=1):
                if re.search(pattern, line, re.IGNORECASE):
                    hits.append(f"{path.name}:{lineno}")

        budget = EXPECTED_REMAINING.get(pattern, 0)
        if len(hits) > budget:
            problems.append(
                f"{pattern} ({reason}): found {len(hits)}, budget {budget} -> {hits}"
            )

    assert not problems, "legacy SQL references increased:\n" + "\n".join(problems)


def test_budgets_are_not_stale():
    """If a budget is now too generous, lower it -- otherwise it stops guarding.

    This is what keeps the list above honest: once PR 2 fixes a query, this test
    fails until the budget is reduced to match reality.
    """
    stale: list[str] = []

    for pattern, _reason in FORBIDDEN:
        count = sum(
            1
            for path in _python_sources()
            for line in path.read_text().splitlines()
            if re.search(pattern, line, re.IGNORECASE)
        )
        budget = EXPECTED_REMAINING.get(pattern, 0)
        if count < budget:
            stale.append(f"{pattern}: budget {budget} but only {count} remain -- lower it")

    assert not stale, "\n".join(stale)
