#!/usr/bin/env python3
"""
Create demo data for testing RushRank
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

async def create_demo_data():
    """Create demo chapter, users, and PNMs for testing"""
    print("🏗️  Creating demo data for RushRank...")
    
    try:
        from database import get_db_pool, DatabaseManager
        
        pool = await get_db_pool()
        db = DatabaseManager(pool)
        
        # Create demo chapter
        chapter_id = str(uuid.uuid4())
        chapter_query = """
            INSERT INTO chapters (id, name, domain_allowlist)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
            RETURNING id, name
        """
        
        chapter = await db.execute_one(
            chapter_query, 
            chapter_id, 
            "Alpha Beta Demo", 
            ["university.edu", "demo.com"]
        )
        
        if chapter:
            print(f"✅ Created chapter: {chapter['name']} ({chapter['id']})")
        else:
            print("📝 Chapter already exists")
        
        # Create demo user (this would normally be created by Supabase Auth)
        user_id = str(uuid.uuid4())
        user_query = """
            INSERT INTO users (id, email)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            RETURNING id, email
        """
        
        user = await db.execute_one(user_query, user_id, "demo@university.edu")
        
        if user:
            print(f"✅ Created user: {user['email']} ({user['id']})")
        else:
            print("📝 User already exists")
        
        # Create membership
        membership_query = """
            INSERT INTO memberships (user_id, chapter_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        """
        
        await db.execute_command(membership_query, user_id, chapter_id, "admin")
        print(f"✅ Created admin membership for user")
        
        # Create demo PNMs
        pnms_data = [
            ("John Smith", "Computer Science", "Dallas, TX", "sophomore", ["athlete", "funny"]),
            ("Mike Johnson", "Business", "Austin, TX", "freshman", ["legacy", "outgoing"]),
            ("David Wilson", "Engineering", "Houston, TX", "junior", ["smart", "quiet"]),
        ]
        
        pnm_query = """
            INSERT INTO pnms (chapter_id, name, major, hometown, year, tags)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING
            RETURNING id, name
        """
        
        for name, major, hometown, year, tags in pnms_data:
            pnm = await db.execute_one(pnm_query, chapter_id, name, major, hometown, year, tags)
            if pnm:
                print(f"✅ Created PNM: {pnm['name']} ({pnm['id']})")
        
        # Create demo event
        event_query = """
            INSERT INTO events (chapter_id, name, description, date, type, location)
            VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', $4, $5)
            ON CONFLICT DO NOTHING
            RETURNING id, name
        """
        
        event = await db.execute_one(
            event_query,
            chapter_id,
            "Demo Rush Mixer",
            "Meet the brothers and learn about our chapter",
            "optional",
            "Chapter House"
        )
        
        if event:
            print(f"✅ Created event: {event['name']} ({event['id']})")
        
        await pool.close()
        
        print(f"\n🎯 Demo data created successfully!")
        print(f"Chapter ID: {chapter_id}")
        print(f"User ID: {user_id}")
        print(f"Email: demo@university.edu")
        print("\n📝 Use these IDs for testing API endpoints")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating demo data: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(create_demo_data())
    sys.exit(0 if success else 1)