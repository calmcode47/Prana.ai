"""
PRANA Pydantic V2 Models
Defines all request and response schemas matching 04_api.md.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# ==============================================================================
# Hotspots (NASA FIRMS)
# ==============================================================================
class HotspotGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class HotspotProperties(BaseModel):
    frp: Optional[float] = Field(None, description="Fire Radiative Power (MW)")
    brightness: Optional[float] = Field(None, description="Brightness temperature (K)")
    confidence: Optional[str] = Field("nominal", description="low | nominal | high")
    acq_datetime: str
    sensor: str = "VIIRS_SNPP"


class HotspotFeature(BaseModel):
    type: str = "Feature"
    geometry: HotspotGeometry
    properties: HotspotProperties


class HotspotsResponse(BaseModel):
    type: str = "FeatureCollection"
    fetched_at: str
    source: str = "NASA_FIRMS_VIIRS_SNPP_NRT"
    count: int
    features: List[HotspotFeature]


# ==============================================================================
# AQI Stations (OGC SensorThings Compatible)
# ==============================================================================
class Observation(BaseModel):
    pm25_ugm3: float = Field(..., description="Raw PM2.5 in ug/m3")
    aqi_index: int = Field(..., description="PM2.5 sub-index estimate (0-500)")
    phenomenonTime: str
    resultQuality: Optional[str] = "good"
    source: str = "unknown"
    averaging_period: str = "instantaneous; PM2.5 sub-index estimate, not official 24h AQI"


class Datastream(BaseModel):
    name: str = "PM2.5"
    Observations: List[Observation]


class StationLocationGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class StationLocation(BaseModel):
    location: StationLocationGeometry


class StationThing(BaseModel):
    iot_id: str = Field(..., alias="@iot.id")
    name: str
    Locations: List[StationLocation]
    Datastreams: List[Datastream]

    model_config = {
        "populate_by_name": True
    }


class StationsResponse(BaseModel):
    iot_count: int = Field(..., alias="@iot.count")
    value: List[StationThing]

    model_config = {
        "populate_by_name": True
    }


# ==============================================================================
# AQI Interpolated Surface (GP Downscaler)
# ==============================================================================
class SurfacePointGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]


class SurfacePointProperties(BaseModel):
    pm25_estimate: float
    aqi_index: int
    uncertainty_std: Optional[float] = None


class SurfaceGridFeature(BaseModel):
    type: str = "Feature"
    geometry: SurfacePointGeometry
    properties: SurfacePointProperties


class SurfaceGridResponse(BaseModel):
    type: str = "FeatureCollection"
    computed_at: str
    resolution_deg: float = 0.1
    features: List[SurfaceGridFeature]
    source: str = "model_estimate"


# ==============================================================================
# Plume Trajectory (Gaussian-Plume Model)
# ==============================================================================
class PolygonGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]


class PlumeProperties(BaseModel):
    cluster_id: str
    horizon_hours: int
    max_pm25_est: float
    max_aqi_est: int
    wind_speed_ms: Optional[float] = None
    wind_dir_deg: Optional[float] = None
    mixing_height_m: Optional[float] = None


class PlumeFeature(BaseModel):
    type: str = "Feature"
    geometry: PolygonGeometry
    properties: PlumeProperties


class PlumeResponse(BaseModel):
    type: str = "FeatureCollection"
    computed_at: str
    features: List[PlumeFeature]
    source: str = "model_estimate"
    model_assumptions: str = "Steady current wind; heuristic fire contribution only; no background PM2.5 or field calibration"


# ==============================================================================
# Anomalies (Industrial Nighttime Spikes)
# ==============================================================================
class AnomalyItem(BaseModel):
    station_id: str
    station_name: Optional[str] = None
    parameter: str
    day: str
    hour_of_day: int
    is_nighttime: bool
    anomaly_score: float
    is_anomaly: bool
    source: str = "observations"


class AnomaliesResponse(BaseModel):
    count: int
    items: List[AnomalyItem]


# ==============================================================================
# Citizen Photo Upload (Sky Haze Estimation)
# ==============================================================================
class CitizenPhotoResponse(BaseModel):
    pm25_estimate: float
    confidence: str
    aqi_category: str
    aqi_index: int
    aqi_color: str
    processing_time_ms: int
    source: str = "DCP_HEURISTIC_ESTIMATE"


# ==============================================================================
# Alerts & Incidents
# ==============================================================================
class SatelliteEvidence(BaseModel):
    fire_count_50km: Optional[int] = None
    nearest_fire_km: Optional[float] = None
    tropomi_aai: Optional[float] = None
    aerosol_optical_depth: Optional[float] = None


class IncidentItem(BaseModel):
    incident_id: str
    severity: str
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    pollutant: Optional[str] = "PM2.5"
    measured_pm25: Optional[float] = None
    measured_aqi: Optional[int] = None
    satellite_ts: Optional[str] = None
    satellite_source: Optional[str] = "FIRMS"
    authority: Optional[str] = "CPCB"
    created_at: str
    satellite_evidence: Optional[SatelliteEvidence] = None


class AlertsResponse(BaseModel):
    count: int
    items: List[IncidentItem]


class LatestAlertResponse(BaseModel):
    incident_id: str
    severity: str
    title: str
    body: str
    created_at: str


class MobilePushRegistration(BaseModel):
    expo_push_token: str = Field(..., min_length=20, max_length=256)
    platform: Literal["android", "ios"]
    device_id: Optional[str] = Field(None, max_length=256)


class IncidentCreate(BaseModel):
    severity: Literal["emergency", "warning", "watch"]
    location_text: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False)
    longitude: Optional[float] = Field(None, ge=-180, le=180, allow_inf_nan=False)
    pollutant: Literal["PM2.5"] = "PM2.5"
    measured_pm25: float = Field(..., ge=0, le=10000, allow_inf_nan=False)
    satellite_source: Optional[str] = None
    authority: Optional[str] = "CPCB"


# ==============================================================================
# Federated Learning
# ==============================================================================
class FLRoundItem(BaseModel):
    round_number: int
    punjab_accuracy: float
    delhi_accuracy: float
    global_accuracy: float
    punjab_loss: Optional[float] = None
    delhi_loss: Optional[float] = None
    global_loss: Optional[float] = None
    dp_epsilon_spent: Optional[float] = None


class FLStatusResponse(BaseModel):
    run_id: str
    total_rounds: int
    status: str
    rounds: List[FLRoundItem]
    implementation: str = "numpy_fedavg_with_optional_paillier_and_dp_sgd"
    dataset: str = "synthetic_corridor"
    metric: str = "1 - 0.5 * RMSE / target_std, clipped to [0.1, 0.99]"
    privacy: Optional[Dict[str, Any]] = None


# ==============================================================================
# OGC SensorThings Root
# ==============================================================================
class SensorThingLocation(BaseModel):
    encodingType: str = "application/geo+json"
    location: Dict[str, Any]


class SensorThingItem(BaseModel):
    iot_id: str = Field(..., alias="@iot.id")
    name: str
    description: str
    properties: Optional[Dict[str, Any]] = None
    Locations: List[SensorThingLocation]

    model_config = {
        "populate_by_name": True
    }


class SensorThingsResponse(BaseModel):
    iot_count: int = Field(..., alias="@iot.count")
    value: List[SensorThingItem]

    model_config = {
        "populate_by_name": True
    }


# ==============================================================================
# Health Check
# ==============================================================================
class HealthResponse(BaseModel):
    status: str
    db: str
    timestamp: str
