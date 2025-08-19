#!/usr/bin/env python3
"""
Start FastAPI server with proper environment
"""
import os
import uvicorn

# Set up environment variables
if __name__ == "__main__":
    print("🚀 Starting RushRank FastAPI Server...")
    
    # Start the server
    uvicorn.run(
        "python_server.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        access_log=True
    )