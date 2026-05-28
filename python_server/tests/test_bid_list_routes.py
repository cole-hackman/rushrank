"""Route tests for /chapters/me/bid-list (TestClient + dependency override)."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from python_server.main import app
from python_server.auth import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


def _override(user_id="u-1"):
    async def fake(): return {"user_id": user_id, "email": "x@x.com"}
    app.dependency_overrides[get_current_user] = fake


def _clear():
    app.dependency_overrides.clear()


def test_get_bid_list_404_when_none(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value=None)):
            r = client.get("/api/v1/chapters/me/bid-list")
            assert r.status_code == 404
    finally:
        _clear()


def test_get_bid_list_returns_list_with_entries(client):
    _override("u-1")
    fake = {
        "bid_list": {"id": "list-A", "name": "Rush", "bid_cap": 25,
                      "locked_by": None, "locked_at": None, "finalized_at": None,
                      "chapter_id": "c-1", "source_round_id": None,
                      "created_at": None, "updated_at": None},
        "entries": [],
    }
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value=fake["bid_list"])), \
             patch("python_server.routes.bid_list_service.get_with_entries", new=AsyncMock(return_value=fake)):
            r = client.get("/api/v1/chapters/me/bid-list")
            assert r.status_code == 200
            assert r.json()["bid_list"]["id"] == "list-A"
    finally:
        _clear()


def test_create_bid_list_admin_only(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="member")):
            r = client.post("/api/v1/chapters/me/bid-list",
                            json={"source_round_id": "r-1", "name": "Rush", "bid_cap": 25})
            assert r.status_code == 403
    finally:
        _clear()


def test_patch_entry_returns_409_when_lock_not_held(client):
    _override("u-1")
    from fastapi import HTTPException
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active", new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.update_entry",
                   new=AsyncMock(side_effect=HTTPException(status_code=409, detail="You must hold the lock"))):
            r = client.patch("/api/v1/chapters/me/bid-list/entries/p-1",
                              json={"bucket": "bid", "position": 0})
            assert r.status_code == 409
    finally:
        _clear()


def test_export_csv_returns_text(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active",
                   new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.export_csv",
                   new=AsyncMock(return_value="bucket,name\nbid,Alice\n")):
            r = client.get("/api/v1/chapters/me/bid-list/export/csv")
            assert r.status_code == 200
            assert "bid,Alice" in r.text
            assert "attachment" in r.headers["content-disposition"].lower()
    finally:
        _clear()


def test_export_pdf_returns_pdf(client):
    _override("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.bid_list_service.get_active",
                   new=AsyncMock(return_value={"id": "list-A"})), \
             patch("python_server.routes.bid_list_service.export_pdf",
                   new=AsyncMock(return_value=b"%PDF-1.4\nfake")):
            r = client.get("/api/v1/chapters/me/bid-list/export/pdf")
            assert r.status_code == 200
            assert r.content[:5] == b"%PDF-"
    finally:
        _clear()
