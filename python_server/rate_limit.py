"""
Rate limiting configuration for RushRank API.

Uses slowapi to apply rate limits on sensitive endpoints.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from jose import jwt
import os

# Get rate limit from environment or use defaults.
#
# The vote budget is per-voter (see get_rate_limit_key), so it only has to cover
# one brother's swiping: a vote per PNM, plus re-votes and favourites. 60/minute
# is generous for that and still bounds a runaway client.
DEFAULT_RATE_LIMIT = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
VOTE_RATE_LIMIT = os.getenv("RATE_LIMIT_VOTES", "60/minute")
AUTH_RATE_LIMIT = os.getenv("RATE_LIMIT_AUTH", "10/minute")
WRITE_RATE_LIMIT = os.getenv("RATE_LIMIT_WRITE", "60/minute")


def get_client_ip(request: Request) -> str:
    """
    Get client IP address, handling proxy headers.
    """
    # Check for forwarded headers (behind proxy/load balancer)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in the list is the original client
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip

    # Fall back to direct connection IP
    return get_remote_address(request)


def get_rate_limit_key(request: Request) -> str:
    """
    Choose the rate-limit bucket for a request.

    Keyed on the authenticated user where there is one, and on IP only where
    there isn't. A chapter votes from one venue's Wi-Fi: keyed on IP, forty
    phones behind one NAT shared a single 30/minute bucket, so the room started
    getting 429s partway through the first live session. Per-user keys give each
    brother his own budget. Public routes (intake, demo) stay IP-keyed, which is
    where abuse actually comes from.

    The `sub` claim is read WITHOUT verifying the signature. This only selects a
    counter -- it never grants access. Every protected route still verifies the
    token through get_current_user, so a forged token buys you your own rate
    limit bucket and nothing else.
    """
    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        try:
            subject = jwt.get_unverified_claims(token).get("sub")
            if subject:
                return f"user:{subject}"
        except Exception:
            # Malformed or unparseable token -- fall through to IP.
            pass

    return f"ip:{get_client_ip(request)}"


# Create limiter instance
limiter = Limiter(key_func=get_rate_limit_key)


def setup_rate_limiting(app):
    """
    Configure rate limiting on the FastAPI app.

    Call this in main.py after creating the app:
        setup_rate_limiting(app)
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Export rate limit decorators for use in routes
# Usage in routes.py:
#   from .rate_limit import limiter, VOTE_RATE_LIMIT
#
#   @router.post("/votes")
#   @limiter.limit(VOTE_RATE_LIMIT)
#   async def submit_vote(request: Request, ...):
#       ...
