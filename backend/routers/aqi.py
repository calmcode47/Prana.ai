"""
AQI Ground Stations & Surface Grid Router (REQ-003, REQ-005, DEC-010)
Serves OGC SensorThings-compatible ground station readings (carrying both pm25_ugm3 and aqi_index)
and continuous PM2.5 surface grid.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Query

from backend.models import StationsResponse, SurfaceGridResponse
from backend.ingesters.ingest_openaq import fetch_openaq_stations
from backend.database import get_db_pool, get_in_memory_store, compute_cpcb_aqi

logger = logging.getLogger("prana.routers.aqi")

router = APIRouter(prefix="/api/v1/aqi", tags=["Air Quality"])

SURFACE_FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "static" / "surface_grid_fallback.geojson"


@router.get("/stations", response_model=StationsResponse)
async def get_aqi_stations(
    parameter: str = Query("pm25", pattern="^(pm25|pm10|no2|so2)$"),
    state: Optional[str] = Query(None, description="Filter by state (Delhi, Punjab, Haryana)")
):
    """
    Returns latest ground station readings in OGC SensorThings format.
    Every observation includes BOTH pm25_ugm3 and aqi_index (India CPCB scale).
    """
    readings = []
    pool = get_db_pool()

    if pool:
        try:
            async with pool.acquire() as conn:
                query = """
                SELECT DISTINCT ON (station_id)
                    station_id, station_name, city, state, latitude, longitude, pm25_ugm3, measured_at
                FROM aqi_readings
                WHERE parameter = $1
                ORDER BY station_id, measured_at DESC
                LIMIT 200;
                """
                rows = await conn.fetch(query, parameter)
                for r in rows:
                    if state and r["state"] and state.lower() not in r["state"].lower():
                        continue
                    pm25_val = float(r["pm25_ugm3"])
                    readings.append({
                        "station_id": r["station_id"],
                        "name": r["station_name"] or r["station_id"],
                        "latitude": r["latitude"],
                        "longitude": r["longitude"],
                        "pm25_ugm3": pm25_val,
                        "aqi_index": compute_cpcb_aqi(pm25_val),
                        "measured_at": r["measured_at"].isoformat()
                    })
        except Exception as ex:
            logger.warning(f"Error querying aqi_readings: {ex}")

    if not readings:
        raw = await fetch_openaq_stations()
        for r in raw:
            if state and r.get("state") and state.lower() not in r["state"].lower():
                continue
            pm25_val = float(r["pm25_ugm3"])
            readings.append({
                "station_id": r["station_id"],
                "name": r.get("name", r["station_id"]),
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "pm25_ugm3": pm25_val,
                "aqi_index": r.get("aqi_index", compute_cpcb_aqi(pm25_val)),
                "measured_at": r.get("measured_at", datetime.now(timezone.utc).isoformat())
            })

    # Assemble OGC SensorThings structure
    value = []
    for r in readings:
        value.append({
            "@iot.id": r["station_id"],
            "name": r["name"],
            "Locations": [{
                "location": {
                    "type": "Point",
                    "coordinates": [r["longitude"], r["latitude"]]
                }
            }],
            "Datastreams": [{
                "name": "PM2.5",
                "Observations": [{
                    "pm25_ugm3": r["pm25_ugm3"],
                    "aqi_index": r["aqi_index"],
                    "phenomenonTime": r["measured_at"],
                    "resultQuality": "good"
                }]
            }]
        })

    return {
        "@iot.count": len(value),
        "value": value
    }


@router.get("/surface", response_model=SurfaceGridResponse)
async def get_aqi_surface(resolution_deg: float = Query(0.5, ge=0.1, le=1.0)):
    """
    Returns continuous PM2.5 surface grid produced by Gaussian Process Downscaler (REQ-005).
    Fuses ground CPCB readings with satellite TROPOMI AAI.
    """
    try:
        from backend.ml.downscaler import run_downscaler
        return await run_downscaler(resolution_deg=resolution_deg)
    except Exception as ex:
        logger.warning(f"Error running GP downscaler ({ex}); falling back to static surface grid.")
        if SURFACE_FALLBACK_PATH.exists():
            with open(SURFACE_FALLBACK_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "type": "FeatureCollection",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "resolution_deg": resolution_deg,
            "features": []
        }
