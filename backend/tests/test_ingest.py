"""
Unit and Integration Tests for Data Ingestion (REQ-001 to REQ-004)
Tests FIRMS parsing, OpenAQ fetching, Open-Meteo processing, and CPCB AQI conversion.
"""

import os
import pytest
import respx
import httpx
from datetime import datetime, timezone

from backend.ingesters.ingest_firms import fetch_firms_hotspots, parse_firms_csv
from backend.ingesters.ingest_openaq import fetch_openaq_stations
from backend.ingesters.ingest_meteo import fetch_meteo_forecast, fetch_location_meteo
from backend.database import compute_cpcb_aqi, get_aqi_category_and_color


# ==============================================================================
# REQ-001: NASA FIRMS Ingestion
# ==============================================================================
def test_firms_csv_parsing(firms_sample_csv):
    """Verifies that FIRMS CSV is parsed properly with correct field mappings."""
    records = parse_firms_csv(firms_sample_csv)
    assert len(records) >= 10
    first = records[0]
    assert "latitude" in first
    assert "longitude" in first
    assert "acq_datetime" in first
    assert "frp" in first
    assert first["sensor"] == "VIIRS_SNPP"
    assert first["confidence"] in ("low", "nominal", "high")


@pytest.mark.asyncio
async def test_firms_fetch_fallback():
    """Verifies fallback when no FIRMS_MAP_KEY is provided."""
    data = await fetch_firms_hotspots()
    assert data["type"] == "FeatureCollection"
    assert data["count"] >= 1
    assert len(data["features"]) >= 1
    feat = data["features"][0]
    assert feat["type"] == "Feature"
    assert feat["geometry"]["type"] == "Point"
    assert "frp" in feat["properties"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_firms_live():
    """Hits live NASA FIRMS API (requires valid FIRMS_MAP_KEY)."""
    key = os.getenv("FIRMS_MAP_KEY")
    if not key or key == "YOUR_FIRMS_MAP_KEY_HERE":
        pytest.skip("FIRMS_MAP_KEY not set")
    data = await fetch_firms_hotspots()
    assert data["source"] == "NASA_FIRMS_VIIRS_SNPP_NRT"
    assert data["count"] >= 0


# ==============================================================================
# REQ-003: OpenAQ Ground Station Ingestion
# ==============================================================================
@pytest.mark.asyncio
async def test_openaq_fetch_mocked(openaq_locations_json):
    """Verifies OpenAQ ingestion using mocked HTTP response."""
    with respx.mock(base_url="https://api.openaq.org/v3") as respx_mock:
        respx_mock.get("/locations").mock(
            return_value=httpx.Response(200, json=openaq_locations_json)
        )
        pm25 = [{"locationsId": location["id"], "sensorsId": location["sensors"][0]["id"],
                 "value": location["sensors"][0]["latest"]["value"],
                 "coordinates": location["coordinates"],
                 "datetime": {"utc": datetime.now(timezone.utc).isoformat()}}
                for location in openaq_locations_json["results"]]
        respx_mock.get("/parameters/2/latest").mock(return_value=httpx.Response(200, json={"results": pm25}))
        respx_mock.get("/parameters/5/latest").mock(return_value=httpx.Response(200, json={"results": []}))
        respx_mock.get("/parameters/6/latest").mock(return_value=httpx.Response(200, json={"results": []}))
        async with httpx.AsyncClient() as client:
            readings = await fetch_openaq_stations(client=client)
            assert len(readings) >= 10
            for r in readings:
                assert "pm25_ugm3" in r
                assert "aqi_index" in r
                assert r["pm25_ugm3"] >= 0
                assert r["aqi_index"] >= 0


@pytest.mark.asyncio
async def test_openaq_fallback_stations():
    """Verifies fallback stations are loaded when OpenAQ is unreachable."""
    readings = await fetch_openaq_stations()
    assert len(readings) >= 10
    first = readings[0]
    assert first["pm25_ugm3"] > 0
    assert first["aqi_index"] > 0


# ==============================================================================
# REQ-004: Open-Meteo Ingestion
# ==============================================================================
@pytest.mark.asyncio
async def test_meteo_fetch_mocked(open_meteo_json):
    """Verifies Open-Meteo ingestion with required variables using mock."""
    with respx.mock(base_url="https://api.open-meteo.com/v1") as respx_mock:
        respx_mock.get("/forecast").mock(
            return_value=httpx.Response(200, json=open_meteo_json)
        )
        async with httpx.AsyncClient() as client:
            result = await fetch_meteo_forecast(client=client)
            assert "punjab" in result
            assert "delhi" in result
            for loc in ("punjab", "delhi"):
                data = result[loc]
                assert "windspeed_10m" in data
                assert "winddirection_10m" in data
                assert "boundary_layer_height" in data
                assert "temperature_2m" in data


# ==============================================================================
# DEC-010: CPCB AQI Breakpoint Conversion
# ==============================================================================
def test_cpcb_aqi_breakpoints():
    """Verifies accurate conversion of PM2.5 concentrations to CPCB AQI indices."""
    # Good (0-30 ug/m3 -> 0-50)
    assert compute_cpcb_aqi(0) == 0
    assert compute_cpcb_aqi(15) == 25
    assert compute_cpcb_aqi(30) == 50

    # Satisfactory (31-60 ug/m3 -> 51-100)
    sat_aqi = compute_cpcb_aqi(45)
    assert 51 <= sat_aqi <= 100

    # Moderate (61-90 ug/m3 -> 101-200)
    mod_aqi = compute_cpcb_aqi(75)
    assert 101 <= mod_aqi <= 200

    # Poor (91-120 ug/m3 -> 201-300)
    poor_aqi = compute_cpcb_aqi(105)
    assert 201 <= poor_aqi <= 300

    # Very Poor (121-250 ug/m3 -> 301-400)
    vp_aqi = compute_cpcb_aqi(180)
    assert 301 <= vp_aqi <= 400

    # Severe (251-380 ug/m3 -> 401-500)
    sev_aqi = compute_cpcb_aqi(300)
    assert 401 <= sev_aqi <= 500

    # Hazardous (>380 ug/m3 -> >500)
    haz_aqi = compute_cpcb_aqi(450)
    assert haz_aqi == 500


def test_aqi_category_and_color():
    """Verifies category names and hex colors."""
    cat, col = get_aqi_category_and_color(45)
    assert cat == "Good" and col == "#00C781"

    cat, col = get_aqi_category_and_color(80)
    assert cat == "Satisfactory" and col == "#92D050"

    cat, col = get_aqi_category_and_color(150)
    assert cat == "Moderate" and col == "#FFFF00"

    cat, col = get_aqi_category_and_color(250)
    assert cat == "Poor" and col == "#FF7800"

    cat, col = get_aqi_category_and_color(350)
    assert cat == "Very Poor" and col == "#FF0000"

    cat, col = get_aqi_category_and_color(450)
    assert cat == "Severe" and col == "#8F3F97"

    cat, col = get_aqi_category_and_color(520)
    assert cat == "Severe" and col == "#8F3F97"


# ==============================================================================
# REQ-002: Open-Meteo CAMS Air Quality Ingestion
# ==============================================================================
@pytest.mark.asyncio
async def test_open_meteo_aod_ingest():
    from backend.ingesters.ingest_openmeteo_air import fetch_air_quality_aod
    data = await fetch_air_quality_aod()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) >= 1
    feat = data["features"][0]
    assert feat["type"] == "Feature"
    assert feat["geometry"]["type"] == "Point"
    assert "aerosol_optical_depth" in feat["properties"]
    assert feat["properties"]["aerosol_optical_depth"] > 0


@pytest.mark.asyncio
async def test_open_meteo_no2_ingest():
    from backend.ingesters.ingest_openmeteo_air import fetch_air_quality_no2
    data = await fetch_air_quality_no2()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) >= 1
    feat = data["features"][0]
    assert feat["type"] == "Feature"
    assert feat["geometry"]["type"] == "Point"
    assert "no2_ugm3" in feat["properties"]
    assert feat["properties"]["no2_ugm3"] > 0


@pytest.mark.asyncio
async def test_open_meteo_combined_air_pipeline():
    from backend.ingesters.ingest_openmeteo_air import fetch_all_air_quality
    summary = await fetch_all_air_quality()
    assert summary["status"] == "success"
    assert summary["aerosol_optical_depth"]["features_count"] >= 1
    assert summary["nitrogen_dioxide"]["features_count"] >= 1

