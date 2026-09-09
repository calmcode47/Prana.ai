# Mobile App Telemetry & Data Integrity Audit Report

**Date of Audit:** 9 September 2026  
**Audited Target:** `mobile-app/` (React Native 0.86.3, Expo SDK 52+, TypeScript)  
**Associated Backend:** `http://127.0.0.1:8000` (FastAPI, PostGIS, PyTorch/NumPy ML Engines)  
**Status:** All 6 screens verified; zero backend alterations.

---

## 1. Executive Summary

This audit categorizes every screen and data stream in the **PRANA Air** mobile application across three strict operational classifications:

1. **Live Real Data**: Real hardware sensors (device GPS, camera), live external APIs (Open-Meteo winds), real-time WebSockets, or live algorithmic inference executing on real user inputs.
2. **Synthetic / Demo Data**: Demonstration benchmarks or fallback static GeoJSON used when commercial/third-party API credentials (such as NASA FIRMS or OpenAQ v3) are not supplied in `.env`.
3. **Neither Fake Nor Real**: Mathematical physics dispersion models (DBSCAN Gaussian Plume), statutory legal mandates (Air Act 1981 / EPA 1986), schematic vector visualizers (DEC-008 SVG flow chute), and geographical calibration coordinates.

---

## 2. Screen Classification Matrix

| Screen | File Path | Primary Classification | Data Sources & Integrations |
| :--- | :--- | :--- | :--- |
| **1. Sky Haze Scanner** | [`CitizenScannerScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/CitizenScannerScreen.tsx) | **Live Real** | Real Device GPS + Real Camera/Gallery Image + Backend Dark Channel Prior (DCP) optical depth inference |
| **2. Airshed Dashboard** | [`AirshedDashboardScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/AirshedDashboardScreen.tsx) | **Live Real** *(with fallback mode)* | Live Open-Meteo winds + Live 60s WebSocket broadcast (`/ws/live`); NASA FIRMS & OpenAQ ground stations (live if keys set, static snapshot if unset) |
| **3. Air Corridor Map** | [`AirCorridorMapScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/AirCorridorMapScreen.tsx) | **Live Telemetry on Schematic Model** | Live wind & fire telemetry sampled onto an abstract SVG advection chute (DEC-008 zero-dependency specification) |
| **4. Plume Forecast** | [`PlumeForecastScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/PlumeForecastScreen.tsx) | **Live Physics Simulation Model** | DBSCAN clustering + Gaussian Plume dispersion equations computed from live wind vectors; real emergency review dispatch |
| **5. Regulatory Alerts** | [`RegulatoryAlertsScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/RegulatoryAlertsScreen.tsx) | **Mixed (Real Legal / Synthetic CEMS)** | Real cryptographic SHA-256 hash chains & statutory laws (Air Act Sec 31A); synthetic industrial factory CEMS sensors |
| **6. Federated Mesh** | [`FederatedMeshScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/FederatedMeshScreen.tsx) | **Algorithmic ML Simulation** | Real NumPy/PyTorch FedAvg differential privacy ($\varepsilon, \delta$) mathematical simulation; no raw cross-border sensor leaks |

---

## 3. Screen-by-Screen Technical Deep-Dive

### Screen 1: Sky Haze Scanner (`CitizenScannerScreen.tsx`)

* **Live Real Telemetry**:
  * **Device GPS**: Tapping *"Use Device GPS"* accesses the physical device location hardware via `expo-location`, retrieving real latitude, longitude, and accuracy in meters.
  * **Camera & Gallery Photos**: Real user sky imagery acquired via `expo-image-picker`.
  * **DCP Optical Extinction Inference (`POST /api/v1/citizen/photo`)**:
    * Strips EXIF metadata in memory.
    * Computes dark channel prior, atmospheric light $A$, transmission map $\tau(x)$, and contrast metric directly from the uploaded pixels (`backend/ml/haze_estimator.py`).
    * Produces a genuine algorithmic PM2.5 estimate and converted CPCB sub-index.
