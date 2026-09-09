"""
PRANA — Pollution Risk & Atmospheric Network Alert System
Main FastAPI Application Entrypoint (SESSION-001)
"""

import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from backend.database import init_db, close_db, get_db_pool, local_persistence_enabled
from backend.scheduler import start_scheduler, stop_scheduler
from backend.models import HealthResponse
from backend.config import demo_enabled, production_mode, scheduler_enabled
from backend.middleware import UploadLimitMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.tts import AUDIO_DIR

from backend.routers import (
    hotspots,
    aqi,
    forecast,
    anomalies,
    alerts,
    citizen,
    federated,
    sensorthings,
    websocket,
    legal,
    industrial,
    operations,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("prana.main")


class SecretFilter(logging.Filter):
    def filter(self, record):
        import re
        message = record.getMessage()
        message = re.sub(r"(/api/area/csv/)[^/\s]+", r"\1[REDACTED]", message)
        for key in ("FIRMS_MAP_KEY", "OPENAQ_API_KEY", "DATABASE_URL"):
            secret = os.getenv(key)
            if secret:
                message = message.replace(secret, "[REDACTED]")
        record.msg, record.args = message, ()
        return True


for name in ("httpx", "httpcore"):
    logging.getLogger(name).addFilter(SecretFilter())
for handler in logging.getLogger().handlers:
    handler.addFilter(SecretFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown procedures."""
    logger.info("Starting PRANA Backend Engine...")

    # Initialize database tables
    db_connected = await init_db()
    if db_connected:
        logger.info("Database initialized successfully.")
    else:
        logger.info("Running with durable local store fallback.")

    # Start background scheduler for 15-minute ingestion
    try:
        if production_mode() and (not os.getenv("CORS_ORIGINS") or not allowed_origins or "*" in allowed_origins):
            raise RuntimeError("Production requires explicit CORS_ORIGINS")
        if scheduler_enabled():
            start_scheduler()
        yield
    finally:
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
app.add_middleware(UploadLimitMiddleware)

# CORS Policy Configuration (SEC-004)
# Origins strictly loaded from environment variable, never hardcoded
cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8000,http://localhost:8081,"
    "http://localhost:19006,http://127.0.0.1:5173,http://127.0.0.1:8000,"
    "http://127.0.0.1:8081,http://127.0.0.1:19006",
)
allowed_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "X-CEMS-Key", "Authorization"],
)

# Provider-generated briefing files. No uploaded citizen imagery is written here.
app.mount("/media/briefings", StaticFiles(directory=str(AUDIO_DIR)), name="briefing-audio")

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
app.include_router(legal.router)
app.include_router(industrial.router)
app.include_router(operations.router)


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
    db_status = "connected" if pool else "local-persistent" if local_persistence_enabled() else "in-memory"
    return {
        "status": "ok",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/ready", tags=["General"])
async def readiness():
    """Probe the actual database, distinct from process liveness."""
    pool = get_db_pool()
    ready = not production_mode() and not os.getenv("DATABASE_URL")
    db_status = "local-persistent" if local_persistence_enabled() else "in-memory"
    if pool:
        try:
            async with pool.acquire(timeout=3) as conn:
                ready = await conn.fetchval("SELECT 1", timeout=3) == 1
            db_status = "connected"
        except Exception:
            ready = False
            db_status = "unavailable"
    return JSONResponse({"status": "ready" if ready else "unavailable", "db": db_status,
                         "demo_mode": demo_enabled()}, status_code=200 if ready else 503)
