"""
Pytest fixtures for RushRank tests.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncpg


@pytest.fixture
def mock_db_pool():
    """Create a mock database pool for testing."""
    pool = AsyncMock(spec=asyncpg.Pool)
    
    # Setup common query patterns
    pool.fetchrow = AsyncMock(return_value=None)
    pool.fetch = AsyncMock(return_value=[])
    pool.execute = AsyncMock(return_value="OK")
    pool.fetchval = AsyncMock(return_value=None)
    
    return pool


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "name": "Test User",
    }


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user."""
    return {
        "id": "admin-123",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin",
    }


@pytest.fixture
def mock_chapter():
    """Create a mock chapter."""
    return {
        "id": "chapter-123",
        "name": "Test Chapter",
        "university": "Test University",
    }


@pytest.fixture
def mock_pnm():
    """Create a mock PNM."""
    return {
        "id": "pnm-123",
        "name": "Test PNM",
        "chapter_id": "chapter-123",
        "major": "Computer Science",
        "hometown": "Test City",
        "year": "Sophomore",
        "email": "pnm@example.com",
    }


@pytest.fixture
def mock_round():
    """Create a mock voting round."""
    return {
        "id": "round-123",
        "chapter_id": "chapter-123",
        "status": "ACTIVE",
        "name": "Test Round",
    }


@pytest.fixture
def mock_vote():
    """Create a mock vote."""
    return {
        "id": "vote-123",
        "round_id": "round-123",
        "pnm_id": "pnm-123",
        "user_id": "user-123",
        "choice": "YES",
        "favorite": False,
    }
