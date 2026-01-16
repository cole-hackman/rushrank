"""
Database connection and utilities for FastAPI + Supabase
"""
import asyncpg
import os
from typing import Optional
import logging
import asyncio

logger = logging.getLogger(__name__)

async def get_db_pool() -> asyncpg.Pool:
    """Create database connection pool with retry logic"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    
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