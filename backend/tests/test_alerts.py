"""
Unit and Integration Tests for Alerts & Incidents (REQ-010, REQ-015)
Verifies incident creation, server-side AQI calculation, and retrieval.
"""

from fastapi.testclient import TestClient


def test_incident_lifecycle(client: TestClient):
    """
    Tests creating an SPCB incident ticket and verifying server-side calculated AQI.
    """
    payload = {
        "severity": "warning",
        "location_text": "Rohtak, Haryana",
        "latitude": 28.895,
        "longitude": 76.607,
        "pollutant": "PM2.5",
        "measured_pm25": 145.0,
        "satellite_source": "TROPOMI",
        "authority": "HSPCB"
    }

    # 1. Create Incident
    post_resp = client.post("/api/v1/alerts/incident", json=payload)
    assert post_resp.status_code == 201
    created = post_resp.json()
    assert created["incident_id"].startswith("INC-")
    assert created["severity"] == "warning"
    assert created["measured_pm25"] == 145.0
    # CPCB calculated AQI for 145 ug/m3 should be between 301 and 400 (Very Poor)
    assert created["measured_aqi"] is not None
    assert 301 <= created["measured_aqi"] <= 400

    # 2. Retrieve Alerts List
    get_resp = client.get("/api/v1/alerts?limit=10")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["count"] >= 1
    ids = [item["incident_id"] for item in data["items"]]
    assert created["incident_id"] in ids

    # 3. Retrieve Latest Alert
    latest_resp = client.get("/api/v1/alerts/latest")
    assert latest_resp.status_code == 200
    latest = latest_resp.json()
    assert "incident_id" in latest
    assert "severity" in latest
    assert "title" in latest
    assert "body" in latest
