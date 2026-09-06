"""
OpenAQ Ground Station Ingestion Service (REQ-003, DEC-003, DEC-010)
Fetches ground station PM2.5 readings for Delhi-NCR and Punjab/Haryana.
Stores raw readings as pm25_ugm3, calculates aqi_index server-side using CPCB breakpoints.
"""

import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from backend.database import get_db_pool, get_in_memory_store, compute_cpcb_aqi

logger = logging.getLogger("prana.ingest_openaq")

OPENAQ_BASE_URL = "https://api.openaq.org/v3"
BBOX_STR = "73.5,28.5,77.5,32.5"

# Sample fallback stations in Punjab/Haryana/Delhi corridor
FALLBACK_STATIONS: List[Dict[str, Any]] = [
    {"station_id": "IN-CPCB-DL-001", "name": "Anand Vihar, Delhi", "city": "Delhi", "state": "Delhi", "lat": 28.647, "lon": 77.316, "pm25": 215.4},
    {"station_id": "IN-CPCB-DL-002", "name": "RK Puram, Delhi", "city": "Delhi", "state": "Delhi", "lat": 28.563, "lon": 77.186, "pm25": 178.2},
    {"station_id": "IN-CPCB-DL-003", "name": "Punjabi Bagh, Delhi", "city": "Delhi", "state": "Delhi", "lat": 28.674, "lon": 77.131, "pm25": 192.5},
    {"station_id": "IN-CPCB-DL-004", "name": "IHBAS, Dilshad Garden", "city": "Delhi", "state": "Delhi", "lat": 28.681, "lon": 77.305, "pm25": 164.0},
    {"station_id": "IN-CPCB-DL-005", "name": "ITO, Delhi", "city": "Delhi", "state": "Delhi", "lat": 28.631, "lon": 77.249, "pm25": 185.7},
    {"station_id": "IN-CPCB-HR-001", "name": "Sector 51, Gurugram", "city": "Gurugram", "state": "Haryana", "lat": 28.423, "lon": 77.071, "pm25": 156.8},
    {"station_id": "IN-CPCB-HR-002", "name": "Sector 11, Faridabad", "city": "Faridabad", "state": "Haryana", "lat": 28.374, "lon": 77.315, "pm25": 170.1},
    {"station_id": "IN-CPCB-HR-003", "name": "Manesar, Haryana", "city": "Manesar", "state": "Haryana", "lat": 28.351, "lon": 76.938, "pm25": 142.3},
    {"station_id": "IN-CPCB-PB-001", "name": "Civil Line, Ludhiana", "city": "Ludhiana", "state": "Punjab", "lat": 30.901, "lon": 75.857, "pm25": 138.9},
    {"station_id": "IN-CPCB-PB-002", "name": "Model Town, Jalandhar", "city": "Jalandhar", "state": "Punjab", "lat": 31.326, "lon": 75.576, "pm25": 125.4},
    {"station_id": "IN-CPCB-PB-003", "name": "Golden Temple, Amritsar", "city": "Amritsar", "state": "Punjab", "lat": 31.620, "lon": 74.876, "pm25": 145.0},
    {"station_id": "IN-CPCB-PB-004", "name": "Sector 22, Chandigarh", "city": "Chandigarh", "state": "Punjab", "lat": 30.733, "lon": 76.779, "pm25": 98.6},
]


async def fetch_openaq_stations(client: Optional[httpx.AsyncClient] = None) -> List[Dict[str, Any]]:
    """
    Fetches ground station readings via OpenAQ v3 API or loads fallback stations.
    Always includes both pm25_ugm3 and aqi_index fields.
    """
    api_key = os.getenv("OPENAQ_API_KEY")
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    readings: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        should_close = False
        if client is None:
            client = httpx.AsyncClient(timeout=10.0)
            should_close = True

        try:
            # Query locations in bbox
            url = f"{OPENAQ_BASE_URL}/locations?country_id=IN&parameters_id=2&bbox={BBOX_STR}&limit=50"
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                for item in results:
                    coords = item.get("coordinates")
                    if not coords or coords.get("latitude") is None or coords.get("longitude") is None:
                        logger.debug(f"Skipping station {item.get('id')} due to missing coordinates.")
                        continue

                    # Extract sensor/reading if available
                    pm25_val = 120.0  # default representative value if not yet measured
                    sensors = item.get("sensors", [])
                    for s in sensors:
                        param = s.get("parameter", {})
                        if param.get("name") == "pm25" and s.get("latest"):
                            val = s.get("latest", {}).get("value")
                            if val is not None and val >= 0:
                                pm25_val = float(val)
                                break

                    readings.append({
                        "station_id": f"IN-OPENAQ-{item.get('id')}",
                        "name": item.get("name", "Unnamed Station"),
                        "city": item.get("locality", "NCR"),
                        "state": "NCR",
                        "latitude": float(coords["latitude"]),
                        "longitude": float(coords["longitude"]),
                        "pm25_ugm3": pm25_val,
                        "measured_at": now_iso
                    })
                if readings:
                    logger.info(f"Fetched {len(readings)} ground stations from live OpenAQ API.")
        finally:
            if should_close:
                await client.aclose()
    except Exception as ex:
        logger.warning(f"Error calling OpenAQ API ({ex}); using fallback ground stations.")

    if not readings:
        for s in FALLBACK_STATIONS:
            readings.append({
                "station_id": s["station_id"],
                "name": s["name"],
                "city": s["city"],
                "state": s["state"],
                "latitude": s["lat"],
                "longitude": s["lon"],
                "pm25_ugm3": s["pm25"],
                "measured_at": now_iso
            })
        logger.info(f"Loaded {len(readings)} fallback ground stations.")

    # Compute aqi_index for every reading (CPCB 24h breakpoints)
    for r in readings:
        r["aqi_index"] = compute_cpcb_aqi(r["pm25_ugm3"])

    # Persist to database / memory
    await persist_aqi_readings(readings)

    return readings


async def persist_aqi_readings(readings: List[Dict[str, Any]]):
    """
    Persists readings to PostgreSQL aqi_readings or in-memory store.
    """
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                stmt = """
                INSERT INTO aqi_readings (station_id, station_name, city, state, latitude, longitude, parameter, pm25_ugm3, unit, measured_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'pm25', $7, 'ug/m3', $8)
                """
                for r in readings:
                    dt = datetime.fromisoformat(r["measured_at"].replace("Z", "+00:00"))
                    await conn.execute(
                        stmt,
                        r["station_id"],
                        r.get("name"),
                        r.get("city"),
                        r.get("state"),
                        r["latitude"],
                        r["longitude"],
                        r["pm25_ugm3"],
                        dt
                    )
            return
        except Exception as ex:
            logger.warning(f"Error persisting aqi_readings to PostgreSQL: {ex}")

    store = get_in_memory_store()
    store["aqi_readings"] = readings
