<div align="center">

# ✦ PRANA Air (प्राण) ✦
### *Atmospheric Intelligence & Transboundary Airshed Orchestration Platform*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK_57-000020.svg?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![PostGIS](https://img.shields.io/badge/PostGIS-16_3.4-336791.svg?style=flat-square&logo=postgresql&logoColor=white)](https://postgis.net)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5%2F6.0-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

<p align="center">
  <b>A full-stack, transboundary environmental intelligence system uniting satellite remote sensing, boundary-layer meteorology, privacy-preserving federated AI, regulatory legal war rooms, and edge citizen sensing across the Indo-Gangetic Airshed.</b>
</p>

</div>

---

## 📑 Table of Contents

- [Executive Overview](#-executive-overview)
- [System Architecture](#-system-architecture)
- [Core Functional Modules](#-core-functional-modules)
  - [1. Air Corridor Trajectory & Ingress Tracker](#1-air-corridor-trajectory--ingress-tracker)
  - [2. 72-Hour Atmospheric Inversion & Plume Forecast](#2-72-hour-atmospheric-inversion--plume-forecast)
  - [3. Cross-Border Federated Learning Mesh](#3-cross-border-federated-learning-mesh)
  - [4. Regulatory Enforcement & Legal War Room](#4-regulatory-enforcement--legal-war-room)
  - [5. Citizen Sky Haze Estimator (Backend DCP Inference)](#5-citizen-sky-haze-estimator-backend-dcp-inference)
  - [6. Real-Time Audio Briefings & Multi-Channel Broadcasts](#6-real-time-audio-briefings--multi-channel-broadcasts)
- [Repository Structure](#-repository-structure)
- [Quick Start Guide](#-quick-start-guide)
  - [Option A: Full-Stack with Docker Compose (Recommended)](#option-a-full-stack-with-docker-compose-recommended)
  - [Option B: Local Component Setup](#option-b-local-component-setup)
    - [1. Backend (FastAPI + PostGIS)](#1-backend-fastapi--postgis)
    - [2. Web Frontend (React + Vite)](#2-web-frontend-react--vite)
    - [3. Mobile App (Expo SDK 57)](#3-mobile-app-expo-sdk-57)
- [Data Feeds & Standards Compliance](#-data-feeds--standards-compliance)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Environment Configuration Reference](#-environment-configuration-reference)
- [License & Ethical AI Notice](#-license--ethical-ai-notice)

---

## 🌍 Executive Overview

Every winter, the Indo-Gangetic Plains (IGP)—spanning Punjab, Haryana, and the National Capital Region (Delhi NCR)—suffer from catastrophic hazardous air pollution (AQI > 450). This crisis is driven by the confluence of:
1. **Upwind Agricultural Emissions**: Widespread post-monsoon paddy crop residue (stubble) burning.
2. **Boundary-Layer Meteorological Inversions**: Sinking nocturnal temperatures trapping pollutants below shallow mixing layer heights (< 200m).
3. **Northwesterly Surface Winds**: Channeling smoke along the NH-44 Grand Trunk road corridor directly into the Delhi topological basin.
4. **Jurisdictional Silos**: Fragmented regulatory enforcement between different State Pollution Control Boards (SPCBs).

**PRANA (प्राण)** is a research and decision-support platform that connects configured satellite, weather, and air-quality providers to atmospheric models, a local federated-learning protocol demonstration, and auditable legal-draft workflows. Provider observations, model estimates, demonstrations, and unavailable states are identified separately in the clients.

---

## 🏛 System Architecture

PRANA is built as an integrated, multi-tier ecosystem:

```mermaid
flowchart TD
    subgraph SATELLITE_AND_WEATHER ["External Satellite & Meteorological Providers"]
        NASA["NASA FIRMS (VIIRS/MODIS 375m FRP)"]
        METEO["Open-Meteo & ECMWF CAMS (Wind & Boundary Layer)"]
        OPENAQ["OpenAQ v3 & CPCB Ground Sensors"]
    end

    subgraph BACKEND_ENGINE ["PRANA Core Engine (FastAPI + PostGIS)"]
        INGEST["Ingestion Pipelines & Spatial Adapters"]
        STORE[("PostgreSQL 16 + PostGIS Spatial DB")]
        LOCAL_STORE[("Durable JSON Fallback Store")]
        FED_CORE["Paillier + DP-SGD Federated Core"]
        WS_HUB["Real-Time WebSocket Engine (Pub/Sub)"]
        TTS_GEN["Incident Briefing TTS & RSS Generator"]
        LEGAL_SVC["Section 31A Draft & Internal Dispatch Queue"]
    end

    subgraph CLIENT_APPLICATIONS ["Client Surfaces"]
        WEB["PRANA Web Platform\n(React 18 + Vite + Tailwind + Leaflet)"]
        MOBILE["PRANA Air Mobile App\n(Expo SDK 57 + React Native 0.86)"]
        CITIZEN["Citizen Scanner\n(On-Device Camera + Dark Channel Prior)"]
    end

    SATELLITE_AND_WEATHER --> INGEST
    INGEST --> STORE
    INGEST --> LOCAL_STORE
    STORE --> FED_CORE
    STORE --> WS_HUB
    STORE --> LEGAL_SVC
    LEGAL_SVC --> TTS_GEN
    WS_HUB --> WEB
    WS_HUB --> MOBILE
    STORE --> WEB
    STORE --> MOBILE
    CITIZEN --> INGEST
```

---

## ⚡ Core Functional Modules

### 1. Air Corridor Trajectory & Ingress Tracker
* **Tri-Node Atmospheric Vector Pipeline**: Models transboundary transport on request and during configured scheduler refreshes across three critical segments:
  - **Node 01 (Upwind Origin)**: Punjab Malwa Agricultural Belt (Sangrur, Patiala clusters).
  - **Node 02 (Transit Channel)**: Haryana NH-44 Highway Belt (Karnal, Panipat transport channel).
  - **Node 03 (Receptor Sink)**: Delhi NCR Topographical Basin (Anand Vihar, Yamuna floodplains).
* **Dynamic Streamlines & Spatial Layers**: Visualizes wind vector streamlines, Fire Radiative Power (FRP) heatmaps, Gaussian Process Regression (GPR) PM2.5 grids, and OGC SensorThings stations.
* **Lag Analytics**: Automatically tracks temporal lag correlations (typically 24h–48h) between upwind stubble fires and downwind receptor AQI spikes.

### 2. 72-Hour Atmospheric Inversion & Plume Forecast
* **Interactive Horizon Scrubber**: Scrub forward across T+0h, T+24h, T+48h, and T+72h forecast envelopes.
* **Meteorological Sounding**: Computes boundary-layer mixing height ($H_{\text{pbl}}$) and ventilation coefficients ($V_i = U \cdot H_{\text{pbl}}$) to detect nocturnal stagnation locks ($V_i < 2{,}200\text{ m}^2/\text{s}$).
* **Ward Vulnerability Matrix**: Identifies municipal wards at immediate risk of particulate trapping.

### 3. Cross-Border Federated Learning Mesh
* **Privacy-Preserving Protocol Demonstration**: Exercises a local multi-partition training workflow without claiming a live connection to Punjab, Haryana, or Delhi authorities.
* **Cryptographic Security & Differential Privacy**:
  - **Paillier Homomorphic Encryption**: 2048-bit keypair for cryptographically sealed weight aggregation.
  - **DP-SGD**: Record-level clipped gradients with calibrated Gaussian noise ($\epsilon = 0.42, \delta = 10^{-5}$) under a conservative Zero-Concentrated Differential Privacy (zCDP) accountant.
* **Interactive Convergence Visualizer**: Displays results returned by the backend for the current local run, including global accuracy and Mean Squared Error (MSE) loss.

### 4. Regulatory Enforcement & Legal War Room
* **Section 31A Air Act Drafting**: Generates unissued review drafts referencing Section 31A of the *Air (Prevention and Control of Pollution) Act, 1981*; an authorized officer must review and issue any legal direction.
* **Evidence Packages**: Generates SHA-256-hashed draft packages and checklists for authorized review; it does not create a legal signature or certificate.
* **Internal Dispatch Queue**: Records a requested recipient and pending status. No external authority is contacted unless a connector is separately configured and implemented.
* **Continuous Emission Monitoring (CEMS)**: Deterministic heuristic scrutiny of industrial stack telemetry and scrubber status.

### 5. Citizen Sky Haze Estimator (Backend DCP Inference)
* **Mobile Camera & Gallery Ingestion**: Citizens capture outdoor sky imagery along with device GPS coordinates.
* **Dark Channel Prior (DCP)**: Sends the selected image to the backend, which decodes it in memory and computes a heuristic PM2.5 estimate and CPCB PM2.5 sub-index. It is not a regulatory measurement.
* **Actionable Citizen Health Checklist**: Context-aware protective guidance (N95 mask reminders, indoor HEPA purifier automation, morning exercise deferrals).

### 6. Real-Time Audio Briefings & Multi-Channel Broadcasts
* **Docked Floating Audio Player**: Native lock-screen and background audio playback for daily regional atmospheric briefings.
* **Dynamic RSS & TTS**: Generates audio from the current backend briefing script when a speech provider and operator authorization are configured; otherwise the UI reports that audio is unavailable.
* **WebSocket & Push Alerts**: WebSocket snapshots are published on the configured backend interval. Native push delivery requires valid Expo project and notification-provider configuration.

---

## 📁 Repository Structure

```text
Prana.ai/
├── backend/                       # FastAPI High-Performance Backend
│   ├── data/                      # Sample datasets, historical benchmarks, and calibration profiles
│   ├── ingesters/                 # NASA FIRMS, Open-Meteo, OpenAQ, and CAMS connectors
│   ├── ml/                        # Federated learning (Paillier + DP-SGD) and DCP haze models
│   ├── routers/                   # REST endpoints (alerts, analytics, cems, forecast, legal, ws)
│   ├── scripts/                   # Local launchers, preflight checkers, and load tests
│   ├── tests/                     # Unit and integration pytest test suites
│   ├── database.py                # PostGIS migrations and durable fallback JSON storage
│   ├── main.py                    # Application factory, CORS, and lifecycle management
│   ├── models.py                  # Pydantic schemas and spatial GeoJSON models
│   ├── scheduler.py               # Periodic ingestion scheduler (15-min refresh, 60-sec push)
│   └── tts.py                     # Text-To-Speech incident briefing generation
│
├── mobile-app/                    # PRANA Air Native Mobile Application (iOS & Android)
│   ├── assets/                    # Application icons, splash screens, and audio chimes
│   ├── src/
│   │   ├── api/                   # REST client, WebSocket client, and offline caching layer
│   │   ├── components/            # Neo-brutalist tactile components (NeoCard, NeoButton, DualUnitChip, etc.)
│   │   ├── hooks/                 # Real-time WebSocket subscriptions and telemetry hooks
│   │   ├── screens/               # 6 core application screens matching atmospheric design playbook
│   │   ├── services/              # Push notifications, background audio, and offline preferences
│   │   └── theme/                 # Master color tokens, spacing scales, and typography
│   ├── App.tsx                    # Shell container, safe area manager, and floating player
│   └── app.json                   # Expo SDK 57 manifest configuration
│
├── web/                           # PRANA Web Desktop Portal
│   ├── src/
│   │   ├── api/                   # Web HTTP/WS client adapters
│   │   ├── components/            # Dashboard widgets, navigation headers, and charts
│   │   └── pages/                 # Full-screen pages for corridor, forecast, mesh, and war room
│   ├── index.html                 # Entrypoint HTML with typography
│   └── vite.config.ts             # Vite bundler configuration
│
├── docker-compose.yml             # Containerized orchestration (PostGIS + FastAPI)
├── LICENSE                        # MIT license
├── SECURITY.md                    # Private vulnerability-reporting guidance
└── README.md                      # This master platform documentation
```

---

## 🚀 Quick Start Guide

### Option A: Full-Stack with Docker Compose (Recommended)

Run the entire backend with a persistent PostGIS database in a single command:

```bash
# 1. Clone the repository
git clone https://github.com/calmcode47/Prana.ai.git
cd Prana.ai

# 2. Create the root environment file read by Docker Compose
cp backend/.env.docker .env
# Edit .env and set strong POSTGRES_PASSWORD, PRANA_OPERATOR_API_KEY,
# facility-scoped CEMS_INGEST_KEYS_JSON, and the real client origins.

# 3. Launch database and API containers
docker compose up --build
```

- **API Documentation (Swagger)**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Database Readiness**: http://localhost:8000/ready

---

### Option B: Local Component Setup

#### 1. Backend (FastAPI + PostGIS)
**Prerequisites**: Python `>= 3.12` (Python 3.14 recommended).

```bash
cd backend

# Create virtual environment & install locked dependencies
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.lock.txt

# Configure environment
cp .env.example .env

# Start local server (defaults to port 8000 on 0.0.0.0)
python -m backend.scripts.serve
```
*Note: If no `DATABASE_URL` is configured, PRANA automatically activates its durable development JSON store at `.local/prana-store.json`.*

#### 2. Web Frontend (React + Vite)
**Prerequisites**: Node.js `>= 20`.

```bash
cd web
npm install
npm run dev
```
Open http://localhost:5173 to access the web portal.

#### 3. Mobile App (Expo SDK 57)
**Prerequisites**: Node.js `>= 20.19.4`, Expo Go app on iOS or Android (Version `57.0.9`).

```bash
cd mobile-app
npm install

# Option 1: Standard LAN mode (phone on same Wi-Fi)
npx expo start

# Option 2: Tunnel mode (remote phones via ngrok bridge)
npm run start:tunnel
```
Scan the displayed QR code with the **Expo Go app** on Android or the **default Camera app** on iOS.

---

## 📊 Data Feeds & Standards Compliance

| Domain | Source Provider | Frequency | Standards & Units |
| :--- | :--- | :--- | :--- |
| **Active Stubble Fires** | NASA FIRMS (VIIRS 375m / MODIS 1km) | 15 minutes | Megawatts (MW) Fire Radiative Power (FRP) |
| **Wind & Boundary Layer** | Open-Meteo & ECMWF CAMS | Hourly / 6-hourly | Wind vector ($u, v$ m/s), Boundary height ($H_{\text{pbl}}$ m AGL) |
| **Continuous Emissions** | Authenticated industrial CEMS submissions | On submission | Scrubber load and stack flow velocity (m/s) |
| **Surface Air Quality** | OGC SensorThings & OpenAQ v3 | 15 minutes | $\mu\text{g/m}^3$ PM2.5 mass concentration |
| **AQI PM2.5 Sub-Index** | PRANA calculation using CPCB breakpoints | On response | India National Air Quality Index PM2.5 sub-index (0–500 scale) |
| **Draft Evidence Export** | PRANA backend | On demand | SHA-256 manifest for authorized legal review; not a signature or filing |

---

## 🧪 Testing & Quality Verification

PRANA maintains automated test coverage across all layers:

### Mobile App Unit & Integration Tests (Jest)
```bash
cd mobile-app
npm test
```
*Validates 5 test suites (44 tests) covering CPCB AQI calculations, citizen photo uploads, UI component layout, screen mounting, and corridor flow.*

### Backend Tests (Pytest)
```bash
cd backend
python -m pytest tests -q -m "not integration"
```
*Validates API route responses, rate limiters, DP-SGD privacy accountants, Paillier aggregation, and database migrations.*

### Web Tests (Vitest)
```bash
cd web
npm test
```
*Validates React page rendering, navigation flows, and telemetry calculations.*

---

## ⚙️ Environment Configuration Reference

The backend recognizes the following variables in `.env`:

| Variable | Description | Default | Required? |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL/PostGIS connection string | *Local file fallback* | In production |
| `FIRMS_MAP_KEY` | NASA FIRMS API key for live thermal satellite feeds | `""` | Required for live fire data |
| `OPENAQ_API_KEY` | OpenAQ v3 API credential | `""` | Required for live station data |
| `CEMS_INGEST_KEYS_JSON`| JSON object mapping each approved facility ID to a separate ingestion key | `{}` | Required for CEMS ingestion |
| `PRANA_OPERATOR_API_KEY`| Server-side secret for incident, legal, federated-run, and TTS control-plane operations | `""` | Required for operator actions |
| `TTS_PROVIDER_KEY` | OpenAI-compatible API key for audio briefings | `""` | Optional |
| `PRANA_DEMO_MODE` | Allow labeled historical sample data when providers fail | `false` | Development |
| `PRANA_ENV` | Environment identifier (`development` / `production`) | `development`| Recommended |
| `CORS_ORIGINS` | Comma-separated allowed client origins | Local development origins | Required in production |
| `PRANA_FL_DP_ENABLED`| Enable differential privacy in federated rounds | `true` | No |
| `PRANA_FL_PAILLIER_ENABLED`| Enable 2048-bit Paillier homomorphic encryption | `true` | No |

---

## 📜 License & Ethical AI Notice

PRANA is available under the [MIT License](LICENSE).

This repository is research and decision-support software. Model estimates are not regulatory measurements or medical advice. Legal documents remain unissued drafts, signatures are not performed without an authorized provider, and internal dispatch queue entries do not mean an external authority was contacted. Operators are responsible for provider terms, consent, data protection, scientific validation, and applicable law.

---

