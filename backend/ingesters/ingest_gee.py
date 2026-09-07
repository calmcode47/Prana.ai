"""Compatibility exports for the former Earth Engine integration.

Earth Engine was replaced by the keyless Open-Meteo CAMS air-quality adapter.
New code should import :mod:`backend.ingesters.ingest_openmeteo_air` directly.
"""
from backend.ingesters.ingest_openmeteo_air import (
    fetch_air_quality_aod as fetch_tropomi_aai,
    fetch_air_quality_grid,
    fetch_air_quality_no2 as fetch_tropomi_no2,
    fetch_all_air_quality as fetch_all_satellite_data,
)

__all__ = ["fetch_air_quality_grid", "fetch_tropomi_aai", "fetch_tropomi_no2",
           "fetch_all_satellite_data"]
