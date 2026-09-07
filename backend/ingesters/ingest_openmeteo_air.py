"""Keyless CAMS air-quality ingestion through Open-Meteo."""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from backend.config import demo_enabled
from backend.ingesters.cache import write_json
from backend.ingesters.memo import cached_snapshot

logger = logging.getLogger("prana.ingest_openmeteo_air")
BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
VARIABLES = ("aerosol_optical_depth", "nitrogen_dioxide", "pm2_5", "dust",
             "sulphur_dioxide", "ozone")
GRID = [(lon, lat) for lon in (74.0, 74.8, 75.5, 76.2, 77.0, 77.2)
        for lat in (28.6, 29.5, 30.5, 31.5)]
CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "cache" / "open_meteo_air_quality.geojson"
FALLBACK_FILE = Path(__file__).resolve().parent.parent / "data" / "static" / "open_meteo_air_quality_fallback.geojson"


def _finite(value):
    try:
        number = float(value)
        return number if number == number and abs(number) != float("inf") else None
    except (TypeError, ValueError):
        return None


def _parse(payload) -> Dict[str, Any]:
    locations = payload if isinstance(payload, list) else [payload]
    features, observation_times = [], []
    for requested, row in zip(GRID, locations):
        current = row.get("current") or {}
        values = {name: _finite(current.get(name)) for name in VARIABLES}
        if values["aerosol_optical_depth"] is None or values["nitrogen_dioxide"] is None:
            continue
        stamp = current.get("time")
        if not stamp:
            continue
        if not str(stamp).endswith(("Z", "+00:00")):
            stamp = str(stamp) + "Z"
        observation_times.append(stamp)
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates":
                         [float(row.get("longitude", requested[0])), float(row.get("latitude", requested[1]))]},
                         "properties": {**values, "observed_at": stamp,
                         "model_domain": "cams_global"}})
    if not features:
        raise ValueError("Open-Meteo returned no usable AOD/NO2 grid cells")
    return {"type": "FeatureCollection", "source": "OPEN_METEO_CAMS_GLOBAL_LIVE",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "observation_start": min(observation_times), "observation_end": max(observation_times),
            "attribution": "Open-Meteo; Copernicus Atmosphere Monitoring Service (CAMS)",
            "features": features}


@cached_snapshot("open_meteo_air_quality", ttl=900)
async def fetch_air_quality_grid(client: Optional[httpx.AsyncClient] = None, date_str=None):
    """Fetch current global CAMS AOD and surface pollutant fields for the corridor."""
    data = None
    owned = client is None
    client = client or httpx.AsyncClient(timeout=20.0)
    try:
        params = {"latitude": ",".join(str(lat) for _, lat in GRID),
                  "longitude": ",".join(str(lon) for lon, _ in GRID),
                  "current": ",".join(VARIABLES), "domains": "cams_global", "timezone": "UTC"}
        response = await client.get(BASE_URL, params=params)
        response.raise_for_status()
        data = _parse(response.json())
    except Exception as exc:
        logger.warning("Open-Meteo air-quality request failed (%s)", type(exc).__name__)
    finally:
        if owned:
            await client.aclose()
    if data is None:
        if not demo_enabled():
            raise RuntimeError("Open-Meteo CAMS air-quality data unavailable")
        if not FALLBACK_FILE.exists():
            raise RuntimeError("Open-Meteo CAMS air-quality demo data unavailable")
        data = json.loads(FALLBACK_FILE.read_text(encoding="utf-8"))
        data["source"] = "OPEN_METEO_CAMS_GLOBAL_DEMO_STATIC"
    write_json(CACHE_FILE, data)
    return data


async def fetch_air_quality_aod(client=None, date_str=None, force_refresh=False):
    data = await fetch_air_quality_grid(client=client, date_str=date_str, force_refresh=force_refresh)
    return {**data, "features": [{**feature, "properties": {
            "aerosol_optical_depth": feature["properties"]["aerosol_optical_depth"],
            "observed_at": feature["properties"].get("observed_at")}}
            for feature in data["features"]]}


async def fetch_air_quality_no2(client=None, date_str=None, force_refresh=False):
    data = await fetch_air_quality_grid(client=client, date_str=date_str, force_refresh=force_refresh)
    return {**data, "features": [{**feature, "properties": {
            "no2_ugm3": feature["properties"]["nitrogen_dioxide"],
            "observed_at": feature["properties"].get("observed_at")}}
            for feature in data["features"]]}


async def fetch_all_air_quality(client=None, force_refresh=False):
    data = await fetch_air_quality_grid(client=client, force_refresh=force_refresh)
    count = len(data["features"])
    return {"status": "success", "fetched_at": data["fetched_at"], "source": data["source"],
            "aerosol_optical_depth": {"features_count": count},
            "nitrogen_dioxide": {"features_count": count}}
