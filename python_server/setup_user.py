#!/usr/bin/env python3
"""
Setup user with chapter and membership for RushRank using Supabase client
"""
import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def setup_user():
    """Setup user with chapter and membership using Supabase client"""
    from supabase import create_client
    
    user_email = "colehackman@icloud.com"
    chapter_name = "Beta Theta Pi - Cal Poly"
    
    print(f"🔧 Setting up user: {user_email}")
    print(f"🔧 Target chapter: {chapter_name}")
    
    # Initialize Supabase client with service role key for admin access
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    print(f"✅ Supabase URL: {supabase_url}")
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # 1. Find user by email in public users table
        user_response = supabase.table("users").select("*").eq("email", user_email).execute()
        
        if not user_response.data:
            print(f"❌ User with email {user_email} not found in users table")
            
            # Check auth.users table
            auth_users = supabase.auth.admin.list_users()
            auth_user = None
            for u in auth_users:
                if u.email == user_email:
                    auth_user = u
                    break
            
            if auth_user:
                print(f"✅ Found user in auth.users: {auth_user.id}")
                # Create the public users record
                user_insert = supabase.table("users").upsert({
                    "id": str(auth_user.id),
                    "email": user_email
                }).execute()
                user = {"id": str(auth_user.id), "email": user_email}
                print(f"✅ Created user record: {user['email']} ({user['id']})")
            else:
                print(f"❌ User not found in auth.users either. They need to sign up first.")
                return False
        else:
            user = user_response.data[0]
            print(f"✅ Found user: {user['email']} ({user['id']})")
        
        user_id = str(user['id'])
        
        # 2. Check if target chapter exists
        chapter_response = supabase.table("chapters").select("*").eq("name", chapter_name).execute()
        
        if not chapter_response.data:
            # Create the chapter
            chapter_id = str(uuid.uuid4())
            chapter_insert = supabase.table("chapters").insert({
                "id": chapter_id,
                "name": chapter_name,
                "domain_allowlist": ["icloud.com", "calpoly.edu"]
            }).execute()
            chapter = chapter_insert.data[0] if chapter_insert.data else {"id": chapter_id, "name": chapter_name}
            print(f"✅ Created chapter: {chapter['name']} ({chapter['id']})")
        else:
            chapter = chapter_response.data[0]
            print(f"✅ Found existing chapter: {chapter['name']} ({chapter['id']})")
        
        chapter_id = str(chapter['id'])
        
        # 3. Check existing memberships for this user
        existing_response = supabase.table("memberships").select("*, chapters(name)").eq("user_id", user_id).execute()
        
        if existing_response.data:
            print(f"📋 Current memberships for user:")
            for m in existing_response.data:
                chapter_name_display = m.get('chapters', {}).get('name', 'Unknown') if m.get('chapters') else 'Unknown'
                print(f"   - {chapter_name_display} (role: {m['role']})")
        
        # 4. Create/update membership for target chapter (admin role)
        membership_response = supabase.table("memberships").upsert({
            "user_id": user_id,
            "chapter_id": chapter_id,
            "role": "admin"
        }, on_conflict="user_id,chapter_id").execute()
        
        if membership_response.data:
            print(f"✅ Created/updated membership: role=admin")
        else:
            print(f"⚠️ Membership upsert returned no data")
        
        # 5. Verify setup
        verify_response = supabase.table("memberships").select("*, users(email), chapters(name)").eq("user_id", user_id).eq("chapter_id", chapter_id).execute()
        
        if verify_response.data:
            result = verify_response.data[0]
            print(f"\n✅ Setup complete!")
            print(f"   User: {result.get('users', {}).get('email', user_email)}")
            print(f"   Chapter: {result.get('chapters', {}).get('name', chapter_name)} ({chapter_id})")
            print(f"   Role: {result['role']}")
        else:
            print("❌ Verification failed - membership not found")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up user: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = setup_user()
    sys.exit(0 if success else 1)
