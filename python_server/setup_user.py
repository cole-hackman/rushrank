#!/usr/bin/env python3
"""
Setup user with chapter and membership for RushRank
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

async def setup_user():
    """Setup user with chapter and membership"""
    user_email = "colehackman@icloud.com"
    user_id = "92de1e98-fda7-4af5-adf8-e9f67d2d2746"
    
    print(f"🔧 Setting up user: {user_email} ({user_id})...")
    
    try:
        from database import get_db_pool, DatabaseManager
        
        pool = await get_db_pool()
        db = DatabaseManager(pool)
        
        # 1. Create/update user record
        user_query = """
            INSERT INTO users (id, email, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
            RETURNING id, email
        """
        
        user = await db.execute_one(user_query, user_id, user_email)
        print(f"✅ User record: {user['email']} ({user['id']})")
        
        # 2. Check if user already has a chapter membership
        existing_membership_query = """
            SELECT m.id, m.chapter_id, m.role, c.name as chapter_name
            FROM memberships m
            JOIN chapters c ON c.id = m.chapter_id
            WHERE m.user_id = $1
            LIMIT 1
        """
        
        existing = await db.execute_one(existing_membership_query, user_id)
        
        if existing:
            print(f"✅ User already has membership in chapter: {existing['chapter_name']} ({existing['chapter_id']})")
            print(f"   Role: {existing['role']}")
            chapter_id = existing['chapter_id']
        else:
            # 3. Get or create a default chapter
            chapter_query = """
                SELECT id, name FROM chapters
                ORDER BY created_at
                LIMIT 1
            """
            
            chapter = await db.execute_one(chapter_query)
            
            if not chapter:
                # Create a default chapter
                chapter_id = str(uuid.uuid4())
                create_chapter_query = """
                    INSERT INTO chapters (id, name, domain_allowlist, created_at)
                    VALUES ($1, $2, $3, NOW())
                    RETURNING id, name
                """
                chapter = await db.execute_one(
                    create_chapter_query,
                    chapter_id,
                    "Beta Chapter",
                    ["icloud.com"]
                )
                print(f"✅ Created chapter: {chapter['name']} ({chapter['id']})")
            else:
                chapter_id = chapter['id']
                print(f"✅ Using existing chapter: {chapter['name']} ({chapter['id']})")
            
            # 4. Create membership (admin role)
            membership_query = """
                INSERT INTO memberships (user_id, chapter_id, role, created_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, chapter_id) DO UPDATE SET role = EXCLUDED.role
                RETURNING id, role
            """
            
            membership = await db.execute_one(membership_query, user_id, chapter_id, "admin")
            print(f"✅ Created membership: role={membership['role']}")
        
        # 5. Verify setup
        verify_query = """
            SELECT 
                u.id as user_id,
                u.email,
                c.id as chapter_id,
                c.name as chapter_name,
                m.role
            FROM users u
            JOIN memberships m ON m.user_id = u.id
            JOIN chapters c ON c.id = m.chapter_id
            WHERE u.id = $1
        """
        
        result = await db.execute_one(verify_query, user_id)
        
        if result:
            print(f"\n✅ Setup complete!")
            print(f"   User: {result['email']}")
            print(f"   Chapter: {result['chapter_name']} ({result['chapter_id']})")
            print(f"   Role: {result['role']}")
        else:
            print("❌ Verification failed - membership not found")
        
        await pool.close()
        return True
        
    except Exception as e:
        print(f"❌ Error setting up user: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(setup_user())
    sys.exit(0 if success else 1)

