"""
PRANA Database & CPCB AQI Utility
PostgreSQL + PostGIS connection management, DDL definitions for all 7 tables,
and server-side CPCB 24h breakpoint AQI conversion per DEC-010.
"""

import os
import logging
import math
from typing import Optional, Tuple, Dict, Any, List
import asyncpg
from backend.config import production_mode

logger = logging.getLogger("prana.database")

# Global asyncpg connection pool
_pool: Optional[asyncpg.Pool] = None

# In-memory store fallback when PostgreSQL is not connected (local dev / CI testing)
_in_memory_store: Dict[str, List[Dict[str, Any]]] = {
    "fire_hotspots": [],
    "aqi_readings": [],
    "forecast_zones": [],
    "anomaly_flags": [],
    "citizen_reports": [],
    "incidents": [],
    "fl_rounds": [],
    "pollutant_readings": [],
}


# ==============================================================================
# CPCB 24-Hour AQI Breakpoints Conversion (DEC-010)
# ==============================================================================
# Breakpoints:
# 0 - 30 ug/m3   -> AQI 0 - 50    (Good)
# 31 - 60 ug/m3  -> AQI 51 - 100  (Satisfactory)
# 61 - 90 ug/m3  -> AQI 101 - 200 (Moderate)
# 91 - 120 ug/m3 -> AQI 201 - 300 (Poor)
# 121 - 250 ug/m3-> AQI 301 - 400 (Very Poor)
# 251 - 380 ug/m3-> AQI 401 - 500 (Severe)
# > 380 ug/m3    -> AQI > 500     (Hazardous)

PM25_BREAKPOINTS = [
    (0.0, 30.0, 0, 50, "Good", "#00C781"),
    (31.0, 60.0, 51, 100, "Satisfactory", "#92D050"),
    (61.0, 90.0, 101, 200, "Moderate", "#FFFF00"),
    (91.0, 120.0, 201, 300, "Poor", "#FF7800"),
    (121.0, 250.0, 301, 400, "Very Poor", "#FF0000"),
    (251.0, 380.0, 401, 500, "Severe", "#8F3F97"),
]


def compute_cpcb_aqi(pm25_ugm3: float) -> int:
    """
    Computes India AQI index from raw PM2.5 in ug/m3 using CPCB 24h breakpoints.
    Linear interpolation: I = ((I_hi - I_lo) / (C_hi - C_lo)) * (C - C_lo) + I_lo
    """
    if pm25_ugm3 is None or pm25_ugm3 < 0:
        return 0
    if not math.isfinite(pm25_ugm3):
        raise ValueError("PM2.5 must be finite")

    if pm25_ugm3 <= 30.0:
        return round((50.0 / 30.0) * pm25_ugm3)

    for c_lo, c_hi, i_lo, i_hi, _, _ in PM25_BREAKPOINTS:
        if pm25_ugm3 <= c_hi:
            return max(i_lo, round(((i_hi - i_lo) / (c_hi - c_lo)) * (pm25_ugm3 - c_lo) + i_lo))

    # > 380 ug/m3 (Severe/Hazardous extrapolation)
    return 500


def get_aqi_category_and_color(aqi_index: int) -> Tuple[str, str]:
    """
    Returns (category, hex_color) corresponding to calculated AQI index.
    """
    if aqi_index <= 50:
        return "Good", "#00C781"
    elif aqi_index <= 100:
        return "Satisfactory", "#92D050"
    elif aqi_index <= 200:
        return "Moderate", "#FFFF00"
    elif aqi_index <= 300:
        return "Poor", "#FF7800"
    elif aqi_index <= 400:
        return "Very Poor", "#FF0000"
    elif aqi_index <= 500:
        return "Severe", "#8F3F97"
    else:
        return "Severe", "#8F3F97"


