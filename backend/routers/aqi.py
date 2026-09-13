from backend.config import demo_enabled
"""
AQI Ground Stations & Surface Grid Router (REQ-003, REQ-005, DEC-010)
Serves OGC SensorThings-compatible ground station readings (carrying both pm25_ugm3 and aqi_index)
and continuous PM2.5 surface grid.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from backend.models import StationsResponse, SurfaceGridResponse
from backend.ingesters.ingest_openaq import fetch_openaq_stations
from backend.database import get_db_pool, get_in_memory_store, compute_cpcb_aqi

logger = logging.getLogger("prana.routers.aqi")

router = APIRouter(prefix="/api/v1/aqi", tags=["Air Quality"])

SURFACE_FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "static" / "surface_grid_fallback.geojson"


@router.get("/stations", response_model=StationsResponse)
async def get_aqi_stations(
    parameter: str = Query("pm25", pattern="^pm25$"),
    state: Optional[str] = Query(None, description="Filter by state (Delhi, Punjab, Haryana)")
):
    """
    Returns latest ground station readings in OGC SensorThings format.
    Every observation includes BOTH pm25_ugm3 and aqi_index (India CPCB scale).
    """
    readings = []
    freshness_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    future_cutoff = datetime.now(timezone.utc) + timedelta(minutes=15)
    pool = get_db_pool()

    if pool:
        try:
            async with pool.acquire() as conn:
                query = """
                SELECT DISTINCT ON (station_id)
                    station_id, station_name, city, state, latitude, longitude, pm25_ugm3, measured_at, source
                FROM aqi_readings
                WHERE parameter = $1 AND ($2::boolean OR source = 'OPENAQ_LIVE')
                  AND measured_at >= $3 AND measured_at <= $4
                ORDER BY station_id, measured_at DESC
                LIMIT 200;
                """
                rows = await conn.fetch(query, parameter, demo_enabled(), freshness_cutoff, future_cutoff)
                for r in rows:
                    if state:
                        st_val = (r["state"] or "").lower()
                        if state.lower() not in st_val:
                            continue
                    pm25_val = float(r["pm25_ugm3"])
                    readings.append({
                        "station_id": r["station_id"],
                        "name": r["station_name"] or r["station_id"],
                        "latitude": r["latitude"],
                        "longitude": r["longitude"],
                        "pm25_ugm3": pm25_val,
                        "aqi_index": compute_cpcb_aqi(pm25_val),
                        "source": r["source"],
                        "measured_at": r["measured_at"].isoformat()
                    })
        except Exception as ex:
            raise HTTPException(503, "Station storage unavailable") from None

    if pool is None:
        raw = [
            row for row in get_in_memory_store()["aqi_readings"]
            if row.get("parameter", "pm25") == parameter
            and (demo_enabled() or row.get("source") == "OPENAQ_LIVE")
            and _is_fresh(row.get("measured_at"), freshness_cutoff)
        ]
        if not raw:
            try:
                raw = await fetch_openaq_stations(force_refresh=True)
            except Exception:
                raise HTTPException(503, "Station data unavailable") from None
        if not demo_enabled():
            raw = [r for r in raw if _is_fresh(r.get("measured_at"), freshness_cutoff)]
            if not raw:
                raise HTTPException(503, "Station data unavailable")
        for r in raw:
            if state:
                st_val = (r.get("state") or "").lower()
                if state.lower() not in st_val:
                    continue
            pm25_val = float(r["pm25_ugm3"])
            readings.append({
                "station_id": r["station_id"],
                "name": r.get("name") or r.get("station_name") or r["station_id"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "pm25_ugm3": pm25_val,
                "aqi_index": r.get("aqi_index", compute_cpcb_aqi(pm25_val)),
                "source": r.get("source", "unknown"),
                "measured_at": r.get("measured_at")
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
                    "source": r.get("source", "unknown"),
                    "resultQuality": "demonstration" if "DEMO" in r.get("source", "") else "provider-reported"
                }]
            }]
        })

    return {
        "@iot.count": len(value),
        "value": value
    }


def _is_fresh(value, cutoff: datetime) -> bool:
    """Return true only for parseable, timezone-aware recent observations."""
    if isinstance(value, datetime):
        measured = value
    elif isinstance(value, str):
        try:
            measured = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return False
    else:
        return False
    if measured.tzinfo is None:
        return False
    return cutoff <= measured <= datetime.now(timezone.utc) + timedelta(minutes=15)


@router.get("/surface", response_model=SurfaceGridResponse)
async def get_aqi_surface(resolution_deg: float = Query(0.5, ge=0.1, le=1.0)):
    """
    Returns continuous PM2.5 surface grid produced by Gaussian Process Downscaler (REQ-005).
    Fuses ground readings with Open-Meteo CAMS global aerosol optical depth.
    """
    if resolution_deg not in {0.1, 0.25, 0.5, 1.0}:
        raise HTTPException(422, "resolution_deg must be one of 0.1, 0.25, 0.5, or 1.0")
    try:
        from backend.ml.downscaler import run_downscaler
        return await run_downscaler(resolution_deg=resolution_deg)
    except Exception as ex:
        from backend.config import demo_enabled
        if not demo_enabled():
            raise HTTPException(503, "Surface data unavailable") from None
        logger.warning("Surface calculation failed (%s)", type(ex).__name__)
        if SURFACE_FALLBACK_PATH.exists():
            with open(SURFACE_FALLBACK_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["source"] = "DEMO_STATIC"
                return data
        return {
            "type": "FeatureCollection",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "resolution_deg": resolution_deg,
            "features": []
        }
