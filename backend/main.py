"""
PRANA — Pollution Risk & Atmospheric Network Alert System
Main FastAPI Application Entrypoint (SESSION-001)
"""

import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from backend.database import init_db, close_db, get_db_pool
from backend.scheduler import start_scheduler, stop_scheduler
from backend.models import HealthResponse

from backend.routers import (
    hotspots,
    aqi,
    forecast,
    anomalies,
    alerts,
    citizen,
    federated,
    sensorthings,
    websocket
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("prana.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown procedures."""
    logger.info("Starting PRANA Backend Engine...")

    # Initialize database tables
    db_connected = await init_db()
    if db_connected:
        logger.info("Database initialized successfully.")
    else:
        logger.info("Running with in-memory store fallback.")

    # Start background scheduler for 15-minute ingestion
    start_scheduler()

    yield

    logger.info("Shutting down PRANA Backend Engine...")
    stop_scheduler()
    await close_db()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="PRANA — Hyperlocal Air Quality & Federated Alert System",
    description="Backend API serving Punjab/Haryana Stubble Burning → Delhi NCR Winter Smog Corridor",
    version="1.0.0",
    lifespan=lifespan
)

# Rate Limiter setup (SEC-005)
app.state.limiter = citizen.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Policy Configuration (SEC-004)
# Origins strictly loaded from environment variable, never hardcoded
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000")
allowed_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],
)

# Mount all Routers
app.include_router(hotspots.router)
app.include_router(aqi.router)
app.include_router(forecast.router)
app.include_router(anomalies.router)
app.include_router(alerts.router)
app.include_router(citizen.router)
app.include_router(federated.router)
app.include_router(sensorthings.router)
app.include_router(websocket.router)


@app.get("/", tags=["General"])
async def root():
    """Root endpoint describing system status."""
    return {
        "app": "PRANA Air Quality API",
        "corridor": "Punjab/Haryana -> Delhi-NCR",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["General"])
async def health():
    """Health check endpoint."""
    pool = get_db_pool()
    db_status = "connected" if pool else "in-memory"
    return {
        "status": "ok",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
