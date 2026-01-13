"""
Simple in-memory caching for RushRank API.

Provides a lightweight cache for read-heavy endpoints like chapters and tags.
"""

import time
from typing import Any, Optional, Dict, Callable
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class SimpleCache:
    """
    Simple in-memory cache with TTL (time-to-live).
    
    Not suitable for multi-process deployments - use Redis instead in production.
    """
    
    def __init__(self, default_ttl: int = 300):
        """
        Initialize cache.
        
        Args:
            default_ttl: Default time-to-live in seconds (default 5 minutes)
        """
        self._cache: Dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from cache.
        
        Returns None if key doesn't exist or has expired.
        """
        if key not in self._cache:
            return None
        
        value, expires_at = self._cache[key]
        
        if time.time() > expires_at:
            # Expired - remove and return None
            del self._cache[key]
            return None
        
        return value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if not specified)
        """
        ttl = ttl if ttl is not None else self._default_ttl
        expires_at = time.time() + ttl
        self._cache[key] = (value, expires_at)
    
    def delete(self, key: str) -> bool:
        """
        Delete a key from cache.
        
        Returns True if key existed, False otherwise.
        """
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def invalidate_prefix(self, prefix: str) -> int:
        """
        Invalidate all keys starting with a prefix.
        
        Returns the number of keys invalidated.
        """
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
        for key in keys_to_delete:
            del self._cache[key]
        return len(keys_to_delete)
    
    def clear(self) -> None:
        """Clear all cached values."""
        self._cache.clear()
    
    def stats(self) -> Dict[str, int]:
        """Get cache statistics."""
        now = time.time()
        valid_count = sum(1 for _, (_, exp) in self._cache.items() if exp > now)
        return {
            "total_keys": len(self._cache),
            "valid_keys": valid_count,
            "expired_keys": len(self._cache) - valid_count,
        }


# Global cache instance
cache = SimpleCache(default_ttl=300)  # 5 minute default TTL


def cached(key_prefix: str, ttl: Optional[int] = None):
    """
    Decorator for caching async function results.
    
    Usage:
        @cached("chapters")
        async def get_chapters():
            ...
    
    Args:
        key_prefix: Prefix for cache key
        ttl: Time-to-live in seconds
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from prefix and args
            cache_key = f"{key_prefix}:{hash(str(args) + str(sorted(kwargs.items())))}"
            
            # Check cache first
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_value
            
            # Call function and cache result
            logger.debug(f"Cache miss: {cache_key}")
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result
        
        return wrapper
    return decorator


# Cache invalidation helpers
def invalidate_chapters_cache():
    """Invalidate all chapters-related cache entries."""
    cache.invalidate_prefix("chapters:")


def invalidate_pnms_cache(chapter_id: Optional[str] = None):
    """Invalidate PNM cache, optionally for a specific chapter."""
    if chapter_id:
        cache.invalidate_prefix(f"pnms:{chapter_id}")
    else:
        cache.invalidate_prefix("pnms:")


def invalidate_tags_cache(chapter_id: Optional[str] = None):
    """Invalidate tags cache, optionally for a specific chapter."""
    if chapter_id:
        cache.invalidate_prefix(f"tags:{chapter_id}")
    else:
        cache.invalidate_prefix("tags:")
