#!/usr/bin/env python3
"""
Test FastAPI setup and endpoints
"""
import os
import sys
import asyncio
from httpx import AsyncClient

# Add python_server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python_server'))

async def test_fastapi():
    """Test FastAPI server endpoints"""
    print("🚀 Testing RushRank FastAPI Server...")
    
    try:
        # Test imports
        from main import app
        print("✅ FastAPI imports successful")
        
        # Test basic endpoints with test client
        from fastapi.testclient import TestClient
        client = TestClient(app)
        
        # Test root endpoint
        response = client.get("/")
        print(f"✅ Root endpoint: {response.status_code} - {response.json()}")
        
        # Test health endpoint
        response = client.get("/health") 
        print(f"✅ Health endpoint: {response.status_code} - {response.json()}")
        
        # Test API health endpoint
        response = client.get("/api/health")
        print(f"✅ API health endpoint: {response.status_code} - {response.json()}")
        
        print("\n🎯 FastAPI server is ready!")
        print("📝 To start the server, run: cd python_server && python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing FastAPI: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_fastapi())
    sys.exit(0 if success else 1)