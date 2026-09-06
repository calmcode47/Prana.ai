"""
Citizen Photo Haze Estimation Tests (REQ-009, SEC-003, SEC-005)
Verifies latency (< 3s), PM2.5 range, CPCB AQI computation, and MC confidence.
"""

import io
import time
from fastapi.testclient import TestClient
from PIL import Image

from backend.ml.haze_estimator import estimate_pm25_from_photo


def test_dcp_haze_estimator_direct():
    """Verifies direct execution of the Dark Channel Prior haze estimator."""
    img = Image.new("RGB", (224, 224), color=(120, 180, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    start = time.perf_counter()
    res = estimate_pm25_from_photo(img_bytes)
    duration_ms = (time.perf_counter() - start) * 1000

    assert duration_ms < 3000.0, f"Execution took {duration_ms}ms, exceeding 3000ms SLA"
    assert "pm25_estimate" in res
    assert "confidence" in res
    assert res["confidence"] in ("high", "medium", "low")
    assert "aqi_index" in res
    assert "aqi_category" in res
    assert "aqi_color" in res
    assert 15.0 <= res["pm25_estimate"] <= 500.0
    assert res["aqi_index"] > 0


def test_citizen_photo_upload_endpoint(client: TestClient):
    """Verifies POST /api/v1/citizen/photo executes DCP inference in < 3000ms."""
    # Create clear sky blue image
    img = Image.new("RGB", (256, 256), color=(135, 206, 235))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid_bytes = buf.getvalue()

    files = {"photo": ("sky.jpg", io.BytesIO(valid_bytes), "image/jpeg")}
    start = time.perf_counter()
    resp = client.post("/api/v1/citizen/photo", files=files)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert resp.status_code == 200
    assert elapsed_ms < 3000.0
    data = resp.json()
    assert data["pm25_estimate"] > 0
    assert data["aqi_index"] > 0
    assert data["confidence"] in ("high", "medium", "low")
    assert data["processing_time_ms"] < 3000
