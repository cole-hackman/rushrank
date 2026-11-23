"""Links the backend builds come from PUBLIC_SITE_URL, and that origin is allowed by CORS."""
import importlib

from python_server import site


def test_default_is_the_deployed_site(monkeypatch):
    monkeypatch.delenv("PUBLIC_SITE_URL", raising=False)
    assert site.public_site_url() == "https://rushrank.vercel.app"


def test_env_overrides_and_trailing_slash_is_dropped(monkeypatch):
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://example.test/ ")
    assert site.public_site_url() == "https://example.test"


def test_site_origin_is_always_a_cors_origin(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://other.test")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://example.test")
    import python_server.main as main
    main = importlib.reload(main)
    assert "https://example.test" in main.ALLOWED_ORIGINS
    assert "https://other.test" in main.ALLOWED_ORIGINS


def test_no_hardcoded_old_domain_in_backend_links():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    for name in ("services.py", "routes.py", "main.py"):
        assert "rushrank.app" not in (root / name).read_text(), name
