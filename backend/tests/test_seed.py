"""
Database Seeding & Migration Tests (DEC-010, REQ-008)
Validates that synthetic high-pollution episode data generators
strictly adhere to database column schemas, constraints, and DEC-010 AQI scales.
"""

import pytest
from backend.scripts.seed_db import (
    generate_hotspots,
    generate_station_readings,
    generate_anomaly_flags,
    generate_incidents,
    generate_fl_rounds,
    seed_in_memory,
)
from backend.database import get_in_memory_store


def test_seed_hotspots_schema():
    hotspots = generate_hotspots()
    assert len(hotspots) >= 10
    for h in hotspots:
        assert "latitude" in h and "longitude" in h
        assert "frp" in h and h["frp"] > 0
        assert "brightness" in h
        assert "acq_datetime" in h
        assert h["sensor"] == "VIIRS_SNPP"


def test_seed_station_readings_dec010():
    stations = generate_station_readings()
    assert len(stations) >= 10
    for s in stations:
        assert "station_id" in s
        assert "pm25_ugm3" in s and s["pm25_ugm3"] > 0
        assert "unit" in s and s["unit"] == "ug/m3"
        assert "measured_at" in s


def test_seed_anomaly_flags_unique_constraint():
    anomalies = generate_anomaly_flags()
    assert len(anomalies) >= 4
    keys = set()
    for a in anomalies:
        key = (a["station_id"], a["parameter"], a["day"], a["is_nighttime"])
        assert key not in keys, f"Duplicate constraint violation for {key}"
        keys.add(key)
        assert "anomaly_score" in a
        assert "is_anomaly" in a


def test_seed_fl_rounds_req008():
    rounds = generate_fl_rounds()
    assert len(rounds) == 10
    assert rounds[-1]["round_number"] == 10
    assert rounds[-1]["global_accuracy"] > rounds[-1]["punjab_accuracy"]
    assert rounds[-1]["global_accuracy"] > rounds[-1]["delhi_accuracy"]


def test_seed_in_memory_execution():
    seed_in_memory()
    store = get_in_memory_store()
    assert len(store["fire_hotspots"]) > 0
    assert len(store["aqi_readings"]) > 0
    assert len(store["anomaly_flags"]) > 0
    assert len(store["incidents"]) > 0
    assert len(store["fl_rounds"]) == 10
