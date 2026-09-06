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
