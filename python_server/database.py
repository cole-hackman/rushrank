"""
Database connection and utilities for FastAPI + Supabase
"""
import asyncpg
import os
from typing import Optional
from urllib.parse import parse_qsl, unquote, urlsplit
import logging
import asyncio

logger = logging.getLogger(__name__)

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def is_local_database_url(url: str) -> bool:
    """True when the URL can only reach a Postgres on this machine."""
    try:
        parts = urlsplit(url)
        # Either can replace the host named in the rest of the URL.
        params = {k.lower(): v for k, v in parse_qsl(parts.query)}
        netloc_host = unquote(parts.netloc.rpartition("@")[2])
        if "service" in params:
            return False
        hosts = [params[k] for k in ("host", "hostaddr") if k in params]
        if netloc_host and not netloc_host.startswith("/"):
            hosts.append(parts.hostname or "")
            parts.port  # raises on a malformed or multi-host netloc
    except ValueError:
        return False
    if parts.scheme not in ("postgres", "postgresql"):
        return False
    if not hosts and not netloc_host:
        # No host at all: libpq and asyncpg fall back to these, then a socket.
        if os.getenv("PGSERVICE"):
            return False
        hosts = [h for h in (os.getenv("PGHOST"), os.getenv("PGHOSTADDR")) if h]
    return all(h.startswith("/") or h.lower() in _LOCAL_HOSTS for h in hosts)


def remote_database_allowed() -> bool:
    """A remote database is expected on Render, and opt-in anywhere else.

    Render sets RENDER on every service. Any other host sets ALLOW_REMOTE_DB=1.
    """
    return bool(os.getenv("RENDER")) or os.getenv("ALLOW_REMOTE_DB") == "1"


def check_database_target(database_url: str) -> None:
    """Raise unless the database is local or a remote one was opted into."""
    if is_local_database_url(database_url):
        return
    if not remote_database_allowed():
        raise RuntimeError(
            "DATABASE_URL is not a local database. Point it at a local Postgres, "
            "or set ALLOW_REMOTE_DB=1 for this run to use the remote one."
        )
    if not os.getenv("RENDER"):
        logger.warning(
            "WARNING: ALLOW_REMOTE_DB=1 and DATABASE_URL is a remote database. Every "
            "create, edit and delete made through this server changes real data there."
        )

async def get_db_pool() -> asyncpg.Pool:
    """Create database connection pool with retry logic"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    check_database_target(database_url)

    # Log that we have a database URL configured (without exposing the actual value)
    logger.info("DATABASE_URL configured, creating connection pool...")
    
    # Check if using transaction pooler (recommended for serverless/persistent servers)
    if ":6543" in database_url or "transaction" in database_url.lower():
        logger.info("Using Supabase transaction pooler connection (recommended)")
    elif ":5432" in database_url:
        logger.warning("Using direct database connection. For better reliability, consider using transaction pooler (port 6543)")
    
    # Retry logic with exponential backoff
    max_retries = 5  # Increased from 3 to 5
    base_delay = 3  # Increased from 2 to 3 seconds
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting to create database pool (attempt {attempt + 1}/{max_retries})...")
            pool = await asyncpg.create_pool(
                database_url,
                min_size=1,
                max_size=10,
                command_timeout=60,
                timeout=60,  # Increased from 30 to 60 seconds for Render/Supabase connectivity
                statement_cache_size=0,  # Required for Supabase transaction pooler
                server_settings={
                    "application_name": "rushrank_backend",
                    "tcp_keepalives_idle": "600",
                    "tcp_keepalives_interval": "30",
                    "tcp_keepalives_count": "3",
                }
            )
            logger.info("Database pool created successfully")
            return pool
        except (asyncio.TimeoutError, TimeoutError) as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Database connection timeout (attempt {attempt + 1}/{max_retries}). Retrying in {delay}s...")
                logger.warning("If this persists, check: 1) DATABASE_URL is correct, 2) Using transaction pooler (port 6543), 3) Supabase allows connections from Render IPs")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Failed to create database pool after {max_retries} attempts: {e}")
                logger.error("Troubleshooting: Ensure DATABASE_URL uses Supabase transaction pooler (port 6543) and Supabase allows connections from all IPs")
                raise
        except Exception as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Failed to create database pool (attempt {attempt + 1}/{max_retries}): {type(e).__name__}: {str(e)}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Failed to create database pool after {max_retries} attempts: {type(e).__name__}: {str(e)}")
                raise

async def close_db_pool(pool: asyncpg.Pool):
    """Close database connection pool"""
    try:
        await pool.close()
        logger.info("Database pool closed")
    except Exception as e:
        logger.error(f"Error closing database pool: {e}")

class DatabaseManager:
    """Database manager for handling connections"""
    
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
    
    async def execute_query(self, query: str, *args):
        """Execute a query and return results"""
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def execute_one(self, query: str, *args):
        """Execute a query and return single result"""
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    async def execute_command(self, query: str, *args):
        """Execute a command (INSERT, UPDATE, DELETE)"""
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

# Global database manager instance
db_manager: Optional[DatabaseManager] = None

def get_db() -> DatabaseManager:
    """Get database manager instance"""
    global db_manager
    if not db_manager:
        raise RuntimeError("Database not initialized")
    return db_manager

def set_db_manager(pool: asyncpg.Pool):
    """Set global database manager"""
    global db_manager
    db_manager = DatabaseManager(pool)