from backend.config import demo_enabled
"""
Gaussian Process Downscaler (REQ-005)
Calibrates ground PM2.5 readings against CAMS aerosol optical depth (AOD)
to generate a continuous PM2.5 surface grid across the Punjab/Haryana -> Delhi corridor.
"""

import math
import asyncio
from backend.ingesters.ingest_openmeteo_air import fetch_air_quality_grid
from backend.ingesters.memo import cached_snapshot
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

from backend.database import compute_cpcb_aqi, get_db_pool, get_in_memory_store
from backend.ingesters.ingest_openaq import fetch_openaq_stations

logger = logging.getLogger("prana.ml.downscaler")

AIR_QUALITY_FALLBACK = Path(__file__).resolve().parent.parent / "data" / "static" / "open_meteo_air_quality_fallback.geojson"

# Corridor Bounding Box: [west, south, east, north]
BBOX = [73.5, 28.5, 77.5, 32.5]


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calculates great-circle distance in kilometers between two coordinates."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def load_air_quality_aod() -> List[Dict[str, Any]]:
    """Load cached or explicitly labelled demonstration CAMS AOD points."""
    cache_file = Path(__file__).resolve().parent.parent / "data" / "cache" / "open_meteo_air_quality.geojson"
    target_path = cache_file if cache_file.exists() else AIR_QUALITY_FALLBACK
    if not target_path.exists():
        return []
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("features", [])
    except Exception as ex:
        logger.warning(f"Error loading CAMS aerosol optical depth data: {ex}")
        return []


def get_interpolated_aod(lon: float, lat: float, aod_features: List[Dict[str, Any]]) -> float:
    """Estimate AOD at an arbitrary coordinate using inverse-distance weighting."""
    if not aod_features:
        raise ValueError("Aerosol optical depth observations are required")

    weights = []
    values = []
    for feat in aod_features:
        coords = feat.get("geometry", {}).get("coordinates", [lon, lat])
        val = feat.get("properties", {}).get("aerosol_optical_depth")
        if val is None:
            continue
        dist = max(haversine_km(lon, lat, coords[0], coords[1]), 0.5)
        w = 1.0 / (dist ** 2)
        weights.append(w)
        values.append(val)

    total_w = sum(weights)
    if total_w == 0:
        raise ValueError("Aerosol optical depth observations are invalid")
    return float(sum(w * v for w, v in zip(weights, values)) / total_w)


