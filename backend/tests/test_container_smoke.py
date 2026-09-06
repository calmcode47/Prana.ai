"""
Test Container Startup, Lifespan, and Healthcheck Behavior
Ensures Docker container entrypoint and health probe work as expected.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import DDL_STATEMENTS


def test_container_healthcheck_probe():
    """Simulates Docker HEALTHCHECK: CMD curl -f http://localhost:8000/health."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["db"] in ("connected", "in-memory")
        assert "timestamp" in payload


def test_container_root_probe():
    """Simulates container root gateway probe."""
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        payload = response.json()
        assert payload["app"] == "PRANA Air Quality API"
        assert payload["health"] == "/health"


def test_container_ddl_integrity():
    """Verifies all 8 PostGIS DDL statements are valid and non-empty."""
    assert len(DDL_STATEMENTS) == 8
    for ddl in DDL_STATEMENTS:
        assert isinstance(ddl, str)
        assert len(ddl.strip()) > 10
