"""
Gaussian-Plume Trajectory Model (REQ-006)
Clusters FIRMS active fire hotspots via DBSCAN and computes forward plume dispersion
polygons for 24h, 48h, and 72h horizons using Open-Meteo wind fields and mixing heights.
"""

import math
import json
from backend.ingesters.memo import cached_snapshot
from backend.database import get_in_memory_store
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.cluster import DBSCAN

from backend.database import compute_cpcb_aqi, get_db_pool
from backend.ingesters.ingest_firms import fetch_firms_hotspots
from backend.ingesters.ingest_meteo import fetch_meteo_forecast

logger = logging.getLogger("prana.ml.trajectory")


def create_ellipse_polygon(
    center_lon: float,
    center_lat: float,
    semi_major_deg: float,
    semi_minor_deg: float,
    angle_deg: float,
    num_points: int = 16
) -> List[List[float]]:
    """
    Generates a closed polygon approximating an oriented dispersion ellipse.
    angle_deg: direction of plume travel (0 = North, 90 = East, 180 = South, 270 = West).
    """
    angle_rad = math.radians(angle_deg)
    points = []

    for i in range(num_points):
        theta = 2.0 * math.pi * i / num_points
        # Local unrotated ellipse coordinates
        x = semi_major_deg * math.cos(theta)
        y = semi_minor_deg * math.sin(theta)

        # Rotate by plume propagation angle
        # Note: In meteorology, wind from NW (315°) blows towards SE (135°)
        rot_lon = x * math.sin(angle_rad) + y * math.cos(angle_rad)
        rot_lat = x * math.cos(angle_rad) - y * math.sin(angle_rad)

        points.append([round(center_lon + rot_lon, 5), round(center_lat + rot_lat, 5)])

    # Close the polygon
    points.append(points[0])
    return points


