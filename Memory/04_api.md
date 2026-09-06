# PRANA — API & Integration Contract
## 04_api.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Canonical definition of all REST endpoints, WebSocket protocol, external API integrations, and OGC SensorThings schema |
| Canonical IDs | REQ-001 to REQ-011, REQ-014, SEC-001 to SEC-006, DEC-010 |
| Dependencies | 00_registry.md, 03_data.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## Base URL

Development: http://localhost:8000
Production: https://{VERCEL_PROJECT_NAME}.railway.app (confirmed at SESSION-006 — see RISK-007)

All endpoints prefixed with /api/v1/

---

## AQI Unit Convention

All API responses that carry air quality values MUST include both:
- pm25_ugm3: raw PM2.5 in micrograms per cubic metre
- aqi_index: India AQI index (CPCB 24h breakpoints; computed server-side from pm25_ugm3)

See 03_data.md "AQI Unit Convention (DEC-010)" for conversion breakpoints.
Never return an unlabeled numeric that could be confused for either unit.

---

## Authentication

None. All endpoints are anonymous read-only for demo.
Photo upload (POST /api/v1/citizen/photo) is rate-limited by IP (SEC-005).
Credentials for external APIs (FIRMS, GEE) are server-side env vars only (SEC-001, SEC-002).

---

## REST Endpoints

### GET /api/v1/hotspots

Returns active fire hotspots in Punjab/Haryana bbox from NASA FIRMS.

Query parameters:
- hours_back: integer, ge=1, le=72, default 24
- min_confidence: "low"|"nominal"|"high", default "nominal"

Response 200:
```json
{
  "type": "FeatureCollection",
  "fetched_at": "2025-11-04T08:30:00Z",
  "source": "NASA_FIRMS_VIIRS_SNPP_NRT",
  "count": 247,
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [75.32, 30.74] },
      "properties": {
        "frp": 42.3,
        "brightness": 334.5,
        "confidence": "high",
        "acq_datetime": "2025-11-04T06:00:00Z",
        "sensor": "VIIRS_SNPP"
      }
    }
  ]
}
```

Response 503: { "error": "FIRMS data unavailable", "cached_at": "<timestamp>", "data": <last_cached_geojson> }

### GET /api/v1/aqi/stations

Returns latest AQI readings for all stations in NCR + Punjab/Haryana corridor.

Query parameters:
- parameter: "pm25"|"pm10"|"no2"|"so2", default "pm25"
- state: string, optional filter (e.g. "Delhi")

Response 200 (OGC SensorThings-compatible):
```json
{
  "@iot.count": 312,
  "value": [
    {
      "@iot.id": "IN-CPCB-DL-001",
      "name": "Anand Vihar, Delhi",
      "Locations": [{ "location": { "type": "Point", "coordinates": [77.316, 28.647] } }],
      "Datastreams": [{
        "name": "PM2.5",
        "Observations": [{
          "pm25_ugm3": 150.2,
          "aqi_index": 287,
          "phenomenonTime": "2025-11-04T08:00:00Z",
          "resultQuality": "good"
        }]
      }]
    }
  ]
}
```

### GET /api/v1/aqi/surface

Returns interpolated PM2.5 surface grid (GP Downscaler output).

Response 200:
```json
{
  "type": "FeatureCollection",
  "computed_at": "2025-11-04T08:15:00Z",
  "resolution_deg": 0.1,
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [75.5, 30.5] },
      "properties": {
        "pm25_estimate": 145.2,
        "aqi_index": 276,
        "uncertainty_std": 18.4
      }
    }
  ]
}
```

### GET /api/v1/forecast/plume

Returns Gaussian-plume trajectory polygons for active fire clusters.

Query parameters:
- cluster_id: string, optional (if omitted returns all active clusters)

Response 200:
```json
{
  "type": "FeatureCollection",
  "computed_at": "2025-11-04T08:15:00Z",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[[74.1, 30.2], "..."]] },
      "properties": {
        "cluster_id": "CLU-20251104-001",
        "horizon_hours": 24,
        "max_pm25_est": 210.5,
        "max_aqi_est": 344,
        "wind_speed_ms": 4.2,
        "wind_dir_deg": 312,
        "mixing_height_m": 850
      }
    },
    { "...": "horizon_hours: 48" },
    { "...": "horizon_hours: 72" }
  ]
}
```

