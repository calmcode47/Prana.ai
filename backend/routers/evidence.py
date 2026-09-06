"""Attach available satellite observations without manufacturing evidence."""
import json
from datetime import datetime, timezone, timedelta
from backend.database import get_db_pool, get_in_memory_store
from backend.ml.downscaler import haversine_km


async def satellite_evidence(latitude, longitude):
    if latitude is None or longitude is None:
        return None, None, None
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            fires = [dict(r) for r in await conn.fetch("""SELECT latitude,longitude,acq_datetime,source
                FROM fire_hotspots WHERE acq_datetime >= $1 AND source='NASA_FIRMS_VIIRS_SNPP_NRT'""", cutoff)]
    else:
        fires = get_in_memory_store()["fire_hotspots"]
    observed = []
    for fire in fires:
        if fire.get("source") != "NASA_FIRMS_VIIRS_SNPP_NRT":
            continue
        stamp = fire["acq_datetime"]
        if isinstance(stamp, str):
            stamp = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if stamp < cutoff:
            continue
        observed.append((haversine_km(longitude, latitude, fire["longitude"], fire["latitude"]), stamp))
    if not observed:
        return None, None, None
    nearby = [f for f in observed if f[0] <= 50]
    return ({"fire_count_50km": len(nearby), "nearest_fire_km": round(min(f[0] for f in observed), 2),
             "tropomi_aai": None}, max(f[1] for f in observed).isoformat(), "FIRMS")