# ==============================================================================
# Database Schema Definitions (PostgreSQL + PostGIS)
# ==============================================================================
DDL_STATEMENTS = [
    # PostGIS extension
    "CREATE EXTENSION IF NOT EXISTS postgis;",

    # 1. fire_hotspots
    """
    CREATE TABLE IF NOT EXISTS fire_hotspots (
        id              SERIAL PRIMARY KEY,
        acq_datetime    TIMESTAMPTZ NOT NULL,
        latitude        DOUBLE PRECISION NOT NULL,
        longitude       DOUBLE PRECISION NOT NULL,
        geom            GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_Point(longitude, latitude), 4326)) STORED,
        frp             REAL,
        brightness      REAL,
        confidence      TEXT,
        sensor          TEXT NOT NULL,
        fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_fire_hotspots_geom ON fire_hotspots USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_fire_hotspots_acq_dt ON fire_hotspots (acq_datetime DESC);
    """,

    # 2. aqi_readings
    """
    CREATE TABLE IF NOT EXISTS aqi_readings (
        id              SERIAL PRIMARY KEY,
        station_id      TEXT NOT NULL,
        station_name    TEXT,
        city            TEXT,
        state           TEXT,
        latitude        DOUBLE PRECISION,
        longitude       DOUBLE PRECISION,
        geom            GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_Point(longitude, latitude), 4326)) STORED,
        parameter       TEXT NOT NULL,
        pm25_ugm3       REAL NOT NULL,
        unit            TEXT NOT NULL DEFAULT 'ug/m3',
        measured_at     TIMESTAMPTZ NOT NULL,
        fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aqi_readings_geom ON aqi_readings USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_aqi_readings_station_time ON aqi_readings (station_id, measured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_aqi_readings_time ON aqi_readings (measured_at DESC);
    """,

    # 3. forecast_zones
    """
    CREATE TABLE IF NOT EXISTS forecast_zones (
        id              SERIAL PRIMARY KEY,
        fire_cluster_id TEXT NOT NULL,
        horizon_hours   INTEGER NOT NULL CHECK (horizon_hours IN (24, 48, 72)),
        geom            GEOMETRY(POLYGON, 4326) NOT NULL,
        centroid_lat    DOUBLE PRECISION NOT NULL,
        centroid_lon    DOUBLE PRECISION NOT NULL,
        max_pm25_est    REAL,
        wind_speed_ms   REAL,
        wind_dir_deg    REAL,
        mixing_height_m REAL,
        computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_forecast_zones_geom ON forecast_zones USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_forecast_zones_time ON forecast_zones (computed_at DESC);
    """,

    # 4. anomaly_flags
    """
    CREATE TABLE IF NOT EXISTS anomaly_flags (
        id              SERIAL PRIMARY KEY,
        station_id      TEXT NOT NULL,
        parameter       TEXT NOT NULL,
        day             DATE NOT NULL,
        hour_of_day     SMALLINT NOT NULL,
        is_nighttime    BOOLEAN NOT NULL,
        anomaly_score   REAL NOT NULL,
        is_anomaly      BOOLEAN NOT NULL,
        UNIQUE (station_id, parameter, day, is_nighttime)
    );
    CREATE INDEX IF NOT EXISTS idx_anomaly_flags_day ON anomaly_flags (day DESC);
    CREATE INDEX IF NOT EXISTS idx_anomaly_flags_anomaly_day ON anomaly_flags (is_anomaly, day DESC);
    """,

    # 5. citizen_reports
    """
    CREATE TABLE IF NOT EXISTS citizen_reports (
        id              SERIAL PRIMARY KEY,
        photo_hash      TEXT UNIQUE NOT NULL,
        latitude        DOUBLE PRECISION,
        longitude       DOUBLE PRECISION,
        geom            GEOMETRY(POINT, 4326),
        pm25_estimate   REAL NOT NULL,
        confidence      TEXT NOT NULL,
        submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_citizen_reports_geom ON citizen_reports USING GIST (geom) WHERE geom IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_citizen_reports_time ON citizen_reports (submitted_at DESC);
    """,

    # 6. incidents
    """
    CREATE TABLE IF NOT EXISTS incidents (
        id              SERIAL PRIMARY KEY,
        incident_id     TEXT UNIQUE NOT NULL,
        severity        TEXT NOT NULL,
        location_text   TEXT,
        latitude        DOUBLE PRECISION,
        longitude       DOUBLE PRECISION,
        pollutant       TEXT,
        measured_pm25   REAL,
        measured_aqi    INTEGER,
        satellite_ts    TIMESTAMPTZ,
        satellite_source TEXT,
        authority       TEXT,
        auto_generated  BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity, created_at DESC);
    """,

    # 7. fl_rounds
    """
    CREATE TABLE IF NOT EXISTS fl_rounds (
        id              SERIAL PRIMARY KEY,
        round_number    INTEGER NOT NULL,
        punjab_accuracy REAL NOT NULL,
        delhi_accuracy  REAL NOT NULL,
        global_accuracy REAL NOT NULL,
        run_id          TEXT NOT NULL,
        computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (run_id, round_number)
    );
    CREATE INDEX IF NOT EXISTS idx_fl_rounds_run ON fl_rounds (run_id, round_number);
    """
]


