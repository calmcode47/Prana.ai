"""Behavioral regressions discovered during the backend completion audit."""
import asyncio
import io
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from PIL import Image
from starlette.exceptions import HTTPException

from backend import database
from backend.main import app
from backend.ingesters.ingest_firms import fetch_firms_hotspots
from backend.ingesters.ingest_openaq import fetch_openaq_stations
from backend.ingesters.ingest_meteo import fetch_location_meteo
from backend.routers import alerts, citizen, websocket


def jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (130, 190, 240)).save(buf, "JPEG")
    return buf.getvalue()


def test_empty_alerts_do_not_invent_incidents(client):
    assert client.get("/api/v1/alerts").json() == {"count": 0, "items": []}
    response = client.get("/api/v1/alerts/latest")
    assert response.status_code == 204
    assert response.content == b""


def test_alert_since_filters_memory_and_validates_dates(client):
    client.post("/api/v1/alerts/incident", json={"severity": "watch", "measured_pm25": 80})
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/alerts", params={"since": future}).json()["count"] == 0
    for stamp in ("bad-date", "2026-09-06T12:00:00"):
        assert client.get("/api/v1/alerts", params={"since": stamp}).status_code == 422


@pytest.mark.parametrize("field,value", [("severity", "invalid"), ("measured_pm25", -2),
    ("latitude", 91), ("longitude", 181), ("pollutant", "NO2")])
def test_incident_invalid_input(client, field, value):
    payload = {"severity": "watch", "measured_pm25": 70, field: value}
    assert client.post("/api/v1/alerts/incident", json=payload).status_code == 422


def test_photo_is_saved_once_without_image_bytes(client):
    for _ in range(2):
        response = client.post("/api/v1/citizen/photo", files={"photo": ("sky.jpg", jpeg(), "image/jpeg")},
                               data={"latitude": "28.6", "longitude": "77.2"})
        assert response.status_code == 200
    reports = database.get_in_memory_store()["citizen_reports"]
    assert len(reports) == 1
    assert len(reports[0]["photo_hash"]) == 64
    assert reports[0]["latitude"] == 28.6
    assert not any(isinstance(v, bytes) for v in reports[0].values())


def test_photo_coordinates_are_paired(client):
    response = client.post("/api/v1/citizen/photo", files={"photo": ("sky.jpg", jpeg(), "image/jpeg")},
                           data={"latitude": 28.6})
    assert response.status_code == 422


def test_upload_rate_limit_is_enforced(client):
    responses = [client.post("/api/v1/citizen/photo", files={"photo": ("sky.jpg", jpeg(), "image/jpeg")}) for _ in range(11)]
    assert all(r.status_code == 200 for r in responses[:10])
    assert responses[-1].status_code == 429


@pytest.mark.asyncio
async def test_chunked_upload_limited_before_parsing():
    from backend.middleware import UploadLimitMiddleware
    messages = []
    reads = 0
    reached = False

    async def downstream(scope, receive, send):
        nonlocal reached
        try:
            while True:
                await receive()
        except HTTPException as exc:
            assert exc.status_code == 413
            reached = True

    async def receive():
        nonlocal reads
        reads += 1
        return {"type": "http.request", "body": b"a" * 1024 * 1024, "more_body": True}

    await UploadLimitMiddleware(downstream)({"type": "http", "path": "/api/v1/citizen/photo", "headers": []}, receive, AsyncMock())
    assert reached and reads == 6


@pytest.mark.asyncio
async def test_chunked_multipart_returns_413():
    async def body():
        yield b'--test\r\nContent-Disposition: form-data; name="photo"; filename="sky.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'
        for _ in range(7):
            yield b"a" * 1024 * 1024
        yield b"\r\n--test--\r\n"
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/citizen/photo", content=body(),
                                     headers={"Content-Type": "multipart/form-data; boundary=test"})
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_firms_empty_live_response_is_not_replaced(monkeypatch):
    monkeypatch.setenv("FIRMS_MAP_KEY", "test-key")
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:
        httpx.Response(200, text="latitude,longitude,acq_date,acq_time,frp\n"))) as client:
        result = await fetch_firms_hotspots(client=client)
    assert result["features"] == []
    assert "FALLBACK" not in result["source"]


@pytest.mark.asyncio
async def test_firms_error_does_not_log_key(monkeypatch, caplog):
    monkeypatch.setenv("FIRMS_MAP_KEY", "secret-unique-key")
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request:
        httpx.Response(403, text="secret-unique-key"))) as client:
        await fetch_firms_hotspots(client=client)
    assert "secret-unique-key" not in caplog.text


