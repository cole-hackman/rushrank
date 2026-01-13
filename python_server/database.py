"""
Database connection and utilities for FastAPI + Supabase
"""
import asyncpg
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

async def get_db_pool() -> asyncpg.Pool:
    """Create database connection pool"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    
    # Log that we have a database URL configured (without exposing the actual value)
    logger.debug("DATABASE_URL configured, creating connection pool...")
    
    try:
        pool = await asyncpg.create_pool(
            database_url,
            min_size=1,
            max_size=10,
            command_timeout=60
        )
        logger.info("Database pool created successfully")
        return pool
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")
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