"""
Industrial Anomaly Detector (REQ-007)
Uses scikit-learn IsolationForest to identify anomalous nighttime vs daytime
industrial emission spikes (NO2, SO2) along the NCR industrial belt.
"""

import logging
import asyncio
from backend.config import demo_enabled
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
import numpy as np
from sklearn.ensemble import IsolationForest

from backend.database import get_db_pool, get_in_memory_store

logger = logging.getLogger("prana.ml.anomaly")

# Known industrial monitoring stations in the Haryana-NCR belt
SAMPLE_INDUSTRIAL_STATIONS = [
    {"station_id": "IN-CPCB-HR-003", "station_name": "Manesar Industrial Area, Haryana"},
    {"station_id": "IN-CPCB-HR-004", "station_name": "Panipat Industrial Cluster, Haryana"},
    {"station_id": "IN-CPCB-HR-005", "station_name": "Sonipat Kundli Belt, Haryana"},
    {"station_id": "IN-CPCB-DL-005", "station_name": "Mayapuri Industrial Area, Delhi"}
]


def train_and_detect_anomalies(
    readings: List[Dict[str, Any]],
    parameter: str = "no2",
    contamination: float = 0.15
) -> List[Dict[str, Any]]:
    """
    Fits an IsolationForest model on pollutant observations to detect statistical outliers.
    Maintains explicit distinction between daytime and nighttime operations.
    """
    if not readings:
        return []

    # Features: [concentration, hour_of_day, is_nighttime, concentration_ratio]
    features = []
    for r in readings:
        val = float(r.get("value", 40.0))
        hour = int(r.get("hour_of_day", 12))
        is_night = 1.0 if r.get("is_nighttime", False) else 0.0
        features.append([val, hour, is_night])

    x = np.array(features)
    iso = IsolationForest(contamination=contamination, random_state=42)
    predictions = iso.fit_predict(x)  # -1 = anomaly, 1 = normal
    scores = iso.decision_function(x)  # Lower = more anomalous

    flagged = []
    for idx, r in enumerate(readings):
        is_anom = bool(predictions[idx] == -1)
        # Normalized anomaly score (0.0 to 1.0, higher = more anomalous)
        raw_score = float(scores[idx])
        norm_score = round(float(1.0 / (1.0 + np.exp(raw_score * 4.0))), 3)

        flagged.append({
            "station_id": r["station_id"],
            "station_name": r.get("station_name", r["station_id"]),
            "parameter": parameter,
            "day": r["day"],
            "hour_of_day": r["hour_of_day"],
            "is_nighttime": r["is_nighttime"],
            "anomaly_score": norm_score,
            "is_anomaly": is_anom
        })

    return flagged


async def run_anomaly_detection(
    parameter: str = "no2",
    nighttime_only: bool = True,
    days_back: int = 7
) -> List[Dict[str, Any]]:
    """
    Runs anomaly detection across recent historical observations.
    Ensures UNIQUE (station_id, parameter, day, is_nighttime) constraint is met.
    """
    today = datetime.now(timezone.utc).date()
    sample_dataset = []

    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            raw = [dict(r) for r in await conn.fetch(
                "SELECT * FROM pollutant_readings WHERE parameter=$1 AND measured_at >= $2 ORDER BY measured_at",
                parameter, datetime.now(timezone.utc) - timedelta(days=days_back))]
    else:
        raw = [r for r in get_in_memory_store()["pollutant_readings"] if r["parameter"] == parameter]
    # Use local India time to classify night observations; never mix pollutant units.
    for r in raw:
        dt = r["measured_at"]
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        if dt < datetime.now(timezone.utc) - timedelta(days=days_back):
            continue
        local = dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
        sample_dataset.append({**r, "day": str(local.date()), "hour_of_day": local.hour,
                               "is_nighttime": local.hour < 6 or local.hour >= 20})
    synthetic = not sample_dataset and demo_enabled()
    if synthetic:
        # Generate synthetic time-series baseline with an intentional nighttime industrial spike
        for i in range(days_back):
            day_date = str(today - timedelta(days=i))
            for st in SAMPLE_INDUSTRIAL_STATIONS:
                # Daytime reading (e.g. 14:00, nominal ~45 umol/m2)
                sample_dataset.append({
                    "station_id": st["station_id"],
                    "station_name": st["station_name"],
                    "value": 42.0 + np.random.normal(0, 5),
                    "day": day_date,
                    "hour_of_day": 14,
                    "is_nighttime": False
                })

                # Nighttime reading (e.g. 02:00, normal is ~30, but Manesar has covert midnight spike ~160)
                is_spike = (st["station_id"] == "IN-CPCB-HR-003" and i in (1, 3, 5))
                val_night = 175.0 if is_spike else (28.0 + np.random.normal(0, 4))

                sample_dataset.append({
                    "station_id": st["station_id"],
                    "station_name": st["station_name"],
                    "value": val_night,
                    "day": day_date,
                    "hour_of_day": 2,
                    "is_nighttime": True
                })

    # Fit independent baselines per station and unit to avoid comparing unlike sensors.
    if synthetic:
        results = await asyncio.to_thread(train_and_detect_anomalies, sample_dataset, parameter=parameter)
    else:
        groups = {}
        for r in sample_dataset:
            groups.setdefault((r["station_id"], r["unit"]), []).append(r)
        results = []
        for group in groups.values():
            if len(group) >= 8:
                results.extend(await asyncio.to_thread(train_and_detect_anomalies, group, parameter=parameter))
    for item in results:
        item["source"] = "DEMO_SYNTHETIC" if synthetic else "OPENAQ_LIVE"

    # Filter according to query arguments
    filtered = []
    for item in results:
        if nighttime_only and not item["is_nighttime"]:
            continue
        filtered.append(item)

    # Schema stores the strongest anomaly for each day/night period.
    strongest = {}
    for item in filtered:
        key = (item["station_id"], item["parameter"], item["day"], item["is_nighttime"])
        if key not in strongest or item["anomaly_score"] > strongest[key]["anomaly_score"]:
            strongest[key] = item
    filtered = list(strongest.values())

    # Persist to database if connected
    pool = get_db_pool()
    if pool and not synthetic:
        try:
            async with pool.acquire() as conn:
                stmt = """
                INSERT INTO anomaly_flags (station_id, parameter, day, hour_of_day, is_nighttime, anomaly_score, is_anomaly)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (station_id, parameter, day, is_nighttime)
                DO UPDATE SET anomaly_score = EXCLUDED.anomaly_score, is_anomaly = EXCLUDED.is_anomaly;
                """
                for item in filtered:
                    d_obj = datetime.strptime(item["day"], "%Y-%m-%d").date()
                    await conn.execute(
                        stmt,
                        item["station_id"],
                        item["parameter"],
                        d_obj,
                        item["hour_of_day"],
                        item["is_nighttime"],
                        item["anomaly_score"],
                        item["is_anomaly"]
                    )
        except Exception as ex:
            raise RuntimeError("Anomaly persistence failed") from None

    return filtered