@cached_snapshot("plume", ttl=300)
async def compute_plume_trajectories(cluster_id_filter: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes DBSCAN fire clustering and analytical Gaussian dispersion modeling.
    Outputs GeoJSON FeatureCollection with 24, 48, 72 hour plume polygons.
    """
    # 1. Fetch active hotspots
    hotspots_data = await fetch_firms_hotspots()
    features = hotspots_data.get("features", [])

    if not features:
        return {"type": "FeatureCollection", "computed_at": datetime.now(timezone.utc).isoformat(),
                "source": hotspots_data.get("source", "unknown"), "features": []}
    else:
        fire_points = []
        for feat in features:
            coords = feat["geometry"]["coordinates"]
            frp = feat.get("properties", {}).get("frp")
            if frp is None:
                continue  # Missing radiative power cannot support a concentration estimate.
            frp = float(frp)
            if not math.isfinite(frp) or frp < 0:
                raise ValueError("Invalid fire radiative power")
            if frp == 0:
                continue
            if len(coords) != 2 or not all(math.isfinite(float(v)) for v in coords):
                raise ValueError("Invalid fire coordinates")
            if not (-180 <= coords[0] <= 180 and -90 < coords[1] < 90):
                raise ValueError("Fire coordinates out of range")
            fire_points.append({"lon": coords[0], "lat": coords[1], "frp": frp})

    if not fire_points:
        return {"type": "FeatureCollection", "computed_at": datetime.now(timezone.utc).isoformat(),
                "source": hotspots_data.get("source", "unknown"), "features": []}

    # 2. Cluster fires with DBSCAN (eps ~ 0.35 degrees ≈ 38km, min_samples=2)
    coords_np = np.array([[p["lon"], p["lat"]] for p in fire_points])
    db = DBSCAN(eps=0.35, min_samples=2).fit(coords_np)
    labels = db.labels_

    clusters: Dict[int, Dict[str, Any]] = {}
    for idx, label in enumerate(labels):
        if label == -1:
            continue  # noise point
        if label not in clusters:
            clusters[label] = {"points": [], "total_frp": 0.0}
        clusters[label]["points"].append(fire_points[idx])
        clusters[label]["total_frp"] += fire_points[idx]["frp"]

    # Fallback to main cluster if none detected
    if not clusters:
        clusters[0] = {
            "points": fire_points,
            "total_frp": sum(p["frp"] for p in fire_points)
        }

    # 3. Fetch meteorological fields from Open-Meteo
    meteo_data = await fetch_meteo_forecast()
    punjab_meteo = meteo_data["punjab"]
    wind_speed = float(punjab_meteo["windspeed_10m"])
    wind_dir = float(punjab_meteo["winddirection_10m"])  # Direction wind is coming FROM
    mixing_height = float(punjab_meteo["boundary_layer_height"])
    if (not all(math.isfinite(v) for v in (wind_speed, wind_dir, mixing_height))
            or wind_speed < 0 or not 0 <= wind_dir <= 360 or mixing_height <= 0):
        raise ValueError("Invalid meteorological inputs")

    # Downwind direction is opposite from where wind originates
    downwind_deg = (wind_dir + 180.0) % 360.0
    downwind_rad = math.radians(downwind_deg)

    plume_features = []
    horizons = [24, 48, 72]

    # 4. Generate forward plumes for each cluster
    for c_idx, c_data in clusters.items():
        c_id = f"CLU-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{c_idx + 1:03d}"
        if cluster_id_filter and cluster_id_filter != c_id:
            continue

        c_lons = [p["lon"] for p in c_data["points"]]
        c_lats = [p["lat"] for p in c_data["points"]]
        centroid_lon = float(np.mean(c_lons))
        centroid_lat = float(np.mean(c_lats))
        q_frp = c_data["total_frp"]

        # Advection and dispersion per horizon
        for h in horizons:
            # Travel distance in km: u (m/s) * h (hours) * 3600 / 1000
            travel_km = (wind_speed * h * 3600.0) / 1000.0

            # Displacement in degrees (1 deg ~ 111 km)
            d_lon = (travel_km * math.sin(downwind_rad)) / (111.0 * math.cos(math.radians(centroid_lat)))
            d_lat = (travel_km * math.cos(downwind_rad)) / 111.0

            # Advected plume center
            adv_lon = centroid_lon + d_lon
            adv_lat = centroid_lat + d_lat

            # Pasquill-Gifford Class D Gaussian dispersion parameters
            # Major axis (longitudinal spread) and minor axis (lateral spread sigma_y)
            semi_major = max(0.4, (travel_km * 0.25) / 111.0)
            semi_minor = max(0.2, (travel_km * 0.12) / 111.0)

            polygon_coords = create_ellipse_polygon(
                center_lon=adv_lon,
                center_lat=adv_lat,
                semi_major_deg=semi_major,
                semi_minor_deg=semi_minor,
                angle_deg=downwind_deg
            )

            # Concentration estimates: inversely proportional to horizon and mixing height
            dilution = max(1.0, (h / 24.0) * (mixing_height / 500.0))
            max_pm25 = round((q_frp * 2.8) / dilution, 1)
            max_aqi = compute_cpcb_aqi(max_pm25)

            plume_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon_coords]
                },
                "properties": {
                    "cluster_id": c_id,
                    "horizon_hours": h,
                    "max_pm25_est": max_pm25,
                    "max_aqi_est": max_aqi,
                    "wind_speed_ms": round(wind_speed, 1),
                    "wind_dir_deg": round(wind_dir, 1),
                    "mixing_height_m": round(mixing_height, 1)
                }
            })

    await persist_forecasts(plume_features)
    return {
        "type": "FeatureCollection",
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "source": "model_estimate; fires=" + hotspots_data.get("source", "unknown") + "; weather=" + punjab_meteo.get("source", "unknown"),
        "model_assumptions": "Steady current wind; heuristic fire contribution only; no background PM2.5 or field calibration",
        "features": plume_features
    }


async def persist_forecasts(features):
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for feature in features:
                    p = feature["properties"]
                    geometry = json.dumps(feature["geometry"])
                    await conn.execute("DELETE FROM forecast_zones WHERE fire_cluster_id=$1 AND horizon_hours=$2",
                                       p["cluster_id"], p["horizon_hours"])
                    await conn.execute("""INSERT INTO forecast_zones
                        (fire_cluster_id,horizon_hours,geom,centroid_lat,centroid_lon,max_pm25_est,
                         wind_speed_ms,wind_dir_deg,mixing_height_m)
                        SELECT $1,$2,g,ST_Y(ST_Centroid(g)),ST_X(ST_Centroid(g)),$4,$5,$6,$7
                        FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3),4326) AS g) geometry""",
                        p["cluster_id"],p["horizon_hours"],geometry,p["max_pm25_est"],
                        p["wind_speed_ms"],p["wind_dir_deg"],p["mixing_height_m"])
    get_in_memory_store()["forecast_zones"] = features
