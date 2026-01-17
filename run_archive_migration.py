#!/usr/bin/env python3
"""
Setup script for archive functionality
Runs database migration to add archived column to pnms table
"""
import os
import asyncio
import asyncpg
import sys
from pathlib import Path

def _load_env_from_files():
    """Load environment variables from .env files"""
    potential_paths = []
    this_dir = Path(__file__).resolve().parent
    potential_paths.append(this_dir / ".env")
    potential_paths.append(this_dir / "backend" / ".env")
    for env_path in potential_paths:
        try:
            if env_path.exists():
                with env_path.open("r") as f:
                    for line in f:
                        stripped = line.strip()
                        if not stripped or stripped.startswith("#") or "=" not in stripped:
                            continue
                        key, value = stripped.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip("'").strip('"')
                        if key and key not in os.environ:
                            os.environ[key] = value
        except Exception as e:
            print(f"Warning: Could not read env file {env_path}: {e}")

# Load environment variables
_load_env_from_files()

async def run_migration():
    """Run the database migration to add archived column"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set in environment")
        print("   Please set DATABASE_URL in your .env file or environment")
        return False
    
    migration_file = Path(__file__).parent / "supabase" / "migrations" / "0008_add_archived_to_pnms.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    try:
        print("📝 Running database migration...")
        conn = await asyncpg.connect(database_url)
        
        migration_sql = migration_file.read_text()
        await conn.execute(migration_sql)
        await conn.close()
        
        print("✅ Database migration completed successfully")
        print("   The archived column has been added to the pnms table")
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

async def verify_setup():
    """Verify the setup is correct"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set")
        return False
    
    try:
        conn = await asyncpg.connect(database_url)
        
        # Check if archived column exists
        result = await conn.fetchrow("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'pnms' AND column_name = 'archived'
            ) as exists
        """)
        
        await conn.close()
        
        if result and result['exists']:
            print("✅ Verified: archived column exists in pnms table")
            return True
        else:
            print("❌ Verified: archived column does NOT exist in pnms table")
            return False
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

async def main():
    print("=" * 60)
    print("Archive Migration Setup")
    print("=" * 60)
    print()
    
    # Run migration
    success = await run_migration()
    
    if success:
        print()
        # Verify
        await verify_setup()
        print()
        print("=" * 60)
        print("✅ Setup complete! Archive feature is now available.")
        print("=" * 60)
    else:
        print()
        print("=" * 60)
        print("❌ Setup failed. Please check the error above.")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
