"""
Pytest configuration and shared fixtures for PRANA backend tests.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def pytest_configure(config):
    config.addinivalue_line("markers", "postgis: requires PRANA_TEST_DATABASE_URL dedicated test database")
    config.addinivalue_line(
        "markers", "integration: mark test as integration test hitting live external APIs (skipped in CI)"
    )


@pytest.fixture
def firms_sample_csv() -> str:
    """Returns sample FIRMS CSV response text."""
    path = FIXTURES_DIR / "firms_sample_response.csv"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def openaq_locations_json() -> dict:
    """Returns sample OpenAQ locations JSON."""
    path = FIXTURES_DIR / "openaq_locations_response.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def openaq_measurements_json() -> dict:
    """Returns sample OpenAQ measurements JSON."""
    path = FIXTURES_DIR / "openaq_measurements_response.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def open_meteo_json() -> dict:
    """Returns sample Open-Meteo forecast JSON."""
    path = FIXTURES_DIR / "open_meteo_response.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def client():
    """Synchronous TestClient targeting the PRANA FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def isolated_runtime(monkeypatch, request):
    """Unit tests never contact live providers or mutate a configured user database."""
    if request.node.get_closest_marker("integration") or request.node.get_closest_marker("postgis"):
        yield
        return
    from backend.database import get_in_memory_store
    from backend.ingesters.memo import _cache
    from backend.routers.citizen import limiter
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)
    monkeypatch.delenv("OPENAQ_API_KEY", raising=False)
    monkeypatch.setenv("PRANA_ENV", "development")
    monkeypatch.setenv("PRANA_DEMO_MODE", "true")
    monkeypatch.setenv("PRANA_SCHEDULER_ENABLED", "false")
    # Expensive privacy protocols have focused unit tests; general API tests use plain FedAvg.
    monkeypatch.setenv("PRANA_FL_PAILLIER_ENABLED", "false")
    monkeypatch.setenv("PRANA_FL_DP_ENABLED", "false")
    import httpx
    async def no_live_network(*args, **kwargs):
        raise httpx.ConnectError("Live network disabled in unit tests")
    if request.node.name not in ("test_openaq_fetch_mocked", "test_meteo_fetch_mocked"):
        monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", no_live_network)
    _cache.clear()
    for records in get_in_memory_store().values():
        records.clear()
    limiter.reset()
    yield
    _cache.clear()
