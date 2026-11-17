"""The public origin of the web app, used wherever the backend builds a link.

Set PUBLIC_SITE_URL to the domain people actually visit. It is also always
allowed as a CORS origin, so the deployed site can reach the API even when
ALLOWED_ORIGINS has not been updated to match.
"""
import os

DEFAULT_PUBLIC_SITE_URL = "https://rushrank.vercel.app"


def public_site_url() -> str:
    return (os.getenv("PUBLIC_SITE_URL") or DEFAULT_PUBLIC_SITE_URL).strip().rstrip("/")
