"""
Unit Tests for PRANA ML Models (REQ-005, REQ-006, REQ-007)
Tests GP Downscaler, Gaussian-Plume Trajectory, and IsolationForest Anomaly Detector.
"""

import pytest
from backend.ml.downscaler import run_downscaler
from backend.ml.trajectory import compute_plume_trajectories
from backend.ml.anomaly import run_anomaly_detection, train_and_detect_anomalies


# ==============================================================================
# REQ-005: Gaussian Process Downscaler
# ==============================================================================
@pytest.mark.asyncio
async def test_downscaler_coverage():
    """
    Verifies that the GP Downscaler generates a surface grid spanning
    the Punjab/Haryana -> Delhi corridor [73.5-77.5E, 28.5-32.5N]
    where every feature has pm25_estimate, aqi_index, and uncertainty_std.
    """
    result = await run_downscaler(resolution_deg=0.5)
    assert result["type"] == "FeatureCollection"
    assert "computed_at" in result
    assert "resolution_deg" in result
    features = result["features"]
    assert len(features) >= 10

    lons = [f["geometry"]["coordinates"][0] for f in features]
    lats = [f["geometry"]["coordinates"][1] for f in features]

    # Verify coverage across bounding box
    assert min(lons) <= 74.0
    assert max(lons) >= 77.0
    assert min(lats) <= 29.0
    assert max(lats) >= 32.0

    # Verify property types and values
    for f in features:
        props = f["properties"]
        assert "pm25_estimate" in props
        assert "aqi_index" in props
        assert "uncertainty_std" in props
        assert props["pm25_estimate"] > 0
        assert props["aqi_index"] > 0
        assert props["uncertainty_std"] >= 0


# ==============================================================================
# REQ-006: Gaussian-Plume Trajectory Dispersion
# ==============================================================================
@pytest.mark.asyncio
async def test_trajectory_output():
    """
    Verifies that the trajectory model returns 3 Polygon features (24, 48, 72h)
    per fire cluster with all required physical parameters.
    """
    result = await compute_plume_trajectories()
    assert result["type"] == "FeatureCollection"
    features = result["features"]
    assert len(features) >= 3

    # Group by cluster_id
    clusters = {}
    for f in features:
        cid = f["properties"]["cluster_id"]
        clusters.setdefault(cid, []).append(f)

    # Every cluster must have horizons 24, 48, 72
    for cid, feats in clusters.items():
        horizons = sorted([f["properties"]["horizon_hours"] for f in feats])
        assert horizons == [24, 48, 72], f"Cluster {cid} does not have exactly [24, 48, 72] horizons"

        for f in feats:
            assert f["geometry"]["type"] == "Polygon"
            poly_coords = f["geometry"]["coordinates"][0]
            assert len(poly_coords) >= 4
            # Verify polygon is closed
            assert poly_coords[0] == poly_coords[-1]

            props = f["properties"]
            assert props["max_pm25_est"] > 0
            assert props["max_aqi_est"] > 0
            assert "wind_speed_ms" in props
            assert "wind_dir_deg" in props
            assert "mixing_height_m" in props


# ==============================================================================
# REQ-007: IsolationForest Industrial Anomaly Detector
# ==============================================================================
@pytest.mark.asyncio
async def test_anomaly_detector():
    """
    Verifies that IsolationForest flags injected spikes and preserves daytime/nighttime distinction.
    """
    # Create test data with one extreme nighttime spike
    test_readings = [
        {"station_id": "ST-01", "value": 35.0, "day": "2026-09-01", "hour_of_day": 14, "is_nighttime": False},
        {"station_id": "ST-01", "value": 38.0, "day": "2026-09-01", "hour_of_day": 15, "is_nighttime": False},
        {"station_id": "ST-01", "value": 25.0, "day": "2026-09-01", "hour_of_day": 2, "is_nighttime": True},
        {"station_id": "ST-01", "value": 26.0, "day": "2026-09-02", "hour_of_day": 2, "is_nighttime": True},
        # Injected anomaly spike at 02:00
        {"station_id": "ST-01", "value": 240.0, "day": "2026-09-03", "hour_of_day": 2, "is_nighttime": True},
    ]

    results = train_and_detect_anomalies(test_readings, parameter="no2", contamination=0.2)
    assert len(results) == len(test_readings)

    # The injected spike should be flagged as anomaly
    spike_record = next(r for r in results if r["day"] == "2026-09-03")
    assert spike_record["is_anomaly"] is True
    assert spike_record["is_nighttime"] is True
    assert spike_record["hour_of_day"] == 2
    assert spike_record["anomaly_score"] > 0.5

    # Test full runner
    runner_results = await run_anomaly_detection(parameter="no2", nighttime_only=True, days_back=3)
    assert len(runner_results) >= 1
    for item in runner_results:
        assert item["is_nighttime"] is True
        assert "anomaly_score" in item
        assert "is_anomaly" in item
