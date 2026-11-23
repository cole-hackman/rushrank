"""The legacy schema fixture only runs in the integration tests' own databases."""

import asyncpg
import pytest

from .conftest import LEGACY_SCHEMA, _require_test_db, _split_statements

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_the_file_checks_the_database_before_anything_else():
    """Runs the first two statements only, on a database that is not rr_it_*."""
    statements = _split_statements(LEGACY_SCHEMA.read_text())
    assert statements[0] == "BEGIN"
    assert statements[1].startswith("DO $$")
    assert statements[-1] == "COMMIT"

    conn = await asyncpg.connect(_require_test_db())
    try:
        await conn.execute(statements[0])
        with pytest.raises(asyncpg.RaiseError, match="rr_it_"):
            await conn.execute(statements[1])
        # A client that ignores the error is in a failed transaction: the server
        # rejects everything else in the file.
        with pytest.raises(asyncpg.InFailedSQLTransactionError):
            await conn.execute("SELECT 1")
    finally:
        await conn.close()