### GET /api/v1/anomalies

Returns anomaly flags for industrial emission spikes.

Query parameters:
- parameter: "no2"|"so2", default "no2"
- nighttime_only: boolean, default true
- days_back: integer, ge=1, le=90, default 7

Response 200:
```json
{
  "count": 3,
  "items": [
    {
      "station_id": "IN-CPCB-HR-022",
      "station_name": "Manesar, Haryana",
      "parameter": "no2",
      "day": "2025-11-03",
      "hour_of_day": 2,
      "is_nighttime": true,
      "anomaly_score": 0.87,
      "is_anomaly": true
    }
  ]
}
```

### POST /api/v1/citizen/photo

Upload sky photo for PM2.5 estimation.

Request: multipart/form-data
- photo: file (JPEG or PNG, max 5MB)
- latitude: float, optional
- longitude: float, optional

Validation order (SEC-003):
1. Content-Type header must be image/jpeg or image/png (else 400)
2. File size must be <= 5242880 bytes — checked BEFORE reading body (else 413)
3. Read first 16 bytes (magic bytes): verify JPEG FF D8 FF or PNG 89 50 4E 47 (else 400)
4. Strip EXIF with Pillow before any processing

Response 200:
```json
{
  "pm25_estimate": 178.4,
  "confidence": "high",
  "aqi_category": "Poor",
  "aqi_index": 311,
  "aqi_color": "#FF7800",
  "processing_time_ms": 1847
}
```

Response 400: { "error": "Invalid file type. JPEG or PNG only." }
Response 413: { "error": "File too large. Maximum 5MB." }
Response 429: { "error": "Rate limit exceeded. Try again in 60 seconds." } (SEC-005)

### GET /api/v1/alerts

Returns SPCB incident tickets.

Query parameters:
- severity: optional filter "emergency"|"warning"|"watch"
- limit: integer, ge=1, le=100, default 20
- since: ISO datetime, optional

Response 200:
```json
{
  "count": 5,
  "items": [
    {
      "incident_id": "INC-20251104-001",
      "severity": "emergency",
      "location_text": "Anand Vihar, Delhi",
      "latitude": 28.647,
      "longitude": 77.316,
      "pollutant": "PM2.5",
      "measured_pm25": 215.0,
      "measured_aqi": 412,
      "satellite_ts": "2025-11-04T06:00:00Z",
      "satellite_source": "FIRMS",
      "authority": "DPCC",
      "created_at": "2025-11-04T08:05:00Z",
      "satellite_evidence": {
        "fire_count_50km": 18,
        "nearest_fire_km": 4.2,
        "tropomi_aai": 1.84
      }
    }
  ]
}
```

### GET /api/v1/alerts/latest

Returns most recent alert for background_fetch polling (REQ-015).

Response 200:
```json
{
  "incident_id": "INC-20251104-001",
  "severity": "emergency",
  "title": "Air Quality Emergency — Delhi NCR",
  "body": "AQI 412 at Anand Vihar. 18 fires within 50km.",
  "created_at": "2025-11-04T08:05:00Z"
}
```

Response 204: No alerts in last 24h.

### POST /api/v1/alerts/incident

Create a new SPCB incident ticket.

Request body:
```json
{
  "severity": "warning",
  "location_text": "Rohtak, Haryana",
  "latitude": 28.895,
  "longitude": 76.607,
  "pollutant": "NO2",
  "measured_pm25": 92.0,
  "satellite_source": "TROPOMI",
  "authority": "HSPCB"
}
```

Response 201: Full incident object (same schema as GET /api/v1/alerts item, with measured_aqi computed server-side).

### GET /api/v1/federated/status

Returns FL simulation round history.

Response 200:
```json
{
  "run_id": "FL-20251104-001",
  "total_rounds": 10,
  "status": "complete",
  "rounds": [
    {
      "round_number": 1,
      "punjab_accuracy": 0.61,
      "delhi_accuracy": 0.58,
      "global_accuracy": 0.64
    }
  ]
}
```

### GET /api/v1/sensorthings/Things

OGC SensorThings API root endpoint (REQ-014).

Response 200:
```json
{
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
```

### GET /health

Response 200: { "status": "ok", "db": "connected", "timestamp": "<iso>" }

---

## WebSocket Protocol

### Endpoint: WS /ws/{city_id}

