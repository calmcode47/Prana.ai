"""
PRANA Ingestion Scheduler (15-minute cycle)
Uses APScheduler AsyncIOScheduler to periodically trigger data ingestion
from NASA FIRMS, OpenAQ, and Open-Meteo.
"""

import logging
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
        await fetch_firms_hotspots()
    except Exception as e:
        logger.error(f"Error during FIRMS ingestion: {e}")

    try:
        await fetch_openaq_stations()
    except Exception as e:
        logger.error(f"Error during OpenAQ ingestion: {e}")

    try:
        await fetch_meteo_forecast()
    except Exception as e:
        logger.error(f"Error during Open-Meteo ingestion: {e}")

    try:
        await fetch_all_satellite_data()
    except Exception as e:
        logger.error(f"Error during Sentinel-5P satellite ingestion: {e}")

    logger.info("Background ingestion cycle completed.")


def start_scheduler():
    """
    Starts the APScheduler with a 15-minute interval trigger.
    """
    if not scheduler.running:
        scheduler.add_job(
            run_ingestion_pipeline,
            trigger=IntervalTrigger(minutes=15),
            id="ingestion_pipeline",
            replace_existing=True
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
