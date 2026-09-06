# PRANA — Data & State Model
## 03_data.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Defines all data schemas, ML model designs, database tables, and state transitions |
| Canonical IDs | REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, DEC-010 |
| Dependencies | 00_registry.md, 04_api.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## AQI Unit Convention (DEC-010 — canonical)

Two distinct numeric values are used throughout this project:

| Field name | Unit | Description |
|---|---|---|
| pm25_ugm3 | micrograms per cubic metre | Raw PM2.5 measurement from sensor or model |
| aqi_index | dimensionless 0-500 | India AQI index computed from pm25_ugm3 using CPCB 24h breakpoints |

Conversion function (applied server-side before broadcasting):
CPCB 24h PM2.5 breakpoints:
- 0-30 ug/m3 -> AQI 0-50 (Good)
- 31-60 ug/m3 -> AQI 51-100 (Satisfactory)
- 61-90 ug/m3 -> AQI 101-200 (Moderate)
- 91-120 ug/m3 -> AQI 201-300 (Poor)
- 121-250 ug/m3 -> AQI 301-400 (Very Poor)
- 251-380 ug/m3 -> AQI 401-500 (Severe)
- >380 ug/m3 -> AQI >500 (Hazardous)

All API responses and WebSocket messages that carry an AQI value MUST include BOTH pm25_ugm3 and aqi_index fields. Never broadcast an unlabeled numeric that could be misread as either. Database stores pm25_ugm3; aqi_index is computed at query time.

---

## Database Schema (PostgreSQL + PostGIS)

### Table: fire_hotspots

Populated by ingest_firms.py every 15 minutes.

```sql
CREATE TABLE fire_hotspots (
    id              SERIAL PRIMARY KEY,
    acq_datetime    TIMESTAMPTZ NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    geom            GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_Point(longitude, latitude), 4326)) STORED,
    frp             REAL,           -- Fire Radiative Power (MW)
    brightness      REAL,           -- Brightness temperature (K)
    confidence      TEXT,           -- low | nominal | high
    sensor          TEXT NOT NULL,  -- VIIRS_SNPP | MODIS
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON fire_hotspots USING GIST (geom);
CREATE INDEX ON fire_hotspots (acq_datetime DESC);
```

### Table: aqi_readings

Populated by ingest_openaq.py every 15 minutes. Stores raw PM2.5 in ug/m3 only.

```sql
CREATE TABLE aqi_readings (
    id              SERIAL PRIMARY KEY,
    station_id      TEXT NOT NULL,
    station_name    TEXT,
    city            TEXT,
    state           TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    geom            GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_Point(longitude, latitude), 4326)) STORED,
    parameter       TEXT NOT NULL,   -- pm25 | pm10 | no2 | so2
    pm25_ugm3       REAL NOT NULL,   -- canonical field name; all readings stored as ug/m3
    unit            TEXT NOT NULL DEFAULT 'ug/m3',
    measured_at     TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON aqi_readings USING GIST (geom);
CREATE INDEX ON aqi_readings (station_id, measured_at DESC);
CREATE INDEX ON aqi_readings (measured_at DESC);
```

Note: geom uses GENERATED ALWAYS AS — latitude/longitude must be NOT NULL for this to work. Insert code must always provide lat/lon. If OpenAQ returns a station without coordinates, the row is skipped and logged.

### Table: forecast_zones

Populated by trajectory model after each ingestion cycle.

```sql
CREATE TABLE forecast_zones (
    id              SERIAL PRIMARY KEY,
    fire_cluster_id TEXT NOT NULL,   -- hash of fire cluster centroid + timestamp
    horizon_hours   INTEGER NOT NULL CHECK (horizon_hours IN (24, 48, 72)),
    geom            GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid_lat    DOUBLE PRECISION NOT NULL,
    centroid_lon    DOUBLE PRECISION NOT NULL,
    max_pm25_est    REAL,           -- estimated max PM2.5 (ug/m3) at plume boundary
    wind_speed_ms   REAL,
    wind_dir_deg    REAL,
    mixing_height_m REAL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON forecast_zones USING GIST (geom);
CREATE INDEX ON forecast_zones (computed_at DESC);
```

