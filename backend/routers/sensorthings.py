"""
OGC SensorThings Interoperability Router (REQ-014)
Serves standard OGC SensorThings API compliant definitions for PRANA corridor nodes.
"""

from fastapi import APIRouter
from backend.models import SensorThingsResponse

router = APIRouter(prefix="/api/v1/sensorthings", tags=["OGC SensorThings"])


@router.get("/Things", response_model=SensorThingsResponse)
async def get_sensorthings_things():
    """
    Returns standard OGC SensorThings API Things entities for PRANA corridor.
    Two nodes: Punjab (source) and Delhi (receptor).
    """
    return {
        "@iot.count": 2,
        "value": [
            {
                "@iot.id": "punjab-node-001",
                "name": "Punjab Federated Node",
                "description": "Agricultural burn and air quality monitoring node — Punjab state",
                "properties": { "node_type": "federated_client", "state": "Punjab" },
                "Locations": [{
                    "encodingType": "application/geo+json",
                    "location": { "type": "Point", "coordinates": [75.8, 30.9] }
                }]
            },
            {
                "@iot.id": "delhi-node-001",
                "name": "Delhi Receptor Node",
                "description": "Urban receptor and air quality monitoring node — NCR",
                "properties": { "node_type": "federated_client", "state": "Delhi" },
                "Locations": [{
                    "encodingType": "application/geo+json",
                    "location": { "type": "Point", "coordinates": [77.209, 28.614] }
                }]
            }
        ]
    }
