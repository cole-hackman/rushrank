#!/usr/bin/env python3
"""
Start RushRank FastAPI server
"""
import os
import sys
import uvicorn

# Add python_server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python_server'))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0", 
        port=port,
        reload=True,
        log_level="info"
    )