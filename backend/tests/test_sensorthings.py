"""
OGC SensorThings Tests (REQ-014)
Verifies SensorThings Things schema and 2-node corridor representation.
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
    assert data["@iot.count"] == 2
    assert "value" in data
    assert len(data["value"]) == 2

    node_ids = [n["@iot.id"] for n in data["value"]]
    assert "punjab-node-001" in node_ids
    assert "delhi-node-001" in node_ids

    for node in data["value"]:
        assert "Locations" in node
        loc = node["Locations"][0]
        assert loc["encodingType"] == "application/geo+json"
        assert loc["location"]["type"] == "Point"
        assert len(loc["location"]["coordinates"]) == 2
