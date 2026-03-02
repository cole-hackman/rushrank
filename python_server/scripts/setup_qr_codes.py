#!/usr/bin/env python3
"""
Setup script for QR code functionality
Runs database migration and verifies setup
"""
import os
import asyncio
import asyncpg
import sys
from pathlib import Path

async def run_migration():
    """Run the database migration to add qr_code_url column"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set in environment")
        return False
    
    migration_file = Path(__file__).parent / "supabase" / "migrations" / "0003_add_qr_code_url.sql"
    
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
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

async def verify_setup():
    """Verify the setup is correct"""
    print("\n🔍 Verifying setup...")
    
    checks = {
        "DATABASE_URL": os.getenv("DATABASE_URL"),
        "MAILERLITE_API_KEY": os.getenv("MAILERLITE_API_KEY"),
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    }
    
    all_good = True
    for key, value in checks.items():
        if value:
            print(f"  ✅ {key} is set")
        else:
            print(f"  ⚠️  {key} is not set")
            if key in ["DATABASE_URL", "MAILERLITE_API_KEY"]:
                all_good = False
    
    # Check if column exists
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        try:
            conn = await asyncpg.connect(database_url)
            result = await conn.fetchval("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'pnms' AND column_name = 'qr_code_url'
            """)
            await conn.close()
            
            if result:
                print("  ✅ qr_code_url column exists in pnms table")
            else:
                print("  ⚠️  qr_code_url column not found - migration may not have run")
                all_good = False
        except Exception as e:
            print(f"  ⚠️  Could not verify column: {e}")
    
    return all_good

async def main():
    print("🚀 QR Code Setup Script\n")
    
    # Run migration
    migration_success = await run_migration()
    
    # Verify setup
    setup_ok = await verify_setup()
    
    print("\n" + "="*50)
    if migration_success and setup_ok:
        print("✅ Setup complete! Next steps:")
        print("  1. Set up storage bucket (see SETUP_QR_CODES.md)")
        print("  2. Configure Mailerlite (see MAILERLITE_SETUP.md)")
        print("  3. Test by creating a PNM")
    else:
        print("⚠️  Setup incomplete. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

