#!/usr/bin/env python3
"""
Test the FastAPI endpoints with proper authentication
"""
import asyncio
import os
import sys
import json
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

async def test_endpoints():
    """Test all FastAPI endpoints"""
    print("🔧 Testing RushRank FastAPI Endpoints...")
    
    try:
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        
        # Test public endpoints (no auth required)
        print("\n📋 Testing Public Endpoints:")
        
        # Root endpoint
        response = client.get("/")
        print(f"GET / → {response.status_code}: {response.json()}")
        
        # Health endpoints
        response = client.get("/health")
        print(f"GET /health → {response.status_code}: {response.json()}")
        
        response = client.get("/api/health")
        print(f"GET /api/health → {response.status_code}: {response.json()}")
        
        # Test protected endpoints (should return 401 without auth)
        print("\n🔒 Testing Protected Endpoints (No Auth - Should Return 401):")
        
        response = client.get("/api/me")
        print(f"GET /api/me → {response.status_code}: {response.json() if response.status_code != 422 else 'Missing Authorization'}")
        
        response = client.get("/api/pnms", params={"chapter_id": "test-chapter"})
        print(f"GET /api/pnms → {response.status_code}: {response.json() if response.status_code != 422 else 'Missing Authorization'}")
        
        response = client.get("/api/chapters")
        print(f"GET /api/chapters → {response.status_code}: {response.json() if response.status_code != 422 else 'Missing Authorization'}")
        
        print("\n✅ All endpoint tests completed!")
        print("\n📝 To test with authentication:")
        print("1. Create a Supabase user via magic link")
        print("2. Get the JWT token from Supabase")
        print("3. Include in requests: Authorization: Bearer <token>")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing endpoints: {e}")
        import traceback
        traceback.print_exc()
        return False

async def generate_curl_examples():
    """Generate curl examples for testing"""
    print("\n📋 Curl Examples for Testing:")
    
    base_url = "http://localhost:5000"
    
    print("\n🌐 Public Endpoints:")
    print(f'curl -X GET "{base_url}/" -H "accept: application/json"')
    print(f'curl -X GET "{base_url}/health" -H "accept: application/json"')
    print(f'curl -X GET "{base_url}/api/health" -H "accept: application/json"')
    
    print("\n🔐 Protected Endpoints (Replace YOUR_JWT_TOKEN):")
    print(f'curl -X GET "{base_url}/api/me" \\')
    print('  -H "accept: application/json" \\')
    print('  -H "Authorization: Bearer YOUR_JWT_TOKEN"')
    
    print(f'\ncurl -X GET "{base_url}/api/chapters" \\')
    print('  -H "accept: application/json" \\')
    print('  -H "Authorization: Bearer YOUR_JWT_TOKEN"')
    
    print(f'\ncurl -X GET "{base_url}/api/pnms?chapter_id=YOUR_CHAPTER_ID" \\')
    print('  -H "accept: application/json" \\')
    print('  -H "Authorization: Bearer YOUR_JWT_TOKEN"')
    
    print(f'\ncurl -X POST "{base_url}/api/rounds/ROUND_ID/votes" \\')
    print('  -H "accept: application/json" \\')
    print('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\')
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{"pnm_id": "PNM_ID", "score": 8, "is_favorite": false}\'')

if __name__ == "__main__":
    # Run endpoint tests
    success = asyncio.run(test_endpoints())
    
    # Generate curl examples
    asyncio.run(generate_curl_examples())
    
    sys.exit(0 if success else 1)