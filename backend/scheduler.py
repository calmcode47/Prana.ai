"""
PRANA Ingestion Scheduler (15-minute cycle)
Uses APScheduler AsyncIOScheduler to periodically trigger data ingestion
from NASA FIRMS, OpenAQ, and Open-Meteo.
"""

import logging
from datetime import datetime, timezone
from backend.routers.websocket import broadcast_telemetry
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.ingesters.ingest_firms import fetch_firms_hotspots
from backend.ingesters.ingest_openaq import fetch_openaq_stations
from backend.ingesters.ingest_meteo import fetch_meteo_forecast
from backend.ingesters.ingest_gee import fetch_all_satellite_data

logger = logging.getLogger("prana.scheduler")

scheduler = AsyncIOScheduler()


async def run_ingestion_pipeline():
    """
    Executes the ingestion cycle: FIRMS hotspots, OpenAQ readings, Open-Meteo winds, and Sentinel-5P satellite rasters.
    """
    logger.info("Executing background ingestion cycle...")
    try:
        await fetch_firms_hotspots(force_refresh=True)
    except Exception as e:
        logger.error(f"Error during FIRMS ingestion: {e}")

    try:
        await fetch_openaq_stations(force_refresh=True)
    except Exception as e:
        logger.error(f"Error during OpenAQ ingestion: {e}")

    try:
        await fetch_meteo_forecast(force_refresh=True)
    except Exception as e:
        logger.error(f"Error during Open-Meteo ingestion: {e}")

    try:
        await fetch_all_satellite_data()
    except Exception as e:
        logger.error(f"Error during Sentinel-5P satellite ingestion: {e}")

    await generate_threshold_alerts()
    await broadcast_telemetry()
    logger.info("Background ingestion cycle completed.")


def start_scheduler():
    """
    Starts the APScheduler with a 15-minute interval trigger.
    """
    global scheduler
    if not scheduler.running:
        scheduler = AsyncIOScheduler()
        scheduler.add_job(broadcast_telemetry, "interval", seconds=60, id="telemetry", max_instances=1, coalesce=True)
        scheduler.add_job(
            run_ingestion_pipeline,
            trigger=IntervalTrigger(minutes=15),
            id="ingestion_pipeline",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),
            max_instances=1,
            coalesce=True
        )
        scheduler.start()
        logger.info("APScheduler started (15-minute ingestion interval).")


def stop_scheduler():
    """
    Shuts down the APScheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")


async def generate_threshold_alerts():
    """Create at most one warning per station per day, using live readings only."""
    from datetime import timedelta
    from backend.database import get_in_memory_store, compute_cpcb_aqi
    from backend.routers.alerts import fetch_alerts, create_incident
    from backend.models import IncidentCreate
    now = datetime.now(timezone.utc)
    recent = (await fetch_alerts(limit=100, since=now - timedelta(days=1)))["items"]
    locations = {item.get("location_text") for item in recent}
    for reading in get_in_memory_store().get("aqi_readings", []):
        if reading.get("source") != "OPENAQ_LIVE":
            continue
        measured = datetime.fromisoformat(reading["measured_at"].replace("Z", "+00:00"))
        if now - measured > timedelta(hours=24):
            continue
        aqi = compute_cpcb_aqi(reading["pm25_ugm3"])
        location = reading.get("name") or reading["station_id"]
        if aqi > 300 and location not in locations:
            await create_incident(IncidentCreate(severity="emergency" if aqi > 400 else "warning",
                location_text=location, latitude=reading.get("latitude"), longitude=reading.get("longitude"),
                measured_pm25=reading["pm25_ugm3"], satellite_source=None))
            locations.add(location)