### Table: anomaly_flags

Populated by IsolationForest anomaly detector.
One record per (station, parameter, day, is_nighttime) — allows distinct daytime and nighttime rows for the same station-day.

```sql
CREATE TABLE anomaly_flags (
    id              SERIAL PRIMARY KEY,
    station_id      TEXT NOT NULL,
    parameter       TEXT NOT NULL,     -- no2 | so2
    day             DATE NOT NULL,
    hour_of_day     SMALLINT NOT NULL, -- 0-23; representative hour of the record
    is_nighttime    BOOLEAN NOT NULL,  -- true if hour in {21,22,23,0,1,2,3,4}
    anomaly_score   REAL NOT NULL,     -- higher = more anomalous (IsolationForest path length)
    is_anomaly      BOOLEAN NOT NULL,
    UNIQUE (station_id, parameter, day, is_nighttime)
);
CREATE INDEX ON anomaly_flags (day DESC);
CREATE INDEX ON anomaly_flags (is_anomaly, day DESC);
```

### Table: citizen_reports

Populated by POST /api/v1/citizen/photo.

```sql
CREATE TABLE citizen_reports (
    id              SERIAL PRIMARY KEY,
    photo_hash      TEXT UNIQUE NOT NULL,   -- SHA-256 of EXIF-stripped image bytes
    latitude        DOUBLE PRECISION,       -- NULL if user did not opt in to location
    longitude       DOUBLE PRECISION,       -- NULL if user did not opt in to location
    geom            GEOMETRY(POINT, 4326),  -- NULL when lat/lon not provided; set by application layer on insert
    pm25_estimate   REAL NOT NULL,          -- estimated PM2.5 in ug/m3
    confidence      TEXT NOT NULL,          -- high | medium | low
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Note: geom is set by application layer (not GENERATED ALWAYS AS) because lat/lon may be NULL.
-- Insert: geom = ST_SetSRID(ST_Point(longitude, latitude), 4326) when lat IS NOT NULL; else NULL.
-- Original photo is NEVER written to disk or stored.
CREATE INDEX ON citizen_reports USING GIST (geom) WHERE geom IS NOT NULL;
CREATE INDEX ON citizen_reports (submitted_at DESC);
```

### Table: incidents

Populated by alert generator.

```sql
CREATE TABLE incidents (
    id              SERIAL PRIMARY KEY,
    incident_id     TEXT UNIQUE NOT NULL,   -- e.g. INC-20251104-001
    severity        TEXT NOT NULL,          -- emergency | warning | watch
    location_text   TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    pollutant       TEXT,
    measured_pm25   REAL,                   -- PM2.5 ug/m3
    measured_aqi    INTEGER,                -- computed India AQI index
    satellite_ts    TIMESTAMPTZ,
    satellite_source TEXT,                  -- FIRMS | TROPOMI
    authority       TEXT,                   -- DPCC | CPCB | HSPCB | PPCB
    auto_generated  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON incidents (created_at DESC);
CREATE INDEX ON incidents (severity, created_at DESC);
```

### Table: fl_rounds

Populated by Flower simulation.

```sql
CREATE TABLE fl_rounds (
    id              SERIAL PRIMARY KEY,
    round_number    INTEGER NOT NULL,
    punjab_accuracy REAL NOT NULL,   -- 1 - normalized RMSE; higher is better
    delhi_accuracy  REAL NOT NULL,
    global_accuracy REAL NOT NULL,
    run_id          TEXT NOT NULL,   -- UUID per simulation run
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, round_number)    -- prevents duplicate rounds if simulation triggered twice
);
CREATE INDEX ON fl_rounds (run_id, round_number);
```

---

## ML Model Specifications

### Model 1: GP Downscaler (REQ-005)

Purpose: Calibrate sparse CPCB ground PM2.5 readings against dense but spatially biased TROPOMI Absorbing Aerosol Index (AAI) to produce a continuous PM2.5 surface at 0.1-degree resolution.

