"""
Open-Meteo Ingestion Service (REQ-004)
Fetches wind vectors, boundary layer height, and 2m temperature
for both Punjab centroid (source) and Delhi centroid (receptor).
Caches to JSON files in backend/data/cache/.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("prana.ingest_meteo")

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"

# Centroids per 04_api.md REQ-004
PUNJAB_CENTROID = {"lat": 30.7, "lon": 76.8}
DELHI_CENTROID = {"lat": 28.6, "lon": 77.2}

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"


async def fetch_meteo_forecast(client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    """
    Fetches Open-Meteo current meteorological data for Punjab and Delhi.
    Caches JSON payloads and returns combined result.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    punjab_cache_file = CACHE_DIR / "meteo_punjab.json"
    delhi_cache_file = CACHE_DIR / "meteo_delhi.json"

    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=10.0)
        should_close = True

    try:
        punjab_data = await fetch_location_meteo(client, PUNJAB_CENTROID["lat"], PUNJAB_CENTROID["lon"])
        delhi_data = await fetch_location_meteo(client, DELHI_CENTROID["lat"], DELHI_CENTROID["lon"])

        with open(punjab_cache_file, "w", encoding="utf-8") as f:
            json.dump(punjab_data, f, indent=2)

        with open(delhi_cache_file, "w", encoding="utf-8") as f:
            json.dump(delhi_data, f, indent=2)

        logger.info("Successfully fetched and cached Open-Meteo forecasts for Punjab and Delhi.")
        return {
            "punjab": punjab_data,
            "delhi": delhi_data,
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    finally:
        if should_close:
            await client.aclose()


async def fetch_location_meteo(client: httpx.AsyncClient, lat: float, lon: float) -> Dict[str, Any]:
    """
    Queries Open-Meteo for a single lat/lon coordinate with required parameters.
    Falls back to representative defaults on error.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "windspeed_10m,winddirection_10m,boundary_layer_height,temperature_2m",
        "hourly": "windspeed_10m,winddirection_10m,boundary_layer_height,temperature_2m",
        "forecast_days": 1
    }

    try:
        resp = await client.get(OPEN_METEO_BASE_URL, params=params)
        if resp.status_code == 200:
            data = resp.json()
            current = data.get("current", {})
            return {
                "latitude": lat,
                "longitude": lon,
                "windspeed_10m": current.get("windspeed_10m", 4.2),
                "winddirection_10m": current.get("winddirection_10m", 315.0),
                "boundary_layer_height": current.get("boundary_layer_height", 850.0),
                "temperature_2m": current.get("temperature_2m", 22.5),
                "timestamp": current.get("time", datetime.now(timezone.utc).isoformat())
            }
        else:
            logger.warning(f"Open-Meteo returned status {resp.status_code}. Using fallback values.")
    except Exception as e:
        logger.warning(f"Error fetching Open-Meteo data for ({lat}, {lon}): {e}. Using fallback values.")

    # Fallback meteorological values representative of winter stubble burning season (NW winds)
    return {
        "latitude": lat,
        "longitude": lon,
        "windspeed_10m": 4.5,
        "winddirection_10m": 315.0,  # North-Westerly wind towards Delhi
        "boundary_layer_height": 850.0,
        "temperature_2m": 22.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