* **Neither Fake Nor Real**:
  * **Calibration Presets**: *Sangrur Rural Harvest Outskirts* (30.2450° N, 75.8420° E), *Panipat NH-44* (29.3909° N, 76.9635° E), and *Anand Vihar ISBT* (28.6472° N, 77.3160° E) are real physical coordinates pre-configured as baseline calibration test points.
  * **Backend Scattering Heuristic Formula Card**: Static documentation explaining the mathematical model:  
    $\text{PM2.5} (\mu\text{g/m}^3) = 20.0 + 125.0 \cdot \tau_{mean} + 18.0 \cdot \tau_{max} - 12.0 \cdot Contrast_{lum}$.

---

### Screen 2: Airshed Command Dashboard (`AirshedDashboardScreen.tsx`)

* **Live Real Telemetry**:
  * **Open-Meteo Meteorology (`GET /api/v1/meteorology/current`)**:
    * Base URL: `https://api.open-meteo.com/v1/forecast` (no authentication key required).
    * Queries real-time 10m wind speed, eastward/northward wind vectors, direction, and planetary boundary layer (PBL) mixing height for Punjab (30.7° N, 76.8° E) and Delhi (28.6° N, 77.2° E).
  * **Live Real-Time WebSocket Broadcast (`/ws/live`)**:
    * Pushes live ambient updates every 60 seconds directly to the active corridor node.
* **Simulated / Demo Data (Conditional Fallback)**:
  * **NASA FIRMS Hotspots (`GET /api/v1/hotspots/current`)**:
    * If `FIRMS_MAP_KEY` is present in backend `.env`, pulls live VIIRS_SNPP_NRT satellite fire data.
    * If absent, serves `firms_fallback.geojson` (historical recorded snapshot of VIIRS fire coordinates over Punjab/Haryana).
  * **Ground Sensor Stations (`GET /api/v1/stations`)**:
    * If `OPENAQ_API_KEY` is present, pulls live hourly ground station readings from OpenAQ v3.
    * If absent, serves `DEMO_STATIC` fallback baseline stations (Anand Vihar: 215.4 µg/m³, RK Puram: 178.2 µg/m³, etc.).
* **Neither Fake Nor Real (Analytical Models & Statistics)**:
  * **Fire-to-AQI Lag (`GET /api/v1/analytics/fire-aqi-lag`)**: Computes empirical Pearson cross-correlation across time series to calculate transport lag (typically ~36 hours).
  * **Spatial GP Downscaler Surface (`GET /api/v1/air-quality/surface`)**: A Gaussian Process spatial interpolation algorithm that downscales point observations onto a 0.5° coordinate grid.

---

### Screen 3: Synoptic Air Corridor Map (`AirCorridorMapScreen.tsx`)

* **Live Real Telemetry**:
  * Corridor nodes (*Sangrur*, *Patiala*, *Karnal*, *Panipat*, *Delhi*) compute live wind speeds from Open-Meteo and sum active fire radiative power (FRP) within 100km of each coordinate.
* **Neither Fake Nor Real (Schematic Model & Simulation)**:
  * **2D SVG Corridor Flow Chute**: Per design decision **DEC-008**, the corridor is visualized as an animated SVG chute rather than a heavy MapLibre vector cartography bundle. It visualizes the synoptic northwest-to-southeast atmospheric advection pathway across Punjab, Haryana, and Delhi.
  * **72-Hour Forward Advection Scrubber**: Pre-calibrated regional advection milestones:
    * `T+0h`: Origin (Sangrur)
    * `T+18h`: Advection (Patiala)
    * `T+36h`: Midpoint (Karnal Gate)
    * `T+54h`: Compression Choke Point (Panipat)
    * `T+72h`: Nocturnal Subsidence Basin Sink (Delhi)

---

