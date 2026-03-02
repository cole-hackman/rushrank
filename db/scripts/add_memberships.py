#!/usr/bin/env python3
"""
Add multiple users to Beta Theta Pi Cal Poly chapter.
Run this script from the project root.
"""
import asyncio
import os
import asyncpg

async def add_memberships():
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres.xzlgutaygqaoasfmznen:cysQu4-nuhjij-caxdyk@aws-1-us-east-2.pooler.supabase.com:5432/postgres")
    
    # Users to add
    emails = [
        'colehackman@icloud.com',
        'mattabiz23@gmail.com',
        'multilogin1@rushrank.me',
        'multilogin2@rushrank.me',
        'multilogin3@rushrank.me',
    ]
    
    conn = await asyncpg.connect(database_url)
    
    try:
        # Find or create the chapter
        chapter = await conn.fetchrow(
            "SELECT id, name FROM chapters WHERE name ILIKE '%beta%' OR name ILIKE '%cal poly%' LIMIT 1"
        )
        
        if not chapter:
            print("❌ No Beta Theta Pi / Cal Poly chapter found!")
            print("   Creating one now...")
            chapter = await conn.fetchrow(
                """
                INSERT INTO chapters (name, domain_allowlist)
                VALUES ('Beta Theta Pi - Cal Poly', ARRAY['{}'])
                RETURNING id, name
                """.format('rushrank.me')
            )
            print(f"✅ Created chapter: {chapter['name']} (ID: {chapter['id']})")
        else:
            print(f"✅ Found chapter: {chapter['name']} (ID: {chapter['id']})")
        
        chapter_id = chapter['id']
        
        # Get all users
        users = await conn.fetch(
            "SELECT id, email FROM auth.users WHERE email = ANY($1::text[])",
            emails
        )
        
        found_emails = {u['email'] for u in users}
        missing_emails = set(emails) - found_emails
        
        if missing_emails:
            print(f"⚠️  Users not found in auth.users: {missing_emails}")
            print("   These users need to sign up first.")
        
        # Add memberships for found users
        added_count = 0
        for user in users:
            user_id = user['id']
            email = user['email']
            
            # Check if membership already exists
            existing = await conn.fetchrow(
                "SELECT id FROM memberships WHERE user_id = $1 AND chapter_id = $2",
                user_id, chapter_id
            )
            
            if existing:
                print(f"ℹ️  {email} - already a member")
            else:
                # Add membership (first user as admin, rest as members)
                role = 'admin' if email == 'colehackman@icloud.com' else 'member'
                await conn.execute(
                    """
                    INSERT INTO memberships (user_id, chapter_id, role)
                    VALUES ($1, $2, $3)
                    """,
                    user_id, chapter_id, role
                )
                print(f"✅ Added {email} as {role}")
                added_count += 1
        
        print(f"\n🎉 Done! Added {added_count} new membership(s).")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(add_memberships())
