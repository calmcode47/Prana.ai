"""
Gaussian Process Downscaler (REQ-005)
Calibrates ground CPCB PM2.5 readings against satellite TROPOMI Absorbing Aerosol Index (AAI)
to generate a continuous PM2.5 surface grid across the Punjab/Haryana -> Delhi corridor.
"""

import math
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

from backend.database import compute_cpcb_aqi, get_db_pool, get_in_memory_store
from backend.ingesters.ingest_openaq import fetch_openaq_stations

logger = logging.getLogger("prana.ml.downscaler")

TROPOMI_AAI_FALLBACK = Path(__file__).resolve().parent.parent / "data" / "static" / "tropomi_aai_fallback.geojson"

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


def load_tropomi_aai() -> List[Dict[str, Any]]:
    """Loads TROPOMI AAI raster points from cached or fallback GeoJSON."""
    cache_file = Path(__file__).resolve().parent.parent / "data" / "cache" / "tropomi_aai.geojson"
    target_path = cache_file if cache_file.exists() else TROPOMI_AAI_FALLBACK
    if not target_path.exists():
        return []
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("features", [])
    except Exception as ex:
        logger.warning(f"Error loading TROPOMI AAI data: {ex}")
        return []


def get_interpolated_aai(lon: float, lat: float, aai_features: List[Dict[str, Any]]) -> float:
    """Estimates AAI at arbitrary coordinate using inverse-distance weighting of satellite points."""
    if not aai_features:
        # Default representative baseline during burning season
        return 2.15

    weights = []
    values = []
    for feat in aai_features:
        coords = feat.get("geometry", {}).get("coordinates", [lon, lat])
        val = feat.get("properties", {}).get("aai", 2.0)
        dist = max(haversine_km(lon, lat, coords[0], coords[1]), 0.5)
        w = 1.0 / (dist ** 2)
        weights.append(w)
        values.append(val)

    total_w = sum(weights)
    if total_w == 0:
        return 2.15
    return float(sum(w * v for w, v in zip(weights, values)) / total_w)


async def run_downscaler(resolution_deg: float = 0.5) -> Dict[str, Any]:
    """
    Executes Gaussian Process downscaling over the corridor bounding box.
    Fuses ground station PM2.5 with satellite TROPOMI AAI.
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
                    SELECT DISTINCT ON (station_id) latitude, longitude, pm25_ugm3
                    FROM aqi_readings
                    ORDER BY station_id, measured_at DESC
                    LIMIT 100;
                    """
                )
                readings = [dict(r) for r in rows]
        except Exception:
            pass

    if not readings:
        readings = await fetch_openaq_stations()

    aai_features = load_tropomi_aai()

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

        aai_val = get_interpolated_aai(lon, lat, aai_features)
        # Distance to other nearest station
        dists = [haversine_km(lon, lat, s.get("longitude", lon), s.get("latitude", lat)) for s in readings if s != st]
        dist_nearest = min(dists) if dists else 5.0

        x_train.append([lon, lat, aai_val, dist_nearest, hour_sin, hour_cos, season_flag])
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
            aai_val = get_interpolated_aai(lon, lat, aai_features)
            dists = [haversine_km(lon, lat, s.get("longitude", lon), s.get("latitude", lat)) for s in readings]
            dist_nearest = min(dists) if dists else 10.0
            grid_points.append([lon, lat, aai_val, dist_nearest, hour_sin, hour_cos, season_flag])

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
        "features": features_list
    }
