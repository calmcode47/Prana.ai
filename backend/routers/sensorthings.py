"""
OGC SensorThings Interoperability Router (REQ-014)
Serves standard OGC SensorThings API compliant definitions for PRANA corridor nodes.
"""

from fastapi import APIRouter
from backend.models import SensorThingsResponse
from backend.routers.aqi import get_aqi_stations

router = APIRouter(prefix="/api/v1/sensorthings", tags=["OGC SensorThings"])


@router.get("/Things", response_model=SensorThingsResponse)
async def get_sensorthings_things():
    """
    Returns SensorThings entities derived from current provider observations.
    """
    stations = await get_aqi_stations(parameter="pm25", state=None)
    things = []
    for station in stations["value"]:
        observation = station["Datastreams"][0]["Observations"][0]
        things.append({
            "@iot.id": station["@iot.id"],
            "name": station["name"],
            "description": "Air-quality monitoring station from the current provider feed",
            "properties": {
                "source": observation.get("source"),
                "measured_at": observation.get("phenomenonTime"),
                "result_quality": observation.get("resultQuality"),
            },
            "Locations": [{
                "encodingType": "application/geo+json",
                "location": station["Locations"][0]["location"],
            }],
        })
    return {"@iot.count": len(things), "value": things}
