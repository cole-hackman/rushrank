"""
Rate limiting configuration for RushRank API.

Uses slowapi to apply rate limits on sensitive endpoints.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import os

# Get rate limit from environment or use defaults
DEFAULT_RATE_LIMIT = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
VOTE_RATE_LIMIT = os.getenv("RATE_LIMIT_VOTES", "30/minute")
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


# Create limiter instance
limiter = Limiter(key_func=get_client_ip)


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
