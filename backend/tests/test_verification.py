"""Verification must fail closed, preserve settings, and never expose credentials."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock
import pytest
from backend.scripts import verify_live, verify_deployment, migrate_db


@pytest.mark.asyncio
async def test_missing_credentials_are_blocked(monkeypatch):
    report = await verify_live.verify(["firms", "openaq"])
    assert all(row["status"] == "blocked" for row in report["checks"])
    assert verify_live.exit_code(report) == 2
    assert verify_live.os.environ["PRANA_DEMO_MODE"] == "true"


@pytest.mark.asyncio
async def test_provider_failure_redacts_error_and_disables_demo(monkeypatch):
    async def failed_probe(name):
        assert verify_live.os.environ["PRANA_DEMO_MODE"] == "false"
        raise RuntimeError("secret-token-in-url")
    monkeypatch.setattr(verify_live, "probe", failed_probe)
    report = await verify_live.verify(["meteo"])
    assert verify_live.exit_code(report) == 1
    assert "secret-token" not in str(report)
    assert verify_live.os.environ["PRANA_DEMO_MODE"] == "true"


@pytest.mark.parametrize("field,value", [("source", "DEMO_STATIC"), ("windspeed_10m", float("nan")),
    ("wind_speed_unit", "km/h"), ("timestamp", "2025-01-01T00:00:00Z")])
def test_weather_verifier_rejects_bad_data(field, value):
    row = dict(source="OPEN_METEO_LIVE", wind_speed_unit="m/s", windspeed_10m=2,
               winddirection_10m=300, boundary_layer_height=800, temperature_2m=25,
               longitude=77.2, latitude=28.6, timestamp=datetime.now(timezone.utc).isoformat())
    row[field] = value
    with pytest.raises(ValueError):
        verify_live.validate_meteo({"punjab": row, "delhi": row})


@pytest.mark.parametrize("data", [dict(status="ready", db="in-memory", demo_mode=False),
    dict(status="ready", db="connected", demo_mode=True), dict(status="unavailable", db="connected", demo_mode=False)])
def test_production_readiness_rejects_degraded_backend(data):
    with pytest.raises(ValueError):
        verify_deployment.validate_ready(data)


def test_deployment_url_and_local_exception():
    with pytest.raises(ValueError):
        verify_deployment.base_url("http://example.com")
    with pytest.raises(ValueError):
        verify_deployment.base_url("http://example.com", local=True)
    with pytest.raises(ValueError):
        verify_deployment.base_url("https://user:secret@example.com")
    assert verify_deployment.base_url("http://127.0.0.1:8000/", True) == "http://127.0.0.1:8000"
    verify_deployment.validate_ready(dict(status="ready", db="connected", demo_mode=True), True)


@pytest.mark.asyncio
async def test_migration_requires_database_and_closes_on_failure(monkeypatch):
    with pytest.raises(RuntimeError):
        await migrate_db.migrate()
    monkeypatch.setenv("DATABASE_URL", "test")
    monkeypatch.setattr(migrate_db, "init_db", AsyncMock(side_effect=RuntimeError("failure")))
    close = AsyncMock()
    monkeypatch.setattr(migrate_db, "close_db", close)
    with pytest.raises(RuntimeError):
        await migrate_db.migrate()
    close.assert_awaited_once()
