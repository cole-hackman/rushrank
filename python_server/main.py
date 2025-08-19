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

from auth import get_current_user, verify_token
from database import get_db_pool, close_db_pool, set_db_manager
from routes import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global database pool
db_pool: Optional[asyncpg.Pool] = None

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        reload=True,
        log_level="info"
    )