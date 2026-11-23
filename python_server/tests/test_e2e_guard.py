"""The e2e scripts only ever run against a local, disposable database."""

import os
import pathlib
import subprocess
import sys

import pytest

E2E = pathlib.Path(__file__).resolve().parents[2] / "e2e"

# Scripts that only read pages. Everything else has to call the guard.
READ_ONLY = {"smoke.mjs", "visual.mjs", "probe-contrast.mjs"}

# Nothing listens on port 1, so a regression fails to connect instead of writing.
CLOSED = "postgresql://nobody@127.0.0.1:1/rushrank_e2e"


def _run(script, **env):
    base = {k: v for k, v in os.environ.items() if not k.startswith(("PG", "E2E_")) and k != "DATABASE_URL"}
    return subprocess.run(
        [sys.executable, str(E2E / script)],
        env={**base, "SUPABASE_JWT_SECRET": "unit-test", **env},
        capture_output=True, text=True, timeout=60,
    )


@pytest.mark.parametrize("script", ["seed.py", "fixtures.py", "guard.py"])
def test_database_url_is_not_a_fallback(script):
    result = _run(script, DATABASE_URL=CLOSED)
    assert result.returncode == 2
    assert "E2E_DATABASE_URL is not set" in result.stderr


@pytest.mark.parametrize("script", ["seed.py", "fixtures.py", "guard.py"])
@pytest.mark.parametrize("url,reason", [
    ("postgresql://u@db.example.invalid:5432/rushrank_e2e", "is not local"),
    ("postgresql://u@127.0.0.1:1/rushrank", "does not end in"),
    ("postgresql:///rushrank_e2e?host=db.example.invalid", "query string"),
])
def test_non_local_targets_are_refused(script, url, reason):
    result = _run(script, E2E_DATABASE_URL=url)
    assert result.returncode == 2
    assert reason in result.stderr


def test_empty_host_does_not_follow_pghost():
    result = _run("guard.py", E2E_DATABASE_URL="postgresql:///rushrank_e2e", PGHOST="db.example.invalid")
    assert result.returncode == 2
    assert "PGHOST" in result.stderr


def test_every_writing_script_calls_the_guard():
    missing = [
        p.name for p in sorted(E2E.glob("*.mjs"))
        if p.name != "guard.mjs" and p.name not in READ_ONLY
        and "\nawait guard();" not in p.read_text()
    ]
    assert missing == []