@pytest.mark.asyncio
async def test_openaq_without_measurements_does_not_invent_120():
    def respond(request):
        if "/parameters/" in request.url.path and request.url.path.endswith("/latest"):
            return httpx.Response(200, json={"results": []})
        return httpx.Response(200, json={"results": [{"id": 1, "coordinates": {"latitude": 28.6, "longitude": 77.2},
            "sensors": [{"id": 2, "parameter": {"name": "pm25"}}]}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        assert await fetch_openaq_stations(client=client) == []


@pytest.mark.asyncio
async def test_meteo_wind_units_and_hourly_height():
    def respond(request):
        assert request.url.params["wind_speed_unit"] == "ms"
        return httpx.Response(200, json={"current_units": {"wind_speed_10m": "km/h"},
            "current": {"time": "2026-09-06T12:15", "wind_speed_10m": 36, "wind_direction_10m": 300, "temperature_2m": 22},
            "hourly": {"time": ["2026-09-06T11:00", "2026-09-06T12:00"], "boundary_layer_height": [200, 600]}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await fetch_location_meteo(client, 28.6, 77.2)
    assert result["windspeed_10m"] == 10
    assert result["boundary_layer_height"] == 600
    assert result["source"] == "OPEN_METEO_LIVE"


@pytest.mark.asyncio
async def test_no_demo_data_when_disabled(monkeypatch):
    monkeypatch.setenv("PRANA_DEMO_MODE", "false")
    with pytest.raises(RuntimeError):
        await fetch_firms_hotspots()
    with pytest.raises(RuntimeError):
        await fetch_openaq_stations()


def test_unsupported_station_pollutant_rejected(client):
    assert client.get("/api/v1/aqi/stations?parameter=no2").status_code == 422


@pytest.mark.parametrize("rounds", [0, -1, 101])
def test_fl_run_is_bounded(client, rounds):
    assert client.post(f"/api/v1/federated/run?num_rounds={rounds}").status_code == 422


def test_short_fl_run_reports_complete(client):
    response = client.post("/api/v1/federated/run?num_rounds=2")
    assert response.status_code == 200
    status = client.get("/api/v1/federated/status").json()
    assert status["status"] == "complete" and status["total_rounds"] == 2


def test_fl_metrics_are_measured(monkeypatch):
    from backend.ml.federated.server import FederatedServer
    from backend.ml.federated.model import CorridorPredictor
    monkeypatch.setattr(CorridorPredictor, "evaluate", lambda *args: (1.0, 0.4321))
    result = FederatedServer().run_rounds(2)
    assert all(r["global_accuracy"] == r["punjab_accuracy"] == r["delhi_accuracy"] == 0.4321 for r in result)


def test_incident_broadcast_reaches_websocket(client):
    with client.websocket_connect("/ws/haryana") as ws:
        assert ws.receive_json()["type"] == "snapshot"
        response = client.post("/api/v1/alerts/incident", json={"severity": "warning", "measured_pm25": 150})
        event = ws.receive_json()
        assert event["type"] == "alert"
        assert event["incident_id"] == response.json()["incident_id"]


@pytest.mark.asyncio
async def test_broadcast_deduplicates_and_removes_dead_sockets():
    manager = websocket.ConnectionManager()
    good = AsyncMock()
    dead = AsyncMock()
    dead.send_json.side_effect = RuntimeError("closed")
    manager.active_connections["delhi"] = {good, dead}
    manager.active_connections["ncr"] = {good}
    await manager.broadcast_all({"type": "test"})
    good.send_json.assert_awaited_once()
    assert dead not in manager.active_connections["delhi"]


@pytest.mark.asyncio
async def test_periodic_telemetry_uses_readings():
    socket = AsyncMock()
    websocket.manager.active_connections["haryana"].add(socket)
    database.get_in_memory_store()["aqi_readings"] = [{"state": "Haryana", "pm25_ugm3": 60, "source": "OPENAQ_LIVE"}]
    try:
        await websocket.broadcast_telemetry()
        message = socket.send_json.call_args.args[0]
        assert message["type"] == "aqi_update" and message["aqi_index"] == 100
    finally:
        websocket.manager.active_connections["haryana"].discard(socket)


@pytest.mark.asyncio
async def test_database_config_failure_is_not_success(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://invalid")
    monkeypatch.setattr(database.asyncpg, "create_pool", AsyncMock(side_effect=OSError("failed")))
    with pytest.raises(RuntimeError, match="unavailable"):
        await database.init_db()
    assert database.get_db_pool() is None


def test_readiness_rejects_missing_production_database(client, monkeypatch):
    monkeypatch.setenv("PRANA_ENV", "production")
    assert client.get("/ready").status_code == 503


def test_cpcb_caps_at_500_and_covers_fractional_boundaries():
    for concentration in (30.01, 30.9, 31):
        assert database.compute_cpcb_aqi(concentration) == 51
    assert database.compute_cpcb_aqi(1000) == 500
    with pytest.raises(ValueError):
        database.compute_cpcb_aqi(float("nan"))


def test_satellite_evidence_comes_from_observations(client):
    database.get_in_memory_store()["fire_hotspots"] = [{"latitude": 28.6, "longitude": 77.2,
        "acq_datetime": datetime.now(timezone.utc).isoformat(), "source": "NASA_FIRMS_VIIRS_SNPP_NRT"}]
    result = client.post("/api/v1/alerts/incident", json={"severity": "warning", "measured_pm25": 150,
        "latitude": 28.6, "longitude": 77.2}).json()
    assert result["satellite_evidence"]["fire_count_50km"] == 1
    assert result["satellite_evidence"]["nearest_fire_km"] == 0
    assert result["satellite_source"] == "FIRMS"


@pytest.mark.parametrize("lang,word", [("hi", "वायु"), ("pa", "ਹਵਾ")])
def test_alert_translations(client, lang, word):
    client.post("/api/v1/alerts/incident", json={"severity": "watch", "measured_pm25": 70})
    assert word in client.get("/api/v1/alerts/latest", params={"lang": lang}).json()["title"]
