"""
RushRank FastAPI Server with Supabase Authentication
"""
from fastapi import FastAPI, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncpg
import httpx
import os
from typing import Optional, Dict, Any
import logging
import json
from contextlib import asynccontextmanager
from pathlib import Path
import time
from datetime import datetime

from .auth import get_current_user, verify_token
from .database import get_db_pool, close_db_pool, set_db_manager
from .routes import router
from .exceptions import AppException, register_exception_handlers
from .rate_limit import setup_rate_limiting
from .websocket import manager as ws_manager

# Configure structured JSON logging for production
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

# Use JSON logging in production, standard in development
log_format = os.getenv("LOG_FORMAT", "text")
if log_format == "json":
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
else:
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

# Confirm environment is configured (without exposing sensitive values)
logger.debug(f"Environment configured: DATABASE_URL={'present' if os.getenv('DATABASE_URL') else 'missing'}")

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

# Allowed CORS origins (from environment variable or defaults)
_default_origins = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
# Normalize origins: strip whitespace, remove trailing slashes, filter out invalid URLs
_raw_origins = os.getenv("ALLOWED_ORIGINS", _default_origins)
ALLOWED_ORIGINS = [
    origin.strip().rstrip('/')  # Remove trailing slashes
    for origin in _raw_origins.split(",")
    if origin.strip() and not origin.strip().startswith('https://vercel.com')  # Filter out invalid Vercel project URLs
]

# Add middleware to normalize paths (remove double slashes)
# This must be added BEFORE CORS middleware
@app.middleware("http")
async def normalize_path_middleware(request: Request, call_next):
    """Normalize request paths by removing double slashes"""
    original_path = request.url.path
    if "//" in original_path:
        # Replace multiple consecutive slashes with single slash
        normalized_path = "/" + "/".join(part for part in original_path.split("/") if part)
        # Update the request scope
        request.scope["path"] = normalized_path
        request.scope["raw_path"] = normalized_path.encode()
        logger.debug(f"Normalized path: {original_path} -> {normalized_path}")
    response = await call_next(request)
    return response

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Setup rate limiting
setup_rate_limiting(app)

# Register custom exception handlers
register_exception_handlers(app)

# Global exception handler to ensure CORS headers on unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers are set even on unhandled errors"""
    from fastapi.responses import JSONResponse
    from fastapi import status
    
    # Don't handle HTTPException - let FastAPI handle it (it already has CORS)
    if isinstance(exc, HTTPException):
        raise exc
    
    # Log the error
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Validate origin against allowed origins (security fix)
    request_origin = request.headers.get("origin", "")
    origin = request_origin if request_origin in ALLOWED_ORIGINS else "http://localhost:3000"
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc) if str(exc) else "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Include API routes with versioning
# /api/v1 is the canonical path, /api is kept for backwards compatibility
app.include_router(router, prefix="/api/v1")
app.include_router(router, prefix="/api")  # Backwards compatibility

# Explicit OPTIONS handler for CORS preflight (catches any path)
@app.options("/{full_path:path}")
async def options_handler(full_path: str, request: Request):
    """Handle CORS preflight OPTIONS requests"""
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
        from fastapi.responses import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600",
            }
        )
    from fastapi.responses import Response
    return Response(status_code=403)

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

@app.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time session updates.
    
    Client connects to /ws/session/{session_id} and receives:
    - pnm_advance: When chair advances to next PNM
    - lock_change: When session is locked/unlocked
    - vote_cast: When a vote is cast (with updated tallies)
    - session_ended: When the session ends
    """
    await ws_manager.connect(websocket, session_id)
    try:
        while True:
            # Keep connection alive, waiting for messages
            # We don't expect messages from client, but need to handle them
            data = await websocket.receive_text()
            # Client can send ping messages to keep connection alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        await ws_manager.disconnect(websocket, session_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
        log_level="info"
    )