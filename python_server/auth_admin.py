"""Finding one account through the Supabase Auth admin API."""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

_PER_PAGE = 200
_MAX_PAGES = 100


class AuthLookupError(Exception):
    """The lookup could not give a definite answer."""


async def find_auth_user_by_email(
    client: httpx.AsyncClient, supabase_url: str, service_key: str, email: str
) -> Optional[Dict[str, Any]]:
    """The account with exactly this email, or None when there is none.

    The admin endpoint returns a list, and what it filters on depends on the
    version, so `filter` only narrows the list and the email is always compared
    here. Reads every page before answering "none". Raises AuthLookupError
    rather than guessing.
    """
    wanted = email.strip().lower()
    if not wanted:
        raise AuthLookupError("no email given")
    seen: set = set()
    matches: Dict[str, Dict[str, Any]] = {}

    for page in range(1, _MAX_PAGES + 1):
        try:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                params={"filter": wanted, "page": page, "per_page": _PER_PAGE},
                headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
            )
            users = response.json().get("users") if response.status_code == 200 else None
        except (httpx.HTTPError, ValueError, AttributeError) as e:
            raise AuthLookupError(f"account lookup failed: {type(e).__name__}") from e
        if not isinstance(users, list):
            raise AuthLookupError(f"account lookup returned {response.status_code}")

        new = [u for u in users if u.get("id") and u["id"] not in seen]
        if not new:
            break
        for user in new:
            seen.add(user["id"])
            if (user.get("email") or "").strip().lower() == wanted:
                matches[user["id"]] = user
    else:
        raise AuthLookupError("too many accounts to search")

    if len(matches) > 1:
        raise AuthLookupError("more than one account has this email")
    return next(iter(matches.values()), None)
