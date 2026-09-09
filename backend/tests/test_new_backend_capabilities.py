"""Regression tests for backend capabilities represented in the product UI."""
import io
import zipfile
from datetime import datetime, timedelta, timezone

import pytest

from backend.routers.operations import lag_correlations
from backend.scripts.validate_real_world import evaluate_csv, REPO_ROOT


def _incident(client):
    response = client.post("/api/v1/alerts/incident", json={
        "severity": "warning", "location_text": "Test corridor", "latitude": 28.6,
        "longitude": 77.2, "measured_pm25": 140,
    })
    assert response.status_code == 201
    return response.json()["incident_id"]


def test_legal_drafts_registry_and_dossier(client):
    incident_id = _incident(client)
    created = client.post("/api/v1/legal/notices", json={
        "incident_id": incident_id, "issuing_authority": "Test Pollution Control Board",
        "requested_direction": "Review the recorded evidence and select any lawful action.",
    })
    assert created.status_code == 201
    notice = created.json()
    assert notice["status"] == "DRAFT" and len(notice["document_sha256"]) == 64
    pdf = client.get(f"/api/v1/legal/notices/{notice['notice_id']}/document.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    certificate = client.get(f"/api/v1/legal/notices/{notice['notice_id']}/evidence-certificate.pdf")
    assert certificate.status_code == 200 and certificate.content.startswith(b"%PDF")
    signature = client.get(f"/api/v1/legal/notices/{notice['notice_id']}/signature-package").json()
    assert signature["status"] == "PROVIDER_NOT_CONFIGURED"
    assert signature["provider_call_performed"] is False
    dispatch = client.post("/api/v1/legal/dispatches", json={
        "incident_id": incident_id, "notice_id": notice["notice_id"],
        "recipient_kind": "district_magistrate", "recipient_reference": "TEST-DM",
    }).json()
    assert dispatch["status"] == "PENDING_CONFIGURATION" and dispatch["message_sent"] is False
    registry = client.get("/api/v1/legal/registry").json()
    assert registry["warrants"] == [] and len(registry["notices"]) == 1
    dossier = client.get(f"/api/v1/legal/dossiers/{incident_id}.zip")
    with zipfile.ZipFile(io.BytesIO(dossier.content)) as archive:
        assert set(archive.namelist()) == {"incident.json", "notices.json", "evidence.geojson", "manifest.json"}


def test_cems_ingestion_and_forensic_indicator(client, monkeypatch):
    monkeypatch.setenv("CEMS_INGEST_API_KEY", "unit-test-cems-key")
    now = datetime.now(timezone.utc)
    readings = []
    for index in range(4):
        readings.append({"facility_id": "FAC-1", "measured_at": (now - timedelta(minutes=20-index*5)).isoformat(),
                         "stack_velocity_ms": 10, "scrubber_load_kw": 100, "source": "test"})
    readings.append({"facility_id": "FAC-1", "measured_at": now.isoformat(),
                     "stack_velocity_ms": 15, "scrubber_load_kw": 10, "source": "test"})
    response = client.post("/api/v1/industrial/cems/readings", json={"readings": readings},
                           headers={"X-CEMS-Key": "unit-test-cems-key"})
    assert response.status_code == 202 and response.json()["accepted"] == 5
    result = client.get("/api/v1/industrial/cems/FAC-1/forensics",
                        headers={"X-CEMS-Key": "unit-test-cems-key"}).json()
    assert result["status"] == "REVIEW_REQUIRED"
    assert result["review_windows"][0]["classification"] == "REVIEW_REQUIRED"


def test_cems_ingestion_fails_closed_without_a_key(client, monkeypatch):
    monkeypatch.delenv("CEMS_INGEST_API_KEY", raising=False)
    response = client.post("/api/v1/industrial/cems/readings", json={"readings": [{
        "facility_id": "FAC-1", "measured_at": datetime.now(timezone.utc).isoformat(),
        "stack_velocity_ms": 10, "scrubber_load_kw": 100, "source": "test",
    }]})
    assert response.status_code == 503


def test_meteorology_and_auxiliary_endpoints(client, monkeypatch, open_meteo_json):
    async def fake_meteo():
        row = {"latitude": 30.0, "longitude": 76.0, "windspeed_10m": 5,
               "winddirection_10m": 270, "boundary_layer_height": 500,
               "timestamp": "2026-09-07T00:00:00Z", "source": "OPEN_METEO_LIVE",
               "hourly": {"boundary_layer_height": [400, 600]}}
        return {"punjab": row, "delhi": {**row, "latitude": 28.6, "longitude": 77.2},
                "fetched_at": "2026-09-07T00:00:00Z"}
    monkeypatch.setattr("backend.routers.operations.fetch_meteo_forecast", fake_meteo)
    weather = client.get("/api/v1/meteorology").json()
    assert weather["regions"]["punjab"]["wind"]["eastward_ms"] == 5.0
    assert weather["inversion"]["status"] == "not_measured"
    assert client.get("/api/v1/mobile/releases/latest").status_code == 204
    assert client.get("/api/v1/briefings/feed.xml").headers["content-type"].startswith("application/rss+xml")
    requirements = client.get("/api/v1/integrations/requirements").json()
    assert any(item["service"] == "NASA FIRMS" for item in requirements["items"])


def test_mobile_push_registration_is_persisted(client):
    token = "ExponentPushToken[abcdefghijklmnopqrstuvwxyz012345]"
    response = client.post("/api/v1/mobile/push/register", json={
        "expo_push_token": token,
        "platform": "android",
    })
    assert response.status_code == 201
    from backend.database import get_in_memory_store
    assert get_in_memory_store()["mobile_push_tokens"][0]["push_token"] == token
    assert client.post("/api/v1/mobile/push/register", json={
        "expo_push_token": "not-a-real-token",
        "platform": "android",
    }).status_code == 422


def test_briefing_uses_na_when_tts_is_not_configured(client, monkeypatch):
    monkeypatch.delenv("TTS_PROVIDER_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    incident_id = _incident(client)
    briefing = client.get("/api/v1/briefings/latest").json()
    assert briefing["incident_id"] == incident_id
    assert briefing["script"]
    assert briefing["audio_url"] is None
    assert briefing["audio_status"].startswith("N/A")


def test_public_briefing_read_never_calls_tts_provider(client, monkeypatch):
    from unittest.mock import AsyncMock
    import backend.tts as tts

    monkeypatch.setenv("TTS_PROVIDER_KEY", "configured-but-not-used-by-get")
    provider_call = AsyncMock()
    monkeypatch.setattr(tts.httpx.AsyncClient, "post", provider_call)
    _incident(client)
    briefing = client.get("/api/v1/briefings/latest").json()
    assert briefing["audio_url"] is None
    assert briefing["audio_status"].startswith("N/A")
    provider_call.assert_not_awaited()


def test_tts_generation_endpoint_fails_closed_without_operator_key(client, monkeypatch):
    monkeypatch.delenv("PRANA_OPERATOR_API_KEY", raising=False)
    _incident(client)
    response = client.post("/api/v1/briefings/latest/audio")
    assert response.status_code == 503


def test_operator_can_explicitly_generate_briefing_audio(client, monkeypatch):
    from unittest.mock import AsyncMock

    monkeypatch.setenv("PRANA_OPERATOR_API_KEY", "operator-test-key")
    generator = AsyncMock(return_value=("briefing-test.mp3", "generated"))
    monkeypatch.setattr("backend.routers.operations.ensure_briefing_audio", generator)
    incident_id = _incident(client)
    response = client.post("/api/v1/briefings/latest/audio",
                           headers={"X-Operator-Key": "operator-test-key"})
    assert response.status_code == 200
    assert response.json()["incident_id"] == incident_id
    assert response.json()["audio_url"].endswith("/media/briefings/briefing-test.mp3")
    generator.assert_awaited_once()


def test_non_upload_request_body_limit(client):
    response = client.post("/api/v1/alerts/incident", content=b"x" * (256 * 1024 + 1),
                           headers={"Content-Type": "application/json"})
    assert response.status_code == 413


def test_stale_station_observation_is_not_presented_as_live(client, monkeypatch):
    from backend.database import get_in_memory_store
    import httpx

    monkeypatch.setenv("PRANA_DEMO_MODE", "false")
    get_in_memory_store()["aqi_readings"].append({
        "station_id": "stale-1", "name": "Stale", "state": "Delhi",
        "latitude": 28.6, "longitude": 77.2, "pm25_ugm3": 88,
        "parameter": "pm25", "source": "OPENAQ_LIVE",
        "measured_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    })

    async def unavailable(*_args, **_kwargs):
        raise httpx.ConnectError("provider unavailable")

    monkeypatch.setattr("backend.routers.aqi.fetch_openaq_stations", unavailable)
    response = client.get("/api/v1/aqi/stations")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_tts_writes_real_provider_audio_atomically(tmp_path, monkeypatch):
    import backend.tts as tts

    class AudioResponse:
        headers = {"content-type": "audio/mpeg"}
        content = b"ID3" + (b"\0" * 256)

        @staticmethod
        def raise_for_status():
            return None

    async def fake_post(_client, _url, **_kwargs):
        return AudioResponse()

    monkeypatch.setenv("TTS_PROVIDER_KEY", "test-provider-key")
    monkeypatch.setattr(tts, "AUDIO_DIR", tmp_path)
    monkeypatch.setattr(tts.httpx.AsyncClient, "post", fake_post)

    filename, status = await tts.ensure_briefing_audio("incident-1", "A real briefing")

    assert status == "generated"
    assert filename is not None
    assert (tmp_path / filename).read_bytes().startswith(b"ID3")
    assert not list(tmp_path.glob("*.tmp"))


def test_lag_correlation_uses_observed_pairs():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    fires = [{"bucket": start + timedelta(hours=i), "fire_count": i, "frp_sum": 0} for i in range(12)]
    aqi = [{"bucket": start + timedelta(hours=i + 2), "pm25": i * 10} for i in range(12)]
    rows = lag_correlations(fires, aqi, max_lag_hours=2, step_hours=1)
    assert next(row for row in rows if row["lag_hours"] == 2)["pearson_r"] == 1.0


def test_real_world_evaluator_reads_local_csv_only():
    path = REPO_ROOT / "backend" / ".local" / "test-paired-observations.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("model,predicted,observed\n" + "\n".join(
        f"plume,{value + 1},{value}" for value in range(10)) + "\n", encoding="utf-8")
    try:
        report = evaluate_csv(path)
        result = report["results"][0]
        assert result["sample_count"] == 10 and result["mae"] == 1.0 and result["bias"] == 1.0
    finally:
        path.unlink(missing_ok=True)
