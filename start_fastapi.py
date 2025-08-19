#!/usr/bin/env python3
"""
Simple script to start FastAPI server for testing
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python_server'))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "python_server.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )