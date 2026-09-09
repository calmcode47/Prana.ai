"""
OGC SensorThings Tests (REQ-014)
Verifies SensorThings Things schema derived from current observations.
"""

from fastapi.testclient import TestClient


def test_things_schema(client: TestClient):
    """
    Tests GET /api/v1/sensorthings/Things schema compliance.
    """
    resp = client.get("/api/v1/sensorthings/Things")
    assert resp.status_code == 200
    data = resp.json()

    assert "@iot.count" in data
    assert "value" in data
    assert data["@iot.count"] == len(data["value"])
    assert data["@iot.count"] > 0

    for node in data["value"]:
        assert "Locations" in node
        loc = node["Locations"][0]
        assert loc["encodingType"] == "application/geo+json"
        assert loc["location"]["type"] == "Point"
        assert len(loc["location"]["coordinates"]) == 2
        assert node["properties"]["source"]
        assert node["properties"]["measured_at"]
