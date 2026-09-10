"""Real PostGIS regression suite, restricted to an explicitly named test database."""
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
import pytest

from backend.main import app
from backend import database
from backend.ingesters.ingest_firms import persist_hotspots
from backend.ingesters.ingest_openaq import persist_aqi_readings, persist_pollutants
from backend.tests.test_regressions import jpeg

pytestmark = [pytest.mark.postgis, pytest.mark.asyncio]


async def test_postgis_persistence_and_restart(monkeypatch):
    url = os.getenv("PRANA_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set PRANA_TEST_DATABASE_URL to a dedicated database ending in _test")
    if not urlparse(url).path.endswith("_test"):
        pytest.fail("Refusing to reset a database whose name does not end in _test")
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("PRANA_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("PRANA_ENV", "development")
    async with app.router.lifespan_context(app):
        pool = database.get_db_pool()
        assert pool is not None
        async with pool.acquire() as conn:
            assert await conn.fetchval("SELECT PostGIS_Version()")
            await conn.execute("TRUNCATE fire_hotspots,aqi_readings,forecast_zones,anomaly_flags,citizen_reports,incidents,fl_rounds,pollutant_readings,legal_notices,enforcement_dispatches,cems_readings RESTART IDENTITY CASCADE")
        stamp = datetime.now(timezone.utc).isoformat()
        fire = {"latitude": 30.5, "longitude": 75.5, "acq_datetime": stamp, "frp": 10,
                "brightness": 330, "confidence": "high", "sensor": "VIIRS_SNPP", "source": "TEST"}
        reading = {"station_id": "TEST-DL", "name": "Test station", "city": "Delhi", "state": "Delhi",
                   "latitude": 28.6, "longitude": 77.2, "pm25_ugm3": 60, "measured_at": stamp, "source": "TEST"}
        for _ in range(2):
            await persist_hotspots([fire])
            await persist_aqi_readings([reading])
            await persist_pollutants([{"station_id": "TEST-DL", "parameter": "no2", "value": 40,
                "unit": "ug/m3", "measured_at": stamp, "source": "TEST"}])
        async with pool.acquire() as conn:
            for table in ("fire_hotspots", "aqi_readings", "pollutant_readings"):
                assert await conn.fetchval(f"SELECT count(*) FROM {table}") == 1
        # A failed batch must not publish a partial completed training run.
        from backend.ml.federated.server import save_fl_rounds
        prior = [dict(r) for r in database.get_in_memory_store()["fl_rounds"]]
        metric = dict(run_id="FL-ROLLBACK-TEST", round_number=1, punjab_accuracy=0.2,
                      delhi_accuracy=0.3, global_accuracy=0.4)
        with pytest.raises(RuntimeError, match="could not be saved"):
            await save_fl_rounds([metric, {**metric, "round_number": 2, "global_accuracy": None}])
        async with pool.acquire() as conn:
            assert await conn.fetchval("SELECT count(*) FROM fl_rounds WHERE run_id=$1", metric["run_id"]) == 0
        assert database.get_in_memory_store()["fl_rounds"] == prior
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer test-operator-key"},
        ) as client:
            assert (await client.get("/ready")).json()["db"] == "connected"
            monkeypatch.setenv("PRANA_DEMO_MODE", "false")
            assert (await client.get("/api/v1/aqi/stations")).json()["value"] == []
            assert (await client.get("/api/v1/hotspots")).json()["features"] == []
            from backend.routers.websocket import build_snapshot
            assert (await build_snapshot("delhi"))["fire_count"] == 0
            monkeypatch.setenv("PRANA_DEMO_MODE", "true")
            result = await client.post("/api/v1/alerts/incident", json={"severity": "warning", "measured_pm25": 140})
            assert result.status_code == 201
            incident_id = result.json()["incident_id"]
            for _ in range(2):
                photo = await client.post("/api/v1/citizen/photo", files={"photo": ("sky.jpg", jpeg(), "image/jpeg")},
                                          data={"latitude": 28.6, "longitude": 77.2})
                assert photo.status_code == 200
            assert (await client.get("/api/v1/aqi/stations?state=Punjab")).json()["value"] == []
            assert (await client.get("/api/v1/alerts?severity=emergency")).json()["items"] == []
            fl = await client.post("/api/v1/federated/run?num_rounds=2")
            assert fl.status_code == 200
            run_id = fl.json()["run_id"]
        from backend.ml.trajectory import persist_forecasts
        feature = {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[75,30],[76,30],[76,31],[75,30]]]},
            "properties": {"cluster_id": "TEST-CLU", "horizon_hours": 24, "max_pm25_est": 100,
                           "wind_speed_ms": 4, "wind_dir_deg": 315, "mixing_height_m": 600}}
        await persist_forecasts([feature])
        await persist_forecasts([feature])
        async with pool.acquire() as conn:
            assert await conn.fetchval("SELECT count(*) FROM forecast_zones") == 1
            assert await conn.fetchval("SELECT ST_IsValid(geom) FROM forecast_zones")
            assert await conn.fetchval("SELECT count(*) FROM citizen_reports") == 1
            assert await conn.fetchval("SELECT ST_X(geom) FROM citizen_reports") == 77.2
            assert await conn.fetchval("SELECT ST_Y(geom) FROM citizen_reports") == 28.6
    # Drop process caches and reconnect: responses must still come from persisted data.
    for records in database.get_in_memory_store().values():
        records.clear()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            alerts = (await client.get("/api/v1/alerts")).json()["items"]
            assert alerts[0]["incident_id"] == incident_id
            assert alerts[0]["satellite_evidence"] is None
            status = (await client.get("/api/v1/federated/status")).json()
            assert status["run_id"] == run_id and status["status"] == "complete"
            stations = (await client.get("/api/v1/aqi/stations")).json()["value"]
            assert stations[0]["Datastreams"][0]["Observations"][0]["aqi_index"] == 100