city_id: "delhi" | "ncr" | "punjab" (use "ncr" for full corridor subscription)

On connect: server sends current snapshot immediately. All AQI values include both units.
```json
{
  "type": "snapshot",
  "fire_count": 247,
  "delhi_pm25_ugm3": 150.2,
  "delhi_aqi_index": 287,
  "latest_alert": null
}
```

On new data (every 60s if data changed):
```json
{
  "type": "aqi_update",
  "station_id": "IN-CPCB-DL-001",
  "pm25_ugm3": 157.3,
  "aqi_index": 301,
  "timestamp": "2025-11-04T08:15:00Z"
}
```

On threshold crossing (aqi_index > 300 or new fire cluster):
```json
{
  "type": "alert",
  "incident_id": "INC-20251104-001",
  "severity": "emergency",
  "title": "Air Quality Emergency — Delhi NCR",
  "body": "AQI 412 at Anand Vihar. 18 fires within 50km.",
  "created_at": "2025-11-04T08:05:00Z"
}
```

Client reconnect behavior: exponential backoff starting 2s, max 5 attempts, then fall back to polling /api/v1/aqi/stations every 60s.

---

## External API Integrations

### NASA FIRMS (REQ-001, DEC-001)

Base URL: https://firms.modaps.eosdis.nasa.gov/api/area/csv
Credential: FIRMS_MAP_KEY env var (server-side only; SEC-001)
Request pattern: GET /{MAP_KEY}/VIIRS_SNPP_NRT/{bbox}/{days}
bbox: west,south,east,north = 73.5,28.5,77.5,32.5
days: 1 (last 24h NRT)
Rate limit: 5,000 req / 10 min per MAP_KEY

Fallback (RISK-001): static GeoJSON from backend/data/static/firms_fallback.geojson. UI shows "data as of [date]" banner.

### Google Earth Engine / Sentinel-5P (REQ-002, DEC-002)

Two GEE collections used:
- COPERNICUS/S5P/NRTI/L3_AER_AI -> Absorbing Aerosol Index (AAI); fed to GP Downscaler (REQ-005)
- COPERNICUS/S5P/NRTI/L3_NO2 -> NO2 column density; used for anomaly visualization and IsolationForest (REQ-007)

Credential: GEE_SERVICE_ACCOUNT_JSON env var (server-side only; SEC-002)
Access: Python earthengine-api; server-side only
Bbox: 73.5, 28.5, 77.5, 32.5
Cloud filter: cloud_fraction < 0.3
Refresh: daily cron; cached to backend/data/cache/tropomi_aai.geojson and tropomi_no2.geojson

Fallback (RISK-002): static pre-computed tiles in backend/data/static/tropomi_aai_fallback.geojson and tropomi_no2_fallback.geojson.

### OpenAQ v3 (REQ-003, DEC-003)

Base URL: https://api.openaq.org/v3
No credential required for public tier.

Endpoints used:
- GET /locations?country_id=IN&parameters_id=2&bbox=73.5,28.5,77.5,32.5&limit=200
  (parameters_id=2 is PM2.5 in OpenAQ v3; verify against live API docs before implementation — UNVERIFIED)
- GET /measurements?locations_id={id}&parameters_id=2&limit=1&order_by=datetime&sort=desc
  (sort parameter syntax: UNVERIFIED — confirm against https://api.openaq.org/v3/docs before building ingest_openaq.py)

Rate limit: generous public tier (~60 req/min); add X-API-Key if available (optional upgrade).

### Open-Meteo (REQ-004)

Base URL: https://api.open-meteo.com/v1/forecast
No credential required. Completely free.

Parameters requested (all required):
- windspeed_10m
- winddirection_10m
- boundary_layer_height
- temperature_2m  (required as input feature for LSTM Model 5)

Coordinates: latitude=30.7, longitude=76.8 (Punjab fire-region centroid for fire-side conditions)
Also fetch for: latitude=28.6, longitude=77.2 (Delhi receptor centroid for receptor-side conditions)

---

## CORS Configuration (SEC-004)

Allowed origins:
- https://{ACTUAL_VERCEL_URL} (confirmed at SESSION-006; update CORS_ORIGINS env var then)
- http://localhost:3000 (Next.js dev)
- http://localhost:8000 (FastAPI self-requests)

Flutter app is a native app; browser CORS does not apply to Flutter HTTP requests.
