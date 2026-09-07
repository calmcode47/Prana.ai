"""Physical invariants of the simplified model; not scientific field validation."""
from unittest.mock import AsyncMock
import numpy as np
import pytest
from backend.ml import trajectory


def inputs(monkeypatch, frp=10, speed=2, direction=270, height=500):
    fire = {"source": "TEST", "features": [{"geometry": {"coordinates": [75.0, 30.0]},
                                             "properties": {"frp": frp}}]}
    monkeypatch.setattr(trajectory, "fetch_firms_hotspots", AsyncMock(return_value=fire))
    weather = AsyncMock(return_value={"punjab": dict(windspeed_10m=speed, winddirection_10m=direction,
                                                     boundary_layer_height=height, source="TEST")})
    monkeypatch.setattr(trajectory, "fetch_meteo_forecast", weather)
    monkeypatch.setattr(trajectory, "persist_forecasts", AsyncMock())
    return weather


@pytest.mark.asyncio
@pytest.mark.parametrize("frp", [None, 0])
async def test_missing_or_zero_power_does_not_invent_plume(monkeypatch, frp):
    weather = inputs(monkeypatch, frp=frp)
    assert (await trajectory.compute_plume_trajectories(force_refresh=True))["features"] == []
    weather.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("direction,axis,sign", [(0, 1, -1), (90, 0, -1), (180, 1, 1), (270, 0, 1)])
async def test_advection_goes_downwind(monkeypatch, direction, axis, sign):
    inputs(monkeypatch, direction=direction)
    features = (await trajectory.compute_plume_trajectories(force_refresh=True))["features"]
    centers = [np.mean(f["geometry"]["coordinates"][0][:-1], axis=0) for f in features]
    origin = [75, 30]
    assert all(sign * (center[axis] - origin[axis]) > 0 for center in centers)
    assert abs(centers[2][axis] - origin[axis]) == pytest.approx(3 * abs(centers[0][axis] - origin[axis]), abs=1e-4)
    values = [f["properties"]["max_pm25_est"] for f in features]
    assert values[0] > values[1] > values[2] > 0
    assert values[0] < 60  # No fabricated minimum pollution floor.


@pytest.mark.asyncio
async def test_calm_wind_and_mixing_height(monkeypatch):
    inputs(monkeypatch, speed=0)
    low = (await trajectory.compute_plume_trajectories(force_refresh=True))["features"][0]
    assert np.mean(low["geometry"]["coordinates"][0][:-1], axis=0) == pytest.approx([75, 30])
    inputs(monkeypatch, speed=0, height=1000)
    high = (await trajectory.compute_plume_trajectories(force_refresh=True))["features"][0]
    assert high["properties"]["max_pm25_est"] == low["properties"]["max_pm25_est"] / 2


@pytest.mark.asyncio
@pytest.mark.parametrize("kwargs", [dict(frp=-1), dict(frp=float("nan")), dict(speed=-1), dict(height=0), dict(direction=361)])
async def test_invalid_physical_inputs_fail(monkeypatch, kwargs):
    inputs(monkeypatch, **kwargs)
    with pytest.raises(ValueError):
        await trajectory.compute_plume_trajectories(force_refresh=True)
