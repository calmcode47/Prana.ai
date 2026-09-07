from backend.config import demo_enabled
"""
Hotspots Router (REQ-001)
Serves active fire hotspots in the Punjab/Haryana bbox from NASA FIRMS.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from backend.models import HotspotsResponse
from backend.ingesters.ingest_firms import fetch_firms_hotspots
from backend.database import get_db_pool, get_in_memory_store

logger = logging.getLogger("prana.routers.hotspots")

router = APIRouter(prefix="/api/v1", tags=["Hotspots"])

CONFIDENCE_ORDER = {"low": 1, "nominal": 2, "high": 3}


@router.get("/hotspots", response_model=HotspotsResponse)
async def get_hotspots(
    hours_back: int = Query(24, ge=1, le=72, description="Hours back to query"),
    min_confidence: str = Query("nominal", pattern="^(low|nominal|high)$", description="Minimum confidence filter")
):
    """
    Returns active fire hotspots in Punjab/Haryana corridor from NASA FIRMS.
    """
    min_conf_level = CONFIDENCE_ORDER.get(min_confidence.lower(), 2)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)

    features = []
    source = "NASA_FIRMS_VIIRS_SNPP_NRT"
    fetched_at = datetime.now(timezone.utc).isoformat()

    pool = get_db_pool()
    if pool:
        source = "POSTGIS_OBSERVATIONS"
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT latitude, longitude, frp, brightness, confidence, sensor, acq_datetime, source
                    FROM fire_hotspots
                    WHERE acq_datetime >= $1 AND ($2::boolean OR source = 'NASA_FIRMS_VIIRS_SNPP_NRT')
                    ORDER BY acq_datetime DESC
                    LIMIT 500
                    """,
                    cutoff, demo_enabled()
                )
                for r in rows:
                    source = r["source"]
                    conf = r["confidence"] or "nominal"
                    if CONFIDENCE_ORDER.get(conf.lower(), 2) >= min_conf_level:
                        features.append({
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [r["longitude"], r["latitude"]]
                            },
                            "properties": {
                                "frp": r["frp"],
                                "brightness": r["brightness"],
                                "confidence": conf,
                                "acq_datetime": r["acq_datetime"].isoformat(),
                                "sensor": r["sensor"]
                            }
                        })
        except Exception as ex:
            raise HTTPException(503, "Hotspot storage unavailable") from None

    # Fallback to in-memory store or ingestion fetch
    if pool is None:
        try:
            data = await fetch_firms_hotspots()
        except Exception:
            raise HTTPException(503, "Hotspot data unavailable") from None
        source = data.get("source", source)
        raw_features = data.get("features", [])
        for f in raw_features:
            props = f.get("properties", {})
            observed = datetime.fromisoformat(props["acq_datetime"].replace("Z", "+00:00"))
            if observed < cutoff:
                continue
            conf = props.get("confidence", "nominal")
            if CONFIDENCE_ORDER.get(conf.lower(), 2) >= min_conf_level:
                features.append(f)

    return {
        "type": "FeatureCollection",
        "fetched_at": fetched_at,
        "source": source,
        "count": len(features),
        "features": features
    }
