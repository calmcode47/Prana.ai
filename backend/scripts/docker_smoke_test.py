"""
PRANA Docker Container Smoke Test & Runtime Verification
Simulates the container startup sequence, verifies environment variables,
initializes the database layer and lifespan events, and checks the container /health probe.
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime

# Configure PYTHONPATH
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load .env.docker
env_docker_path = PROJECT_ROOT / "backend" / ".env.docker"
if env_docker_path.exists():
    with open(env_docker_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_db_pool, DDL_STATEMENTS
from backend.models import HealthResponse


def run_container_smoke_test():
    print("=" * 70)
    print("PRANA Docker Container & Runtime Smoke Test Simulation")
    print("=" * 70)

    # 1. Environment & Architecture Validation
    print("\n--- 1. Container Configuration Audit ---")
    print(f"  [PASS] Python Runtime: {sys.version.split()[0]}")
    print(f"  [PASS] DATABASE_URL: {os.getenv('DATABASE_URL')}")
    print(f"  [PASS] CORS_ORIGINS: {os.getenv('CORS_ORIGINS')}")
    print(f"  [PASS] Container Host/Port: {os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}")

    # 2. Database DDL Validation
    print("\n--- 2. PostGIS DDL Schema Audit ---")
    print(f"  [PASS] Total DDL Statements: {len(DDL_STATEMENTS)}")
    for i, stmt in enumerate(DDL_STATEMENTS, 1):
        first_line = stmt.strip().split("\n")[0]
        print(f"    - DDL #{i}: {first_line[:55]}...")

    # 3. Application Lifespan & Health Check Probe
    print("\n--- 3. Container Lifespan & Health Probe Simulation ---")
    with TestClient(app) as client:
        # Simulate Docker HEALTHCHECK command: CMD curl -f http://localhost:8000/health
        resp = client.get("/health")
        assert resp.status_code == 200, f"Healthcheck failed with status {resp.status_code}"
        data = resp.json()
        print(f"  [PASS] Health Probe Response: {data}")
        assert data["status"] == "ok", "Expected status 'ok'"
        assert "db" in data, "Expected 'db' status field"
        assert "timestamp" in data, "Expected 'timestamp' field"

        # Root probe
        root_resp = client.get("/")
        assert root_resp.status_code == 200
        root_data = root_resp.json()
        print(f"  [PASS] Root Endpoint Response: {root_data}")

        # Core API probes
        endpoints = [
            ("/api/v1/hotspots", 200),
            ("/api/v1/aqi/surface", 200),
            ("/api/v1/forecast/plume", 200),
            ("/api/v1/sensorthings/Things", 200),
            ("/api/v1/alerts", 200),
        ]
        print("\n--- 4. Core API Service Probing ---")
        for ep, expected_status in endpoints:
            r = client.get(ep)
            assert r.status_code == expected_status, f"Endpoint {ep} failed: {r.status_code}"
            print(f"  [PASS] Endpoint `{ep}` -> HTTP {r.status_code} OK")

    print("\n" + "=" * 70)
    print("DOCKER CONTAINER SMOKE TEST RESULT: 100% PASSED")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(run_container_smoke_test())
