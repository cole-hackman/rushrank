"""
Supabase JWT Authentication for FastAPI
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import os
from jose import jwt, JWTError
import json
from typing import Optional, Dict, Any
import logging

from .cache import SimpleCache

logger = logging.getLogger(__name__)

# HTTP Bearer security scheme
security = HTTPBearer()

# Cache for JWKS keys
_jwks_cache: Optional[Dict[str, Any]] = None

async def get_jwks() -> Dict[str, Any]:
    """Fetch JWKS from Supabase"""
    global _jwks_cache
    
    if _jwks_cache:
        return _jwks_cache
    
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL not configured"
        )
    
    # Prefer explicit override if set, else default endpoint
    jwks_url = os.getenv("SUPABASE_JWKS_URL") or f"{supabase_url}/auth/v1/keys"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            _jwks_cache = response.json()
            if _jwks_cache is None:
                raise HTTPException(status_code=500, detail="Invalid JWKS response")
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch authentication keys"
        )

async def verify_token(token: str) -> Dict[str, Any]:
    """Verify Supabase JWT token.
    Supports:
    - RS256 via JWKS (Supabase public keys)
    - HS256 via SUPABASE_JWT_SECRET (Project Settings -> API -> JWT secret)
    """
    # Inspect algorithm
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Try HS256 first if configured and the alg indicates HMAC
    if alg and alg.upper().startswith("HS"):
        secret = os.getenv("SUPABASE_JWT_SECRET")
        if secret:
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    options={
                        "verify_aud": False,
                        "verify_iss": False,
                    },
                )
                return payload
            except JWTError as e:
                logger.warning(f"HS256 verification failed, will try JWKS: {e}")

    # Fallback to RS256 using JWKS
    try:
        jwks = await get_jwks()
        kid = header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key ID")
        key = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                key = jwk
                break
        if not key:
            # Refresh JWKS once in case of rotation, then retry lookup
            global _jwks_cache
            _jwks_cache = None
            jwks = await get_jwks()
            for jwk in jwks.get("keys", []):
                if jwk.get("kid") == kid:
                    key = jwk
                    break
            if not key:
                raise HTTPException(status_code=401, detail="Invalid token key ID")

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256", "ES256", "ES384", "ES512"],
            options={
                "verify_aud": False,
                "verify_iss": False,
            },
        )
        return payload
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )

# Users we have already reconciled this process, so the upsert below costs one
# statement per user per five minutes rather than one per request. This is what
# python_server/cache.py was written for; it had no callers until now.
_user_sync_cache = SimpleCache(default_ttl=300)


async def ensure_user_row(user_id: str, email: Optional[str]) -> None:
    """Make sure the authenticated Supabase user exists in public.users.

    Nothing ever synced auth.users to public.users. No trigger existed, and the
    only INSERT INTO users lived inside the admin invite flow -- so a user who
    signed up with a magic link had an auth row and no local row, which meant a
    foreign-key violation the moment chapter provisioning inserted their
    membership, and a 404 from GET /me. That is one of the two independent
    reasons self-serve signup could never complete.

    0013 also installs a trigger on auth.users as a backstop for users who
    verify their email but never hit the API. This is the authoritative path
    because it works for every auth method, needs no Supabase dashboard step,
    and is testable.
    """
    if not email:
        return
    if _user_sync_cache.get(user_id) is not None:
        return

    from .database import get_db

    try:
        db = get_db()
    except RuntimeError:
        # No pool yet (e.g. during startup); skip rather than fail the request.
        return

    try:
        # Written so it cannot raise rather than wrapped in a try/except.
        #
        # users.email is UNIQUE, and an invited-then-signed-up user has a local
        # row under a *different* id holding the same address. Letting that
        # violation fire and catching it is not enough: an error inside a
        # transaction aborts the whole transaction, so every subsequent
        # statement in the request would fail too. The guard skips instead.
        # 0013's reconciliation is what actually repoints those rows.
        await db.execute_command(
            """
            INSERT INTO users (id, email)
            SELECT $1::uuid, $2
            WHERE NOT EXISTS (
                SELECT 1 FROM users WHERE email = $2 AND id <> $1::uuid
            )
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
            """,
            user_id, email,
        )
        _user_sync_cache.set(user_id, True)
    except Exception as e:
        # Anything else (no pool, permissions) must not break the request.
        logger.warning(f"Could not sync user {user_id} into public.users: {e}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """FastAPI dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required"
        )
    
    token = credentials.credentials
    payload = await verify_token(token)
    
    # Extract user info from JWT payload
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload"
        )

    await ensure_user_row(user_id, email)

    return {
        "user_id": user_id,
        "email": email,
        "payload": payload
    }

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[Dict[str, Any]]:
    """Optional authentication - returns None if no token provided"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None