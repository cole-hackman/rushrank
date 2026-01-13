#!/usr/bin/env python3
"""
Script to run FastAPI server for RushRank
"""
import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "python_server.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )