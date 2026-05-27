"""Unit tests for ChapterService theme methods + theme routes.

Uses mock get_db; the project has no live test DB.
"""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException

from python_server.services import ChapterService
from python_server.fraternity_colors_seed import ALIASES


def _mock_db(execute_one=None, execute_query=None, execute_command=None):
    db = MagicMock()
    db.execute_one = AsyncMock(return_value=execute_one)
    db.execute_query = AsyncMock(return_value=execute_query or [])
    db.execute_command = AsyncMock(return_value=execute_command or "OK")
    return db


@pytest.mark.asyncio
async def test_get_theme_returns_default():
    svc = ChapterService()
    default = {"enabled": False, "accent_hex": None, "source": "auto"}
    with patch("python_server.services.get_db", return_value=_mock_db(execute_one={"theme": default})):
        assert await svc.get_theme("chap-1") == default


@pytest.mark.asyncio
async def test_get_theme_parses_string_jsonb():
    svc = ChapterService()
    default = {"enabled": True, "accent_hex": "#0033A0", "source": "manual"}
    db = _mock_db(execute_one={"theme": json.dumps(default)})
    with patch("python_server.services.get_db", return_value=db):
        assert await svc.get_theme("chap-1") == default


@pytest.mark.asyncio
async def test_get_theme_missing_chapter_404():
    svc = ChapterService()
    with patch("python_server.services.get_db", return_value=_mock_db(execute_one=None)):
        with pytest.raises(HTTPException) as exc:
            await svc.get_theme("nope")
        assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_theme_persists_admin_changes():
    svc = ChapterService()
    db = _mock_db(execute_one={"1": 1})  # verify_admin_access returns truthy
    with patch("python_server.services.get_db", return_value=db):
        result = await svc.update_theme(
            "chap-1", "user-1",
            {"enabled": True, "accent_hex": "#0033A0", "source": "manual"},
        )
    assert result == {"enabled": True, "accent_hex": "#0033A0", "source": "manual"}


@pytest.mark.asyncio
async def test_update_theme_rejects_invalid_hex():
    svc = ChapterService()
    db = _mock_db(execute_one={"1": 1})
    with patch("python_server.services.get_db", return_value=db):
        with pytest.raises(ValueError, match="hex"):
            await svc.update_theme(
                "chap-1", "user-1",
                {"enabled": True, "accent_hex": "not-a-hex", "source": "manual"},
            )


@pytest.mark.asyncio
async def test_update_theme_rejects_invalid_source():
    svc = ChapterService()
    db = _mock_db(execute_one={"1": 1})
    with patch("python_server.services.get_db", return_value=db):
        with pytest.raises(ValueError, match="source"):
            await svc.update_theme(
                "chap-1", "user-1",
                {"enabled": True, "accent_hex": "#000000", "source": "bogus"},
            )


@pytest.mark.asyncio
async def test_update_theme_rejects_non_admin():
    svc = ChapterService()
    # verify_admin_access: execute_one returns None → 403
    db = _mock_db(execute_one=None)
    with patch("python_server.services.get_db", return_value=db):
        with pytest.raises(HTTPException) as exc:
            await svc.update_theme(
                "chap-1", "user-1",
                {"enabled": True, "accent_hex": "#000000", "source": "manual"},
            )
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_autodetect_accent_matches_known_fraternity():
    svc = ChapterService()
    db = _mock_db(execute_one={"hex_primary": "#0033A0"})
    with patch("python_server.services.get_db", return_value=db):
        assert await svc.autodetect_accent("Sigma Chi") == "#0033A0"


@pytest.mark.asyncio
async def test_autodetect_accent_handles_fiji_alias():
    """FIJI → Phi Gamma Delta (#4B0082). Verifies ALIASES is consulted."""
    svc = ChapterService()
    captured = {}
    async def fake_execute_one(sql, *args):
        captured["args"] = args
        return {"hex_primary": "#4B0082"}
    db = MagicMock()
    db.execute_one = fake_execute_one
    with patch("python_server.services.get_db", return_value=db):
        result = await svc.autodetect_accent("FIJI")
    assert result == "#4B0082"
    assert captured["args"][0] == "Phi Gamma Delta"


@pytest.mark.asyncio
async def test_autodetect_accent_returns_none_for_unknown():
    svc = ChapterService()
    db = _mock_db(execute_one=None)
    with patch("python_server.services.get_db", return_value=db):
        assert await svc.autodetect_accent("Made Up Frat") is None


def test_aliases_seed_has_fiji():
    assert ALIASES["fiji"] == "Phi Gamma Delta"


def test_seed_has_30_entries():
    from python_server.fraternity_colors_seed import FRATERNITY_COLORS
    assert len(FRATERNITY_COLORS) == 30
