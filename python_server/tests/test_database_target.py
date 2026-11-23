"""A remote database is only used when the person starting the server says so."""

import asyncio
import pathlib
import sys

import pytest

from python_server import database, main

REMOTE = "postgresql://u@db.example.invalid:6543/postgres"
LOCAL = "postgresql://u@localhost:5432/rushrank"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for name in ("RENDER", "ALLOW_REMOTE_DB", "BIND_HOST", "PGHOST", "PGHOSTADDR", "PGSERVICE",
                 "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET", "SOME_SETTING"):
        # setenv first so anything the loader writes is undone as well.
        monkeypatch.setenv(name, "x")
        monkeypatch.delenv(name)


@pytest.mark.parametrize("url", [
    LOCAL,
    "postgres://u@127.0.0.1/x",
    "postgresql://u@[::1]:5432/x",
    "postgresql:///x",
    "postgresql://u@/x?host=/tmp",
    "postgresql://%2Ftmp/x",
])
def test_local_urls(url):
    assert database.is_local_database_url(url)


@pytest.mark.parametrize("url", [
    REMOTE,
    "postgresql://u@localhost.example.invalid/x",
    "postgresql://u@localhost,db.example.invalid/x",
    "postgresql:///x?host=db.example.invalid",
    "postgresql://localhost/x?host=db.example.invalid",
    "postgresql:///x?service=prod",
    "host=db.example.invalid dbname=x",
    "",
])
def test_remote_or_unclear_urls(url):
    assert not database.is_local_database_url(url)


def test_empty_host_follows_pghost(monkeypatch):
    monkeypatch.setenv("PGHOST", "db.example.invalid")
    assert not database.is_local_database_url("postgresql:///x")


def _open_pool(monkeypatch, url):
    opened = []

    async def fake_create_pool(dsn, **_):
        opened.append(dsn)

    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setattr(database.asyncpg, "create_pool", fake_create_pool)
    asyncio.run(database.get_db_pool())
    return opened


def test_pool_opens_a_local_database(monkeypatch):
    assert _open_pool(monkeypatch, LOCAL) == [LOCAL]


def test_pool_refuses_a_remote_database(monkeypatch):
    with pytest.raises(RuntimeError, match="ALLOW_REMOTE_DB"):
        _open_pool(monkeypatch, REMOTE)


def test_pool_opens_a_remote_database_on_render(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    assert _open_pool(monkeypatch, REMOTE) == [REMOTE]


def test_opting_in_opens_a_remote_database_and_warns(monkeypatch, caplog):
    monkeypatch.setenv("ALLOW_REMOTE_DB", "1")
    assert _open_pool(monkeypatch, REMOTE) == [REMOTE]
    assert any("changes real data" in r.message for r in caplog.records)


def _load(tmp_path, url, extra=""):
    (tmp_path / ".env").write_text(
        f"DATABASE_URL={url}\nSUPABASE_SERVICE_ROLE_KEY=key\nSUPABASE_JWT_SECRET=secret\nSOME_SETTING=1\n{extra}"
    )
    main._load_env_from_files(tmp_path)
    import os
    return {k: os.environ.get(k) for k in (
        "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET", "SOME_SETTING")}


def test_env_file_with_a_remote_database_is_not_used(tmp_path):
    assert _load(tmp_path, REMOTE) == {
        "DATABASE_URL": None, "SUPABASE_SERVICE_ROLE_KEY": None, "SUPABASE_JWT_SECRET": None, "SOME_SETTING": "1",
    }


def test_env_file_cannot_opt_itself_in(tmp_path):
    assert _load(tmp_path, REMOTE, "ALLOW_REMOTE_DB=1\nRENDER=1\n")["DATABASE_URL"] is None
    assert not database.remote_database_allowed()


def test_env_file_with_a_remote_database_after_opting_in(tmp_path, monkeypatch):
    monkeypatch.setenv("ALLOW_REMOTE_DB", "1")
    assert _load(tmp_path, REMOTE)["DATABASE_URL"] == REMOTE


def test_env_file_with_a_local_database_loads_fully(tmp_path):
    assert all(_load(tmp_path, LOCAL).values())


@pytest.mark.parametrize("env,expected", [
    ({}, "127.0.0.1"),
    ({"RENDER": "true"}, "0.0.0.0"),
    ({"BIND_HOST": "0.0.0.0"}, "0.0.0.0"),
])
def test_bind_host(monkeypatch, env, expected):
    import runpy
    import uvicorn

    seen = {}
    monkeypatch.setattr(uvicorn, "run", lambda *a, **kw: seen.update(kw))
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    script = pathlib.Path(__file__).resolve().parents[2] / "run_fastapi.py"
    monkeypatch.setattr(sys, "argv", [str(script)])
    runpy.run_path(str(script), run_name="__main__")
    assert seen["host"] == expected


def test_integration_tests_abort_on_a_remote_server(monkeypatch):
    from python_server.tests.integration import conftest

    monkeypatch.setenv("TEST_DATABASE_URL", REMOTE)
    with pytest.raises(pytest.exit.Exception, match="not a local Postgres"):
        conftest._require_test_db()

    monkeypatch.setenv("TEST_DATABASE_URL", LOCAL)
    assert conftest._require_test_db() == LOCAL
