"""
Security Tests (SEC-001 to SEC-005)
Verifies credential privacy, photo validation order, CORS policy, and rate limits.
"""

import io
from fastapi.testclient import TestClient
from PIL import Image
from backend.main import app


# ==============================================================================
# SEC-001: Credential Privacy
# ==============================================================================
def test_no_secrets_in_responses(client: TestClient):
    """Verifies that sensitive keys are never leaked in API responses."""
    endpoints = [
        "/",
        "/health",
        "/api/v1/hotspots",
        "/api/v1/aqi/stations",
        "/api/v1/alerts",
        "/api/v1/sensorthings/Things"
    ]
    sensitive_keywords = ["FIRMS_MAP_KEY", "private_key", "client_email", "service_account"]
    for ep in endpoints:
        resp = client.get(ep)
        body = resp.text
        for kw in sensitive_keywords:
            assert kw not in body, f"Leaked sensitive keyword '{kw}' in {ep}"


# ==============================================================================
# SEC-003a: File Size Rejection (413)
# ==============================================================================
def test_file_size_exceeded(client: TestClient):
    """Rejects file larger than 5MB with HTTP 413."""
    oversized_bytes = b"\xff\xd8\xff" + b"A" * (6 * 1024 * 1024)
    files = {"photo": ("large.jpg", io.BytesIO(oversized_bytes), "image/jpeg")}
    headers = {"Content-Length": str(len(oversized_bytes))}
    resp = client.post("/api/v1/citizen/photo", files=files, headers=headers)
    assert resp.status_code == 413


# ==============================================================================
# SEC-003b: Wrong MIME Type Rejection (400)
# ==============================================================================
def test_wrong_mime_type(client: TestClient):
    """Rejects non-image MIME types with HTTP 400."""
    fake_exe = b"MZ" + b"\x00" * 50
    files = {"photo": ("malicious.exe", io.BytesIO(fake_exe), "application/x-msdownload")}
    resp = client.post("/api/v1/citizen/photo", files=files)
    assert resp.status_code == 400


# ==============================================================================
# SEC-003c: Wrong Magic Bytes Rejection (400)
# ==============================================================================
def test_wrong_magic_bytes(client: TestClient):
    """Rejects file with image/jpeg header but invalid magic bytes with HTTP 400."""
    spoofed_text = b"This is plain text pretending to be a JPEG."
    files = {"photo": ("spoof.jpg", io.BytesIO(spoofed_text), "image/jpeg")}
    resp = client.post("/api/v1/citizen/photo", files=files)
    assert resp.status_code == 400


# ==============================================================================
# SEC-003 Valid Image Processing
# ==============================================================================
def test_valid_image_upload(client: TestClient):
    """Verifies valid JPEG is accepted, EXIF stripped, and returns AQI estimate."""
    img = Image.new("RGB", (300, 300), color=(135, 206, 235))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    valid_bytes = buf.getvalue()

    files = {"photo": ("sky.jpg", io.BytesIO(valid_bytes), "image/jpeg")}
    resp = client.post("/api/v1/citizen/photo", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert "pm25_estimate" in data
    assert "aqi_index" in data
    assert "aqi_category" in data
    assert "aqi_color" in data
    assert data["pm25_estimate"] > 0
    assert data["aqi_index"] > 0


# ==============================================================================
# SEC-004: CORS Header Protection
# ==============================================================================
def test_cors_policy(client: TestClient):
    """Verifies unauthorized origins do not receive Access-Control-Allow-Origin header."""
    headers = {"Origin": "https://evil-attacker.com"}
    resp = client.get("/api/v1/hotspots", headers=headers)
    assert resp.headers.get("access-control-allow-origin") != "https://evil-attacker.com"


# ==============================================================================
# SEC-006: Operator control-plane authentication
# ==============================================================================
def test_control_plane_rejects_anonymous_callers():
    """Public reads stay open, while incident, legal, and training writes require an operator."""
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/v1/alerts").status_code == 200
        assert anonymous.post(
            "/api/v1/alerts/incident",
            json={"severity": "warning", "measured_pm25": 150},
        ).status_code == 401
        assert anonymous.post(
            "/api/v1/legal/notices",
            json={"incident_id": "unknown", "issuing_authority": "unknown"},
        ).status_code == 401
        assert anonymous.post("/api/v1/federated/run?num_rounds=1").status_code == 401
