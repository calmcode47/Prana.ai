"""
OpenAQ Ground Station Ingestion Service (REQ-003, DEC-003, DEC-010)
Fetches ground station PM2.5 readings for Delhi-NCR and Punjab/Haryana.
Stores raw readings as pm25_ugm3, calculates aqi_index server-side using CPCB breakpoints.
"""

import os
import math
from backend.config import demo_enabled
import json
import logging
from backend.ingesters.memo import cached_snapshot
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


@cached_snapshot("openaq")
async def fetch_openaq_stations(client: Optional[httpx.AsyncClient] = None) -> List[Dict[str, Any]]:
    """Join location metadata with actual sensor observations from OpenAQ v3."""
    api_key = os.getenv("OPENAQ_API_KEY")
    headers = {"X-API-Key": api_key} if api_key else {}
    readings = []
    live_success = False
    pollutant_readings = []
    if api_key or client is not None:
        owned = client is None
        client = client or httpx.AsyncClient(timeout=10.0)
        try:
            response = await client.get(f"{OPENAQ_BASE_URL}/locations",
                params={"parameters_id": 2, "bbox": BBOX_STR, "limit": 100}, headers=headers)
            response.raise_for_status()
            locations = response.json()["results"]
            for item in locations:
                coords = item.get("coordinates") or {}
                if coords.get("latitude") is None or coords.get("longitude") is None:
                    continue
                sensors = {s["id"] for s in item.get("sensors", [])
                           if s.get("parameter", {}).get("name") == "pm25"}
                if not sensors:
                    continue
                latest = await client.get(f"{OPENAQ_BASE_URL}/locations/{item['id']}/latest", headers=headers)
                latest.raise_for_status()
                sensor_map = {s["id"]: s.get("parameter", {}) for s in item.get("sensors", [])}
                valid = []
                for obs in latest.json()["results"]:
                    value = obs.get("value")
                    stamp = (obs.get("datetime") or {}).get("utc")
                    if value is None or not math.isfinite(float(value)) or float(value) < 0 or not stamp:
                        continue
                    dt = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        continue
                    pollutant = sensor_map.get(obs.get("sensorsId"), {})
                    if pollutant.get("name") in ("no2", "so2"):
                        pollutant_readings.append({"station_id": f"IN-OPENAQ-{item['id']}",
                            "station_name": item.get("name"), "parameter": pollutant["name"],
                            "value": float(value), "unit": pollutant.get("units", "unknown"),
                            "measured_at": dt.isoformat(), "source": "OPENAQ_LIVE"})
                    if obs.get("sensorsId") in sensors:
                        valid.append((dt, float(value)))
                if not valid:
                    continue
                measured_at, value = max(valid, key=lambda row: row[0])
                locality = item.get("locality") or ""
                name = item.get("name") or "Unnamed Station"
                label = (locality + " " + name).lower()
                state = next((state for state in ("Delhi", "Punjab", "Haryana") if state.lower() in label), "NCR")
                if state == "NCR":
                    if any(word in label for word in ("gurugram", "gurgaon", "faridabad", "manesar", "panipat", "sonipat", "hspcb")):
                        state = "Haryana"
                    elif any(word in label for word in ("ludhiana", "amritsar", "jalandhar", "patiala", "ppcb")):
                        state = "Punjab"
                    elif "dpcc" in label:
                        state = "Delhi"
                readings.append({"station_id": f"IN-OPENAQ-{item['id']}", "name": name,
                    "city": locality, "state": state, "latitude": float(coords["latitude"]),
                    "longitude": float(coords["longitude"]), "pm25_ugm3": value,
                    "measured_at": measured_at.isoformat(), "source": "OPENAQ_LIVE", "parameter": "pm25"})
            live_success = True
        except Exception as exc:
            logger.warning("OpenAQ ingestion failed (%s)", type(exc).__name__)
            readings = []
            pollutant_readings = []
        finally:
            if owned:
                await client.aclose()
    if not live_success:
        if not demo_enabled():
            raise RuntimeError("Live OpenAQ data unavailable; configure OPENAQ_API_KEY")
        readings = [{"station_id": s["station_id"], "name": s["name"], "city": s["city"],
            "state": s["state"], "latitude": s["lat"], "longitude": s["lon"], "pm25_ugm3": s["pm25"],
            "measured_at": "2025-11-04T08:00:00+00:00", "source": "DEMO_STATIC", "parameter": "pm25"}
            for s in FALLBACK_STATIONS]
    for r in readings:
        r["aqi_index"] = compute_cpcb_aqi(r["pm25_ugm3"])
    await persist_aqi_readings(readings)
    await persist_pollutants(pollutant_readings)
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
                INSERT INTO aqi_readings (station_id, station_name, city, state, latitude, longitude, parameter, pm25_ugm3, unit, measured_at, source)
                VALUES ($1, $2, $3, $4, $5, $6, 'pm25', $7, 'ug/m3', $8, $9)
                ON CONFLICT (station_id, parameter, measured_at) DO UPDATE SET
                pm25_ugm3=EXCLUDED.pm25_ugm3, source=EXCLUDED.source
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
                        dt,
                        r.get("source", "unknown")
                    )
        except Exception:
            raise RuntimeError("AQI persistence failed") from None

    store = get_in_memory_store()
    store["aqi_readings"] = readings


async def persist_pollutants(readings):
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.executemany("""INSERT INTO pollutant_readings
                (station_id,station_name,parameter,value,unit,measured_at,source)
                VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(station_id,parameter,measured_at)
                DO UPDATE SET value=EXCLUDED.value""",
                [(r["station_id"],r.get("station_name"),r["parameter"],r["value"],r["unit"],
                  datetime.fromisoformat(r["measured_at"]),r["source"]) for r in readings])
    store = get_in_memory_store()["pollutant_readings"]
    keyed = {(r["station_id"],r["parameter"],r["measured_at"]):r for r in store}
    keyed.update({(r["station_id"],r["parameter"],r["measured_at"]):r for r in readings})
    store[:] = list(keyed.values())[-100000:]
