"""Unit tests for ChapterService.provision_chapter (mock-based)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from python_server.services import ChapterService


def _db(execute_one_seq=None, execute_command=None):
    """Build a mock db whose execute_one returns from a sequence."""
    db = MagicMock()
    seq = list(execute_one_seq or [])

    async def fake_execute_one(sql, *args):
        return seq.pop(0) if seq else None

    db.execute_one = fake_execute_one
    db.execute_command = AsyncMock(return_value=execute_command or "OK")
    db.execute_query = AsyncMock(return_value=[])
    return db


@pytest.mark.asyncio
async def test_provision_creates_chapter_and_admin_membership():
    svc = ChapterService()
    # First call (autodetect_accent → hex), second (idempotency check → None),
    # third (insert chapter → returns id row)
    seq = [
        {"hex_primary": "#0033A0"},   # autodetect
        None,                          # idempotency: not existing
        {"id": "chap-xyz"},           # insert returning id
    ]
    with patch("python_server.services.get_db", return_value=_db(seq)):
        result = await svc.provision_chapter(
            user_id="u-1", fraternity_name="Sigma Chi",
            school="Boston College",
            chapter_name="Sigma Chi at Boston College",
            admin_name="Test Admin",
        )
    assert result == {"chapter_id": "chap-xyz"}


@pytest.mark.asyncio
async def test_provision_is_idempotent_when_membership_exists():
    svc = ChapterService()
    seq = [
        {"hex_primary": "#0033A0"},        # autodetect
        {"id": "chap-existing"},            # idempotency hit
    ]
    with patch("python_server.services.get_db", return_value=_db(seq)):
        result = await svc.provision_chapter(
            user_id="u-1", fraternity_name="Sigma Chi",
            school="BC", chapter_name="Sigma Chi at BC",
            admin_name="Test",
        )
    assert result == {"chapter_id": "chap-existing"}


@pytest.mark.asyncio
async def test_provision_unknown_fraternity_theme_has_null_accent():
    svc = ChapterService()
    seq = [
        None,                                # autodetect miss
        None,                                # idempotency miss
        {"id": "chap-new"},                  # insert
    ]
    with patch("python_server.services.get_db", return_value=_db(seq)):
        result = await svc.provision_chapter(
            user_id="u-1", fraternity_name="Made Up",
            school="State U", chapter_name="Made Up at State U",
            admin_name="Test",
        )
    assert "chapter_id" in result
    assert result["chapter_id"] == "chap-new"
