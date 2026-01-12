"""
RushRank FastAPI Server with Supabase Authentication
"""
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncpg
import httpx
import os
from typing import Optional, Dict, Any
import logging
from contextlib import asynccontextmanager
from pathlib import Path
import time

from .auth import get_current_user, verify_token
from .database import get_db_pool, close_db_pool, set_db_manager
from .routes import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global database pool
db_pool: Optional[asyncpg.Pool] = None

def _load_env_from_files():
    """
    Lightweight .env loader without external deps.
    Loads key=value pairs from root .env or backend/.env if present, without overriding existing env.
    """
    potential_paths = []
    # Repo root relative to this file
    this_dir = Path(__file__).resolve().parent
    repo_root = this_dir.parent
    potential_paths.append(repo_root / ".env")
    potential_paths.append(repo_root / "backend" / ".env")
    for env_path in potential_paths:
        try:
            if env_path.exists():
                with env_path.open("r") as f:
                    for line in f:
                        stripped = line.strip()
                        if not stripped or stripped.startswith("#") or "=" not in stripped:
                            continue
                        key, value = stripped.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip("'").strip('"')
                        if key and key not in os.environ:
                            os.environ[key] = value
        except Exception as e:
            logger.warning(f"Could not read env file {env_path}: {e}")

_load_env_from_files()

# Debug: confirm DATABASE_URL is set after loading
import os as _os_check
logger.info(f"[ENV DEBUG] DATABASE_URL present: {bool(_os_check.getenv('DATABASE_URL'))}, first 40 chars: {(_os_check.getenv('DATABASE_URL') or '')[:40]}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global db_pool
    
    # Startup
    logger.info("Starting RushRank FastAPI server...")
    db_pool = await get_db_pool()
    set_db_manager(db_pool)
    logger.info("Database pool created")
    
    yield
    
    # Shutdown
    if db_pool:
        await close_db_pool(db_pool)
    logger.info("RushRank server shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="RushRank API",
    description="Digital rush voting platform with Supabase authentication",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "RushRank API v2.0 - Powered by FastAPI + Supabase"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    global db_pool
    
    health_status = {
        "status": "healthy",
        "database": "connected" if db_pool else "disconnected",
        "supabase_configured": bool(os.getenv("SUPABASE_URL")),
    }
    
    if not db_pool:
        health_status["status"] = "unhealthy"
        
    return health_status

@app.get("/health/db")
async def health_db():
    """Verify DB connectivity by running SELECT 1."""
    global db_pool
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool not initialized")
    try:
        async with db_pool.acquire() as conn:
            val = await conn.fetchval("SELECT 1;")
        return {"ok": True, "result": int(val)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

@app.get("/health/storage")
async def health_storage():
    """
    Verify Supabase Storage access using service role by:
    - Listing buckets and confirming 'pnm-photos' exists
    - Attempting to create a signed upload URL (best-effort)
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    try:
        from supabase import create_client
        client = create_client(supabase_url, service_key)

        # Check bucket existence
        buckets = client.storage.list_buckets()
        bucket_exists = any((b.get("name") == "pnm-photos") for b in buckets or [])

        signed_upload_supported = True
        signed_upload_ok = False
        signed_upload_error = None
        upload_path = f"healthcheck/{int(time.time())}.txt"
        try:
            # Not all client versions may support this method.
            # If unsupported, this will raise.
            res = client.storage.from_("pnm-photos").create_signed_upload_url(upload_path)
            signed_upload_ok = bool(res)
        except Exception as e:
            signed_upload_supported = False
            signed_upload_error = str(e)

        return {
            "ok": True,
            "bucket_exists": bucket_exists,
            "signed_upload_supported": signed_upload_supported,
            "signed_upload_ok": signed_upload_ok,
            "signed_upload_error": signed_upload_error,
            "path": upload_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        reload=True,
        log_level="info"
    )