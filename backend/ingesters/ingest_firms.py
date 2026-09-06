"""
NASA FIRMS Ingestion Service (REQ-001, DEC-001)
Fetches active fire hotspots via NASA FIRMS API for Punjab/Haryana corridor.
Falls back to static GeoJSON if API key is missing or network fails.
"""

import os
import csv
import math
import io
import json
import logging
from backend.ingesters.memo import cached_snapshot
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from backend.config import demo_enabled

from backend.database import get_db_pool, get_in_memory_store

logger = logging.getLogger("prana.ingest_firms")

# Bbox for Punjab/Haryana -> Delhi corridor
BBOX_STR = "73.5,28.5,77.5,32.5"
STATIC_FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "static" / "firms_fallback.geojson"


@cached_snapshot("firms")
async def fetch_firms_hotspots(client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """
    Fetches VIIRS_SNPP_NRT CSV from NASA FIRMS API or loads static fallback.
    Parses and stores records in database / in-memory store.
    """
    map_key = os.getenv("FIRMS_MAP_KEY")
    records: List[Dict[str, Any]] = []
    source = "NASA_FIRMS_VIIRS_SNPP_NRT"
    fetched_at = datetime.now(timezone.utc).isoformat()

    live_success = False
    if map_key and map_key != "YOUR_FIRMS_MAP_KEY_HERE":
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/VIIRS_SNPP_NRT/{BBOX_STR}/1"
        try:
            should_close = False
            if client is None:
                client = httpx.AsyncClient(timeout=15.0)
                should_close = True

            try:
                resp = await client.get(url)
                if resp.status_code == 200 and not resp.text.startswith("Invalid"):
                    if "latitude" not in (resp.text.splitlines() or [""])[0]:
                        raise ValueError("Invalid FIRMS response schema")
                    records = parse_firms_csv(resp.text)
                    live_success = True
                    logger.info(f"Successfully fetched {len(records)} FIRMS hotspots from live API.")
                else:
                    logger.warning("FIRMS API returned status %s", resp.status_code)
            finally:
                if should_close:
                    await client.aclose()
        except Exception as e:
            logger.warning("FIRMS request failed (%s)", type(e).__name__)

    if not live_success:
        if not demo_enabled():
            raise RuntimeError("Live FIRMS data unavailable; configure FIRMS_MAP_KEY")
        source = "NASA_FIRMS_VIIRS_SNPP_NRT_STATIC_FALLBACK"
        records = load_fallback_records()
        logger.info(f"Loaded {len(records)} FIRMS hotspots from fallback GeoJSON.")

    # Save records to DB or in-memory store
    for record in records:
        record["source"] = source
    await persist_hotspots(records)

    # Format as GeoJSON FeatureCollection
    features = []
    for r in records:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [r["longitude"], r["latitude"]]
            },
            "properties": {
                "frp": r.get("frp"),
                "brightness": r.get("brightness"),
                "confidence": r.get("confidence", "nominal"),
                "acq_datetime": r.get("acq_datetime"),
                "sensor": r.get("sensor", "VIIRS_SNPP")
            }
        })

    return {
        "type": "FeatureCollection",
        "fetched_at": fetched_at,
        "source": source,
        "count": len(features),
        "features": features
    }


def parse_firms_csv(csv_text: str) -> List[Dict[str, Any]]:
    """
    Parses FIRMS CSV output into structured hotspot records.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    records = []
    for row in reader:
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            acq_date = row.get("acq_date", "")
            acq_time = row.get("acq_time", "0000").zfill(4)
            # e.g. 2025-11-04 and 0612 -> 2025-11-04T06:12:00Z
            acq_dt_str = f"{acq_date}T{acq_time[:2]}:{acq_time[2:]}:00Z"

            datetime.fromisoformat(acq_dt_str.replace("Z", "+00:00"))
            frp = float(row["frp"]) if row.get("frp") else None
            brightness = float(row.get("bright_ti4") or row.get("brightness")) if (row.get("bright_ti4") or row.get("brightness")) else None
            confidence = row.get("confidence", "nominal")
            if confidence in ("l", "low"):
                confidence = "low"
            elif confidence in ("h", "high"):
                confidence = "high"
            else:
                confidence = "nominal"

            records.append({
                "latitude": lat,
                "longitude": lon,
                "acq_datetime": acq_dt_str,
                "frp": frp,
                "brightness": brightness,
                "confidence": confidence,
                "sensor": "VIIRS_SNPP"
            })
        except (ValueError, KeyError) as err:
            logger.debug(f"Skipping malformed FIRMS row: {err}")
            continue
    return records


def load_fallback_records() -> List[Dict[str, Any]]:
    """Loads hotspots from static GeoJSON fallback."""
    if not STATIC_FALLBACK_PATH.exists():
        return []
    with open(STATIC_FALLBACK_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    records = []
    for feat in data.get("features", []):
        coords = feat.get("geometry", {}).get("coordinates", [0.0, 0.0])
        props = feat.get("properties", {})
        records.append({
            "longitude": float(coords[0]),
            "latitude": float(coords[1]),
            "acq_datetime": props.get("acq_datetime", datetime.now(timezone.utc).isoformat()),
            "frp": props.get("frp"),
            "brightness": props.get("brightness"),
            "confidence": props.get("confidence", "nominal"),
            "sensor": props.get("sensor", "VIIRS_SNPP")
        })
    return records


async def persist_hotspots(records: List[Dict[str, Any]]):
    """
    Persists hotspots into PostgreSQL fire_hotspots or in-memory store.
    """
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                stmt = """
                INSERT INTO fire_hotspots (acq_datetime, latitude, longitude, frp, brightness, confidence, sensor, source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (acq_datetime, latitude, longitude, sensor) DO UPDATE SET
                frp=EXCLUDED.frp, brightness=EXCLUDED.brightness, confidence=EXCLUDED.confidence, source=EXCLUDED.source
                """
                for r in records:
                    dt = datetime.fromisoformat(r["acq_datetime"].replace("Z", "+00:00"))
                    await conn.execute(
                        stmt,
                        dt,
                        r["latitude"],
                        r["longitude"],
                        r["frp"],
                        r["brightness"],
                        r["confidence"],
                        r["sensor"],
                        r.get("source", "unknown")
                    )
        except Exception:
            raise RuntimeError("Hotspot persistence failed") from None

    # Fallback to in-memory store
    store = get_in_memory_store()
    store["fire_hotspots"] = records
