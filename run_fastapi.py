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
        # This machine only. Render needs every interface; elsewhere, for example
        # to test from a phone, set BIND_HOST=0.0.0.0.
        host=os.getenv("BIND_HOST") or ("0.0.0.0" if os.getenv("RENDER") else "127.0.0.1"),
        port=port,
        reload=True,
        log_level="info"
    )