# ==============================================================================
# Connection & Pool Management
# ==============================================================================
MIGRATIONS = [
    "ALTER TABLE anomaly_flags ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown';",
    """CREATE TABLE IF NOT EXISTS pollutant_readings (
        id BIGSERIAL PRIMARY KEY, station_id TEXT NOT NULL, station_name TEXT,
        parameter TEXT NOT NULL CHECK(parameter IN ('no2', 'so2')),
        value DOUBLE PRECISION NOT NULL CHECK(value >= 0), unit TEXT NOT NULL,
        measured_at TIMESTAMPTZ NOT NULL, source TEXT NOT NULL,
        UNIQUE(station_id, parameter, measured_at));
        CREATE INDEX IF NOT EXISTS idx_pollutant_time ON pollutant_readings(parameter, measured_at DESC);""",
    # Preserve existing observations while collapsing duplicate ingestion rows.
    """DELETE FROM fire_hotspots a USING fire_hotspots b
       WHERE a.id < b.id AND a.acq_datetime=b.acq_datetime AND a.latitude=b.latitude
       AND a.longitude=b.longitude AND a.sensor=b.sensor;
       CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_observation
       ON fire_hotspots(acq_datetime, latitude, longitude, sensor);""",
    """DELETE FROM aqi_readings a USING aqi_readings b
       WHERE a.id < b.id AND a.station_id=b.station_id AND a.parameter=b.parameter
       AND a.measured_at=b.measured_at;
       CREATE UNIQUE INDEX IF NOT EXISTS uq_station_observation
       ON aqi_readings(station_id, parameter, measured_at);""",
    "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS satellite_evidence JSONB;",
    "ALTER TABLE fire_hotspots ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown';",
    "ALTER TABLE aqi_readings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown';",
]


async def init_db() -> bool:
    """
    Initializes database pool and creates tables if PostgreSQL is accessible.
    Returns True if connected to PostgreSQL, False if using in-memory store.
    """
    global _pool
    if _pool is not None:
        return True
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        if production_mode():
            raise RuntimeError("DATABASE_URL is required in production")
        logger.info("No DATABASE_URL configured; running in in-memory mode.")
        return False

    # Standardize url for asyncpg if prefixed with postgresql+asyncpg:// or postgres://
    cleaned_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")

    candidate = None
    try:
        candidate = await asyncpg.create_pool(dsn=cleaned_url, min_size=1, max_size=10, timeout=5.0, command_timeout=30.0)
        async with candidate.acquire() as conn:
            async with conn.transaction():
                for stmt in DDL_STATEMENTS:
                    await conn.execute(stmt)
                for stmt in MIGRATIONS:
                    await conn.execute(stmt)
        _pool = candidate
        logger.info("PostgreSQL + PostGIS connected and tables initialized.")
        return True
    except Exception as e:
        if candidate is not None:
            await candidate.close()
        _pool = None
        logger.error("PostgreSQL initialization failed (%s)", type(e).__name__)
        raise RuntimeError("Configured PostgreSQL/PostGIS is unavailable or schema initialization failed") from None


async def close_db():
    """Closes database pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed.")


def get_db_pool() -> Optional[asyncpg.Pool]:
    """Returns the active database pool or None."""
    return _pool


def get_in_memory_store() -> Dict[str, List[Dict[str, Any]]]:
    """Returns the in-memory fallback store."""
    return _in_memory_store
