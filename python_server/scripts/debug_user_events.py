#!/usr/bin/env python3
"""
Debug script to check user membership and events
Usage: python debug_user_events.py <email>
"""
import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv

load_dotenv()

async def debug_user_events(email: str):
    """Debug user membership and events"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        return
    
    conn = await asyncpg.connect(database_url)
    
    try:
        print(f"\n=== Debugging user: {email} ===\n")
        
        # 1. Find user by email
        user = await conn.fetchrow("""
            SELECT id, email, created_at
            FROM users
            WHERE email = $1
        """, email)
        
        if not user:
            print(f"❌ User {email} not found in users table")
            print("\n💡 User might need to be created in Supabase Auth first")
            return
        
        user_id = str(user["id"])
        print(f"✅ Found user: {user['email']} (ID: {user_id})")
        
        # 2. Check memberships
        memberships = await conn.fetch("""
            SELECT m.id, m.chapter_id, m.role, m.created_at, c.name as chapter_name
            FROM memberships m
            JOIN chapters c ON c.id = m.chapter_id
            WHERE m.user_id = $1
        """, user_id)
        
        if not memberships:
            print(f"\n❌ User has NO memberships")
            print("\n💡 User needs to be added to a chapter via invitation or setup_user.py")
            return
        
        print(f"\n✅ User has {len(memberships)} membership(s):")
        for m in memberships:
            chapter_id = str(m["chapter_id"])
            print(f"   - Chapter: {m['chapter_name']} (ID: {chapter_id})")
            print(f"     Role: {m['role']}")
            print(f"     Created: {m['created_at']}")
        
        # 3. Check events for each chapter
        for m in memberships:
            chapter_id = str(m["chapter_id"])
            chapter_name = m["chapter_name"]
            
            print(f"\n--- Events for {chapter_name} (ID: {chapter_id}) ---")
            
            # Count all events (including inactive)
            all_events = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE is_active = false) as inactive
                FROM events
                WHERE chapter_id = $1
            """, chapter_id)
            
            print(f"   Total events: {all_events['total']}")
            print(f"   Active events: {all_events['active']}")
            print(f"   Inactive events: {all_events['inactive']}")
            
            # Get active events with details
            active_events = await conn.fetch("""
                SELECT 
                    id, name, date, location, is_active, created_at,
                    COUNT(DISTINCT ea.pnm_id) as attendee_count
                FROM events e
                LEFT JOIN event_attendance ea ON ea.event_id = e.id
                WHERE e.chapter_id = $1 AND e.is_active = true
                GROUP BY e.id, e.name, e.date, e.location, e.is_active, e.created_at
                ORDER BY e.date
            """, chapter_id)
            
            if active_events:
                print(f"\n   Active events list:")
                for event in active_events:
                    print(f"   - {event['name']} (ID: {event['id']})")
                    print(f"     Date: {event['date']}")
                    print(f"     Location: {event['location'] or 'N/A'}")
                    print(f"     Attendees: {event['attendee_count']}")
            else:
                print(f"\n   ⚠️  No active events found")
        
        # 4. Check what /chapters endpoint would return
        print(f"\n--- What /chapters endpoint returns ---")
        chapters = await conn.fetch("""
            SELECT c.id, c.name, c.domain_allowlist, c.created_at
            FROM chapters c
            JOIN memberships m ON m.chapter_id = c.id
            WHERE m.user_id = $1
        """, user_id)
        
        if chapters:
            print(f"✅ Would return {len(chapters)} chapter(s):")
            for c in chapters:
                print(f"   - {c['name']} (ID: {c['id']})")
        else:
            print("❌ Would return empty array")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_user_events.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(debug_user_events(email))
