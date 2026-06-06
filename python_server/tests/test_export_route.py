"""Unit tests for POST /pnms/export/pptx route (mock-based)."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from python_server.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _auth_user(user_id="u-1"):
    async def fake_current_user():
        return {"user_id": user_id, "email": "x@x.com"}
    return fake_current_user


def _override_auth(user_id="u-1"):
    from python_server.auth import get_current_user
    app.dependency_overrides[get_current_user] = _auth_user(user_id)


def _clear_overrides():
    app.dependency_overrides.clear()


def test_export_zero_pnms_returns_400(client):
    _override_auth("u-1")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.pnm_service.list_for_export", new=AsyncMock(return_value=[])):
            r = client.post("/api/v1/pnms/export/pptx", json={"filters": {}})
            assert r.status_code == 400
            assert "No PNMs" in r.json()["detail"]
    finally:
        _clear_overrides()


def test_export_over_cap_returns_400(client):
    _override_auth("u-2")
    fake_rows = [{"id": str(i), "name": f"P{i}", "year": "", "major": "", "hometown": "",
                  "photo_url": None, "tags": [], "status": "active",
                  "vote_summary": {"up": 0, "down": 0, "star": 0},
                  "latest_note": None, "gpa": None} for i in range(201)]
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.pnm_service.list_for_export", new=AsyncMock(return_value=fake_rows)):
            r = client.post("/api/v1/pnms/export/pptx", json={"filters": {}})
            assert r.status_code == 400
            assert "200" in r.json()["detail"]
    finally:
        _clear_overrides()


def test_export_forbidden_for_member(client):
    _override_auth("u-3")
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="member")):
            r = client.post("/api/v1/pnms/export/pptx", json={"filters": {}})
            assert r.status_code == 403
    finally:
        _clear_overrides()


def test_export_returns_pptx_bytes(client):
    _override_auth("u-4")
    fake_rows = [{
        "id": "p1", "name": "Test PNM", "year": "Fr", "major": "CS",
        "hometown": "Boston", "photo_url": None, "tags": ["legacy"],
        "status": "active",
        "vote_summary": {"up": 5, "down": 1, "star": 0},
        "latest_note": None, "gpa": None,
    }]
    try:
        with patch("python_server.routes.chapter_service.get_user_chapter_id", new=AsyncMock(return_value="c-1")), \
             patch("python_server.routes.chapter_service.get_user_role", new=AsyncMock(return_value="admin")), \
             patch("python_server.routes.pnm_service.list_for_export", new=AsyncMock(return_value=fake_rows)), \
             patch("python_server.routes.chapter_service.get_chapter", new=AsyncMock(return_value={"name": "Test Chapter"})), \
             patch("python_server.routes.chapter_service.get_theme", new=AsyncMock(return_value={"enabled": False, "accent_hex": None, "source": "auto"})):
            r = client.post("/api/v1/pnms/export/pptx", json={"filters": {}})
            assert r.status_code == 200, r.text
            assert r.headers["content-type"].startswith(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            )
            assert "attachment" in r.headers["content-disposition"]
            assert r.content[:4] == b"PK\x03\x04"
    finally:
        _clear_overrides()