TROPOMI product used: COPERNICUS/S5P/NRTI/L3_AER_AI (Absorbing Aerosol Index). NOT the NO2 product.
The NO2 product (L3_NO2) is used separately for anomaly visualization only (REQ-007).

Method: Gaussian Process Regression (GPR) with RBF + noise kernel.
- Input features per grid cell:
  - tropomi_aai: TROPOMI Absorbing Aerosol Index value at grid cell centroid
  - dist_nearest_station_km: distance in km to nearest CPCB station with a reading in the last 3h
  - hour_sin, hour_cos: cyclical encoding of local hour
  - season_flag: boolean (True if Oct-Nov)
- Target: CPCB PM2.5 ug/m3 reading at collocated station (training only; interpolated at inference)
- Inference: predict pm25_ugm3 for every 0.1-degree grid cell in corridor bbox [73.5-77.5E, 28.5-32.5N]
- Library: scikit-learn GaussianProcessRegressor; kernel = RBF(length_scale=1.0) + WhiteKernel()

Training data: historical CPCB PM2.5 + TROPOMI AAI pairs from OpenAQ v3 archive (Oct-Nov 2022-2024 windows). Stored as backend/data/training/gp_training_pairs.parquet.
Fallback: IDW (inverse-distance weighting) interpolation from ground stations only when TROPOMI/GEE data unavailable.

Output: GeoJSON FeatureCollection of 0.1-deg grid cells, each with {pm25_estimate, uncertainty_std}.

### Model 2: Gaussian-Plume Trajectory (REQ-006)

Purpose: Given fire cluster location, FRP, wind vector, and mixing height, estimate geographic plume reach at 24h, 48h, 72h horizons.

Method: Simplified analytical Gaussian plume with wind-field advection. No HYSPLIT (NON-007).

Parameters:
- Q: source emission rate (proportional to summed FRP in cluster; FRP in MW -> PM2.5 emission proxy)
- u: wind speed at 10m from Open-Meteo (windspeed_10m)
- theta: wind direction from Open-Meteo (winddirection_10m)
- H: mixing height from Open-Meteo (boundary_layer_height)
- T: 2m temperature from Open-Meteo (temperature_2m; used for Pasquill stability class estimation)
- sigma_y, sigma_z: lateral and vertical dispersion coefficients (Pasquill-Gifford class D default; adjusted by temperature gradient in future sessions)

Algorithm:
1. Cluster FIRMS fire points (DBSCAN epsilon=0.3 deg, min_samples=3)
2. For each cluster: compute centroid, sum FRP as emission rate Q proxy
3. For each horizon t in {24, 48, 72} hours: advect plume centroid by (u * t * theta_vector)
4. Compute Gaussian dispersion ellipse at advected centroid
5. Threshold polygon at pm25 = 50 ug/m3 contour as affected-zone boundary
6. Store polygons in forecast_zones table

Output: GeoJSON FeatureCollection; 3 Polygon features per cluster; properties include horizon_hours, max_pm25_est, wind_speed_ms, wind_dir_deg.

### Model 3: Photo Haze Estimator (REQ-009)

Purpose: Estimate PM2.5 ug/m3 from citizen-submitted sky photo.

Method: EfficientNet-B0 regression head + Dark Channel Prior (DCP) feature extraction.

Architecture:
- Input: 224x224 RGB image (resized after EXIF strip; original discarded)
- Feature branch 1: EfficientNet-B0 backbone (ImageNet pretrained) -> 1280-dim embedding
- Feature branch 2: Dark Channel Prior -> scalar haze density + transmission map mean (2 scalars)
- Concat: [1280 + 2] -> FC(512) -> ReLU -> FC(256) -> ReLU -> FC(1)
- Output: pm25_ugm3 clamped to [0, 500]
- Confidence: MC-Dropout (3 forward passes); variance < 10 = "high"; < 25 = "medium"; else "low"

Training data: paired (sky photo, PM2.5 ug/m3) dataset from IJISRT 2024 study + synthetic sky photos from open datasets. Pre-trained weights stored at backend/ml/weights/haze_estimator.pt.

