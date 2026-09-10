"""
Forecast Router (REQ-006)
Serves Gaussian-plume trajectory forecast polygons for 24h, 48h, and 72h horizons.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from backend.models import PlumeResponse
from backend.database import compute_cpcb_aqi

logger = logging.getLogger("prana.routers.forecast")

router = APIRouter(prefix="/api/v1/forecast", tags=["Forecast"])


@router.get("/plume", response_model=PlumeResponse)
async def get_forecast_plume(
    cluster_id: Optional[str] = Query(None, min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
):
    """
    Returns Gaussian-plume trajectory polygons for active fire clusters (REQ-006).
    Computes 24h, 48h, and 72h forward dispersion polygons based on FIRMS and Open-Meteo.
    """
    try:
        from backend.ml.trajectory import compute_plume_trajectories
        return await compute_plume_trajectories(cluster_id_filter=cluster_id)
    except Exception as ex:
        raise HTTPException(503, "Forecast inputs unavailable") from None