### Screen 4: 72H Forward Plume Forecast (`PlumeForecastScreen.tsx`)

* **Live Real Physics Model**:
  * **Gaussian Plume Dispersion (`GET /api/v1/forecast/plume`)**:
    * Clusters active fires using **DBSCAN** (`backend/ml/trajectory.py`).
    * Computes forward dispersion ellipses for 24h, 48h, and 72h horizons using live Open-Meteo wind fields.
    * Outputs real dynamic GeoJSON polygons showing plume propagation angles and concentration gradients.
* **Live Real Actions**:
  * **"Dispatch Emergency Review"**: Submits a real operational incident to the backend database (`POST /api/v1/alerts/incident`) and registers it in the SPCB queue.

---

### Screen 5: Regulatory Compliance & Legal Alerts (`RegulatoryAlertsScreen.tsx`)

* **Live Real & Cryptographic Proofs**:
  * **Statutory Notice Generation (`POST /api/v1/legal/notices`)**: Generates verifiable legal notices under Section 31A of the Air (Prevention and Control of Pollution) Act 1981 and Section 5 of the Environment Protection Act 1986. Evidence packages are hashed with SHA-256 and recorded on the legal ledger.
  * **Multilingual Bulletins (`GET /api/v1/alerts/latest`)**: Generates advisory text dynamically in English, Hindi, and Punjabi based on current corridor conditions.
* **Simulated / Demo Data**:
  * **CEMS Industrial Forensics (`GET /api/v1/industrial/cems/CEMS-FLUE-MAN8/forensics`)**: The facility ID `CEMS-FLUE-MAN8` and its flue gas velocity vs scrubber load telemetry are synthetic test benchmarks designed to demonstrate the rule-based bypass detection heuristic (load $\le$ 20% while velocity $\ge$ 120%). Private industrial plants do not provide public open-access telemetry.
  * **Sentinel-5P NO2 Anomalies (`GET /api/v1/anomalies`)**: Demo anomaly clusters if Google Earth Engine (GEE) credentials are not active.

---

### Screen 6: Federated Mesh Screen (`FederatedMeshScreen.tsx`)

* **Neither Fake Nor Real (Algorithmic ML Simulation)**:
  * **FedAvg Differential Privacy Simulation (`GET /api/v1/federated/status`, `POST /api/v1/federated/run`)**:
    * **Not fake placeholder text**: The backend executes real NumPy/PyTorch federated weight aggregation rounds with DP-SGD privacy budgeting ($\varepsilon, \delta$) and additive secret sharing.
    * **Not live sensor telemetry**: It simulates separate Punjab and Delhi edge clients to mathematically prove that cross-state air quality models can be trained collaboratively without exposing raw sensor observations across state lines.

---

## 4. Persistent Global Components

### Audio Briefing Player (`FloatingAudioPlayer.tsx`)
* **Endpoint**: `GET /api/v1/briefings/latest`
* **Data Flow**: Generates a dynamic audio briefing script from the latest recorded incident on the corridor, calculating PM2.5 concentrations and CPCB AQI sub-indexes. Audio synthesis is streamed via `expo-audio`.

---

## 5. Summary & Provider Activation Guide

To transition all fallback screens into 100% live satellite and ground telemetry, configure the following keys in `backend/.env`:

```bash
# 1. NASA FIRMS (VIIRS active fires in Punjab/Haryana corridor)
FIRMS_MAP_KEY="<your_nasa_firms_map_key>"

# 2. OpenAQ v3 (Ground-level CPCB monitoring stations)
OPENAQ_API_KEY="<your_openaq_api_key>"

# 3. Google Earth Engine (Sentinel-5P NO2 tropospheric column anomalies)
GEE_SERVICE_ACCOUNT="<service_account_email>"
GEE_PRIVATE_KEY="<private_key_pem>"
```

*Note: Open-Meteo weather forecasting and dark channel prior image inference do not require API keys and operate in 100% live mode out of the box.*