@cached_snapshot("surface", ttl=300)
async def run_downscaler(resolution_deg: float = 0.5) -> Dict[str, Any]:
    """
    Executes Gaussian Process downscaling over the corridor bounding box.
    Fuses ground-station PM2.5 with Open-Meteo CAMS global AOD.
    Returns GeoJSON FeatureCollection matching SurfaceGridResponse.
    """
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, WhiteKernel

    # 1. Fetch latest ground truth stations
    readings = []
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT DISTINCT ON (station_id) latitude, longitude, pm25_ugm3, source
                    FROM aqi_readings WHERE parameter = 'pm25' AND ($1::boolean OR source='OPENAQ_LIVE') AND latitude IS NOT NULL AND longitude IS NOT NULL
                    ORDER BY station_id, measured_at DESC
                    LIMIT 100;
                    """, demo_enabled()
                )
                readings = [dict(r) for r in rows]
        except Exception:
            raise RuntimeError("Station storage unavailable") from None

    if not readings:
        readings = await fetch_openaq_stations()

    aod_data = await fetch_air_quality_grid()
    aod_features = aod_data["features"]
    if not aod_features:
        raise RuntimeError("Insufficient observations for spatial interpolation")
    if not readings:
        return _cams_surface(aod_features, aod_data.get("source", "unknown"))
    return await asyncio.to_thread(_compute_surface, readings, aod_features, resolution_deg, aod_data.get("source", "unknown"))


def _cams_surface(features, source):
    """Expose the upstream CAMS PM2.5 grid when fresh ground calibration is unavailable."""
    output = []
    for feature in features:
        value = feature.get("properties", {}).get("pm2_5")
        if value is None or not math.isfinite(float(value)) or float(value) < 0:
            continue
        pm25 = float(value)
        output.append({"type": "Feature", "geometry": feature["geometry"], "properties": {
            "pm25_estimate": round(pm25, 1), "aqi_index": compute_cpcb_aqi(pm25),
            "uncertainty_std": None}})
    if not output:
        raise RuntimeError("CAMS PM2.5 surface is unavailable")
    return {"type": "FeatureCollection", "computed_at": datetime.now(timezone.utc).isoformat(),
            "resolution_deg": 0.4, "source": f"CAMS_MODEL_SURFACE; provider={source}; ground_calibration=unavailable",
            "features": output}


def _compute_surface(readings, aod_features, resolution_deg, source):
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, WhiteKernel

    now = datetime.now(timezone.utc)
    hour = now.hour
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)
    season_flag = 1.0 if now.month in (10, 11) else 0.0

    # 2. Build training dataset from station coordinates
    x_train = []
    y_train = []

    for st in readings:
        lat = float(st.get("latitude") or 28.6)
        lon = float(st.get("longitude") or 77.2)
        pm25 = float(st.get("pm25_ugm3", 150.0))

        aod_val = get_interpolated_aod(lon, lat, aod_features)
        # Distance to other nearest station
        dists = [haversine_km(lon, lat, s.get("longitude", lon), s.get("latitude", lat)) for s in readings if s != st]
        dist_nearest = min(dists) if dists else 5.0

        x_train.append([lon, lat, aod_val, dist_nearest, hour_sin, hour_cos, season_flag])
        y_train.append(pm25)

    x_train_np = np.array(x_train)
    y_train_np = np.array(y_train)

    # 3. Fit Gaussian Process Regressor
    kernel = RBF(length_scale=1.0) + WhiteKernel(noise_level=0.1, noise_level_bounds=(1e-7, 1e3))
    gpr = GaussianProcessRegressor(kernel=kernel, alpha=0.5, normalize_y=True, random_state=42)
    gpr.fit(x_train_np, y_train_np)

    # 4. Generate prediction grid across corridor bbox [73.5, 28.5, 77.5, 32.5]
    lons = np.arange(BBOX[0], BBOX[2] + (resolution_deg / 2.0), resolution_deg)
    lats = np.arange(BBOX[1], BBOX[3] + (resolution_deg / 2.0), resolution_deg)

    grid_points = []
    features_list = []

    for lat in lats:
        for lon in lons:
            aod_val = get_interpolated_aod(lon, lat, aod_features)
            dists = [haversine_km(lon, lat, s.get("longitude", lon), s.get("latitude", lat)) for s in readings]
            dist_nearest = min(dists) if dists else 10.0
            grid_points.append([lon, lat, aod_val, dist_nearest, hour_sin, hour_cos, season_flag])

    grid_np = np.array(grid_points)
    preds, stds = gpr.predict(grid_np, return_std=True)

    idx = 0
    for lat in lats:
        for lon in lons:
            pm25_est = max(float(preds[idx]), 15.0)  # Lower bound for ambient air
            std_val = float(stds[idx])
            aqi_idx = compute_cpcb_aqi(pm25_est)

            features_list.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(lon), 4), round(float(lat), 4)]
                },
                "properties": {
                    "pm25_estimate": round(pm25_est, 1),
                    "aqi_index": aqi_idx,
                    "uncertainty_std": round(std_val, 2)
                }
            })
            idx += 1

    return {
        "type": "FeatureCollection",
        "computed_at": now.isoformat(),
        "resolution_deg": resolution_deg,
        "source": "model_estimate; satellite=" + source + "; stations=" + ",".join(sorted({r.get("source", "unknown") for r in readings})),
        "features": features_list
    }
