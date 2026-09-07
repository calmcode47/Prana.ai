"""Probe real providers in a separate process; demo data can never pass."""
import argparse
import asyncio
import json
import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

CREDENTIALS = {"meteo": None, "air_quality": None, "firms": "FIRMS_MAP_KEY",
               "openaq": "OPENAQ_API_KEY"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def recent(stamp, max_hours):
    observed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    # Open-Meteo explicitly requests UTC but returns an offset-free timestamp.
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - observed).total_seconds() / 3600
    require(-1 <= age <= max_hours, "Observation timestamp is stale or in the future")


def finite(value, low=-math.inf, high=math.inf):
    require(isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and low <= value <= high, "Invalid numeric observation")


def point(coords):
    require(len(coords) == 2, "Expected point coordinates")
    finite(coords[0], -180, 180)
    finite(coords[1], -90, 90)


def validate_meteo(data):
    for region in ("punjab", "delhi"):
        row = data[region]
        require(row["source"] == "OPEN_METEO_LIVE", "Weather is not live")
        require(row["wind_speed_unit"] == "m/s", "Unexpected wind units")
        recent(row["timestamp"], 3)
        point([row["longitude"], row["latitude"]])
        finite(row["windspeed_10m"], 0)
        finite(row["winddirection_10m"], 0, 360)
        finite(row["boundary_layer_height"], 0)
        finite(row["temperature_2m"])
    return 2


async def probe(name):
    from backend.ingesters.ingest_meteo import fetch_meteo_forecast
    from backend.ingesters.ingest_firms import fetch_firms_hotspots
    from backend.ingesters.ingest_openaq import fetch_openaq_stations
    from backend.ingesters.ingest_openmeteo_air import fetch_air_quality_grid

    if name == "meteo":
        return validate_meteo(await fetch_meteo_forecast(force_refresh=True))
    if name == "firms":
        data = await fetch_firms_hotspots(force_refresh=True)
        require(data["source"] == "NASA_FIRMS_VIIRS_SNPP_NRT", "Fire source is not live")
        for row in data["features"]:
            point(row["geometry"]["coordinates"])
            finite(row["properties"]["frp"], 0)
            recent(row["properties"]["acq_datetime"], 96)
        return len(data["features"])
    if name == "openaq":
        data = await fetch_openaq_stations(force_refresh=True)
        for row in data:
            require(row["source"] == "OPENAQ_LIVE", "Station source is not live")
            finite(row["pm25_ugm3"], 0)
            point([row["longitude"], row["latitude"]])
            recent(row["measured_at"], 24)
        return len(data)
    data = await fetch_air_quality_grid(force_refresh=True)
    require(data["source"] == "OPEN_METEO_CAMS_GLOBAL_LIVE", "CAMS air-quality source is not live")
    recent(data["observation_end"], 6)
    for row in data["features"]:
        point(row["geometry"]["coordinates"])
        for field in ("aerosol_optical_depth", "nitrogen_dioxide", "pm2_5"):
            finite(row["properties"][field], 0)
    return len(data["features"])


async def verify(providers):
    from backend.database import get_db_pool
    require(get_db_pool() is None, "Run this verifier in its own process")
    previous = os.environ.get("PRANA_DEMO_MODE")
    os.environ["PRANA_DEMO_MODE"] = "false"
    checks = []
    try:
        for name in providers:
            key = CREDENTIALS[name]
            if key and not os.getenv(key):
                checks.append({"provider": name, "status": "blocked", "reason": f"Missing {key}"})
                continue
            try:
                count = await asyncio.wait_for(probe(name), timeout=120)
                checks.append({"provider": name, "status": "passed", "observations": count,
                               "coverage": "nonempty" if count else "empty; connectivity only"})
            except Exception as exc:
                # Never serialize exception messages, URLs, or credentials.
                checks.append({"provider": name, "status": "failed", "error_type": type(exc).__name__})
    finally:
        if previous is None:
            os.environ.pop("PRANA_DEMO_MODE", None)
        else:
            os.environ["PRANA_DEMO_MODE"] = previous
    return {"checked_at": datetime.now(timezone.utc).isoformat(), "demo_fallback_allowed": False,
            "checks": checks}


def exit_code(report):
    statuses = {row["status"] for row in report["checks"]}
    return 1 if "failed" in statuses else 2 if "blocked" in statuses else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--providers", nargs="+", choices=CREDENTIALS, default=list(CREDENTIALS))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    logging.disable(logging.CRITICAL)
    report = asyncio.run(verify(args.providers))
    content = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content + "\n", encoding="utf-8")
    print(content)
    return exit_code(report)


if __name__ == "__main__":
    raise SystemExit(main())
