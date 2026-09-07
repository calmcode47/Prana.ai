"""Regression tests for backend capabilities represented in the product UI."""
import io
import zipfile
from datetime import datetime, timedelta, timezone

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


def test_cems_ingestion_and_forensic_indicator(client):
    now = datetime.now(timezone.utc)
    readings = []
    for index in range(4):
        readings.append({"facility_id": "FAC-1", "measured_at": (now - timedelta(minutes=20-index*5)).isoformat(),
                         "stack_velocity_ms": 10, "scrubber_load_kw": 100, "source": "test"})
    readings.append({"facility_id": "FAC-1", "measured_at": now.isoformat(),
                     "stack_velocity_ms": 15, "scrubber_load_kw": 10, "source": "test"})
    response = client.post("/api/v1/industrial/cems/readings", json={"readings": readings})
    assert response.status_code == 202 and response.json()["accepted"] == 5
    result = client.get("/api/v1/industrial/cems/FAC-1/forensics").json()
    assert result["status"] == "REVIEW_REQUIRED"
    assert result["review_windows"][0]["classification"] == "REVIEW_REQUIRED"


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