Inference target: <2s on CPU (EfficientNet-B0 is small); target <3s including network overhead (REQ-009).

Output JSON: {pm25_estimate: float ug/m3, confidence: "high"|"medium"|"low", aqi_category: string, aqi_color: hex}

### Model 4: IsolationForest Anomaly Detector (REQ-007)

Purpose: Flag unusual industrial emission spikes, especially at night.

Method: scikit-learn IsolationForest per (station, parameter) pair. One model per station-parameter combo; retrained on 90-day rolling window.

Input features per station-hour record:
- pm_value: hourly mean NO2 or SO2 value (ug/m3)
- hour_sin, hour_cos: cyclical hour encoding
- dow_sin, dow_cos: cyclical day-of-week encoding
- rolling_7d_mean: rolling 7-day mean of same-hour values
- delta_from_mean: pm_value - rolling_7d_mean

Nighttime flag: is_nighttime = True if hour in {21, 22, 23, 0, 1, 2, 3, 4} (9pm-4am IST)

Output: one row per (station, parameter, day, is_nighttime) written to anomaly_flags. Daytime aggregate and nighttime aggregate each produce one row. UNIQUE constraint prevents duplicates.

contamination parameter: 0.05 (expect ~5% anomaly rate).

### Model 5: Federated LSTM Forecaster (REQ-008)

Purpose: Demonstrate FL — each state node trains a local AQI-forecasting LSTM; only weight tensors shared.

Architecture (each node):
- Input: 48-hour sliding window of [pm25_ugm3, temperature_2m, windspeed_10m, fire_count_100km]
- LSTM: 2 layers, 64 hidden units, dropout 0.2
- Output: 24-hour ahead pm25_ugm3 forecast (single scalar)
- Loss: MSE

Federation:
- Framework: flwr (Flower) in-process simulation (fl.simulation.run_simulation)
- Clients: 2 (client_id=0 -> Punjab NPZ; client_id=1 -> Delhi NPZ)
- Strategy: FedAvg (default)
- Rounds: 10
- Local epochs per round: 3

Synthetic training data: generated from real Oct-Nov 2022-2024 statistics for fire count and AQI distributions. Stored as:
- backend/data/synthetic/punjab_train.npz: features [pm25_ugm3, temperature_2m, windspeed_10m, fire_count_100km]
- backend/data/synthetic/delhi_train.npz: same features for Delhi node

Metrics logged per round to fl_rounds table: punjab_accuracy (1 - RMSE/mean), delhi_accuracy, global_accuracy.
Expected: global_accuracy > punjab_accuracy and global_accuracy > delhi_accuracy by round 7-10.

---

## State Machine: Alert Lifecycle

```
[new_data_ingested by 15-min scheduler]
       |
       v
[threshold_check]
  aqi_index > 300 (converted from pm25_ugm3) OR new_fire_cluster_in_corridor?
       |
      YES
       v
[incident_created] -> incidents table (measured_pm25 + measured_aqi both stored)
       |
       v
[websocket_broadcast] -> AlertEvent JSON (both pm25_ugm3 and aqi_index fields) to /ws/{city_id}
       |
       v
[client_receives_event]
  Flutter foreground: in-app SnackBar banner
  Flutter background: background_fetch poll -> flutter_local_notifications OS banner
  Web: alert banner rendered
       |
       v
[incident_visible_in_feed /api/v1/alerts]
       |
       v
[auto-expires from feed after 24h; record retained in incidents table indefinitely]
```

---

## Data Retention

| Table | Retention | Reason |
|---|---|---|
| fire_hotspots | 90 days rolling | Demo + model training window |
| aqi_readings | 90 days rolling | Same |
| forecast_zones | 7 days | Forecasts are time-limited |
| anomaly_flags | 90 days | Audit trail |
| citizen_reports | Hash + estimate only; no image; 90 days | Privacy (SEC-003) |
| incidents | Indefinite | Regulatory evidence trail |
| fl_rounds | Indefinite | Demo artifact |
