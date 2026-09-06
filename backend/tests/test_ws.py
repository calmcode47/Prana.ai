"""
WebSocket Tests (REQ-011, DEC-010)
Verifies WebSocket connection, immediate snapshot with both units, and message formats.
"""

from fastapi.testclient import TestClient
from backend.main import app


def test_websocket_snapshot():
    """
    Tests that connecting to /ws/delhi immediately yields a snapshot
    containing both delhi_pm25_ugm3 and delhi_aqi_index per DEC-010.
    """
    client = TestClient(app)
    with client.websocket_connect("/ws/delhi") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "snapshot"
        assert "fire_count" in data
        assert "delhi_pm25_ugm3" in data
        assert "delhi_aqi_index" in data
        assert data["delhi_pm25_ugm3"] > 0
        assert data["delhi_aqi_index"] > 0

        # Send ping, expect pong
        websocket.send_text("ping")
        resp = websocket.receive_text()
        assert resp == "pong"
