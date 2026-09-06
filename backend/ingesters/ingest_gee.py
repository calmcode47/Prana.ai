"""Sentinel-5P AAI/NO2 samples through the official Earth Engine SDK."""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from backend.config import demo_enabled
from backend.ingesters.cache import write_json

logger = logging.getLogger("prana.ingest_gee")
BBOX = [73.5, 28.5, 77.5, 32.5]
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"
STATIC_DIR = Path(__file__).resolve().parent.parent / "data" / "static"
AAI_CACHE_FILE = CACHE_DIR / "tropomi_aai.geojson"
NO2_CACHE_FILE = CACHE_DIR / "tropomi_no2.geojson"
AAI_FALLBACK_FILE = STATIC_DIR / "tropomi_aai_fallback.geojson"
NO2_FALLBACK_FILE = STATIC_DIR / "tropomi_no2_fallback.geojson"


def _query_earth_engine(product, date_str):
    import ee
    raw = os.environ["GEE_SERVICE_ACCOUNT_JSON"]
    credentials = json.loads(raw)
    ee.Initialize(ee.ServiceAccountCredentials(credentials["client_email"], key_data=raw),
                  project=os.getenv("GEE_PROJECT_ID") or credentials["project_id"])
    ee.data.setDeadline(30000)
    end = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc) + timedelta(days=1) if date_str else datetime.now(timezone.utc)
    start = end - timedelta(days=1 if date_str else 7)
    band = "absorbing_aerosol_index" if product == "aai" else "tropospheric_NO2_column_number_density"
    collection = "L3_AER_AI" if product == "aai" else "L3_NO2"
    raster = (ee.ImageCollection("COPERNICUS/S5P/NRTI/" + collection).select(band)
        .filterDate(start.isoformat(), end.isoformat()).filterBounds(ee.Geometry.Rectangle(BBOX)).mean())
    points = ee.FeatureCollection([ee.Feature(ee.Geometry.Point([lon, lat]))
        for lon in [74.0, 74.8, 75.5, 76.2, 77.0, 77.2] for lat in [28.6, 29.5, 30.5, 31.5]])
    sampled = raster.sampleRegions(collection=points, scale=10000, geometries=True).getInfo()
    features = []
    for feat in sampled.get("features", []):
        coords = (feat.get("geometry") or {}).get("coordinates")
        value = feat.get("properties", {}).get(band)
        if coords is None or value is None:
            continue
        properties = {"aai": float(value)} if product == "aai" else {"no2_umol_m2": float(value) * 1e6}
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": coords}, "properties": properties})
    return {"type": "FeatureCollection", "source": f"SENTINEL_5P_{product.upper()}_LIVE",
        "fetched_at": datetime.now(timezone.utc).isoformat(), "observation_start": start.isoformat(),
        "observation_end": end.isoformat(), "features": features}


async def _fetch(product, date_str=None):
    cache_file = AAI_CACHE_FILE if product == "aai" else NO2_CACHE_FILE
    fallback_file = AAI_FALLBACK_FILE if product == "aai" else NO2_FALLBACK_FILE
    data = None
    if os.getenv("GEE_SERVICE_ACCOUNT_JSON"):
        try:
            data = await asyncio.to_thread(_query_earth_engine, product, date_str)
        except Exception as exc:
            logger.warning("Earth Engine %s request failed (%s)", product, type(exc).__name__)
    if data is None:
        if not demo_enabled():
            raise RuntimeError("Earth Engine data unavailable; configure service account and project")
        if fallback_file.exists():
            data = json.loads(fallback_file.read_text(encoding="utf-8"))
        else:
            data = {"type": "FeatureCollection", "features": []}
        data["source"] = f"SENTINEL_5P_{product.upper()}_DEMO_STATIC"
    write_json(cache_file, data)
    return data


async def fetch_tropomi_aai(client=None, date_str=None):
    return await _fetch("aai", date_str)


async def fetch_tropomi_no2(client=None, date_str=None):
    return await _fetch("no2", date_str)


async def fetch_all_satellite_data(client=None):
    aai = await fetch_tropomi_aai(client)
    no2 = await fetch_tropomi_no2(client)
    return {"status": "success", "fetched_at": datetime.now(timezone.utc).isoformat(),
        "aai": {"source": aai["source"], "features_count": len(aai["features"])},
        "no2": {"source": no2["source"], "features_count": len(no2["features"])}}
