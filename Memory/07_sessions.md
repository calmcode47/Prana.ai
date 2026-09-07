# PRANA — Session & Workstream Map
## 07_sessions.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Defines all builder sessions, their outcomes, dependencies, and provisional order |
| Canonical IDs | SESSION-001 to SESSION-007 |
| Dependencies | 00_registry.md, 04_api.md, 06_testing.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## Session Map Overview

```
SESSION-001: Backend Foundation
  (FastAPI + DB + data ingesters + all REST endpoints + WebSocket)
       |
       |-----> SESSION-002: ML Models
       |         (trajectory + downscaler + anomaly + photo haze)
       |
       |-----> SESSION-003: Federated Learning Simulation
       |         (Flower in-process + fl_rounds table)
       |
       v (after SESSION-001 API stable)
SESSION-004: Next.js Website
  (all 6 pages + MapLibre GL JS + charts + WebSocket)
       |
SESSION-005: Flutter Mobile App
  (all 6 screens + MapLibre Flutter + Riverpod + notifications)
       |
SESSION-006: Integration & Deployment
  (Vercel deploy + Railway deploy + env var confirmation + end-to-end smoke test)
       |
SESSION-007: Final Verification
  (all REQ/SEC checked; walkthrough recorded)
```

SESSION-002 and SESSION-003 run in parallel with each other after SESSION-001.
SESSION-004 and SESSION-005 run in parallel with each other after SESSION-001 produces stable API.

---

## SESSION-001: Backend Foundation

Outcome: Running FastAPI backend with all REST endpoints, WebSocket, database schema, data ingesters returning real or fallback data.

Included IDs: REQ-001, REQ-002, REQ-003, REQ-004, REQ-010, REQ-011, REQ-014, SEC-001, SEC-002, SEC-004, DEC-003, DEC-006, DEC-007, DEC-010

Explicitly excluded: ML models (SESSION-002), FL (SESSION-003), Flutter (SESSION-005), Next.js (SESSION-004)

Work:
- FastAPI app with all routers mounted; uvicorn entrypoint
- PostgreSQL + PostGIS schema: all 7 tables from 03_data.md including:
  - fire_hotspots (GENERATED ALWAYS AS geom)
  - aqi_readings (GENERATED ALWAYS AS geom; field renamed pm25_ugm3)
  - forecast_zones
  - anomaly_flags (UNIQUE on station_id, parameter, day, is_nighttime; includes hour_of_day column)
  - citizen_reports (geom set by application layer; conditional on lat/lon presence)
  - incidents (measured_pm25 + measured_aqi fields)
  - fl_rounds (UNIQUE on run_id, round_number)
- Ingestion functions:
  - ingest_firms.py: fetch VIIRS_SNPP_NRT CSV; parse; upsert fire_hotspots
  - ingest_openaq.py: fetch Delhi/NCR + Punjab/Haryana stations; verify sort parameter against live v3 API docs; upsert aqi_readings with pm25_ugm3 field
  - ingest_meteo.py: fetch windspeed_10m, winddirection_10m, boundary_layer_height, temperature_2m for Punjab centroid (30.7N, 76.8E) AND Delhi centroid (28.6N, 77.2E); cache both to JSON files
- APScheduler: 15-minute ingestion cycle; startup run at launch
- Server-side aqi_index computation function: takes pm25_ugm3, returns India AQI index per CPCB 24h breakpoints (03_data.md DEC-010 table); applied to all broadcast and API responses
- All REST endpoints:
  - GET /api/v1/hotspots (real FIRMS or firms_fallback.geojson)
  - GET /api/v1/aqi/stations (real OpenAQ; all Observation objects include pm25_ugm3 + aqi_index)
  - GET /api/v1/aqi/surface (stub returning static sample grid until SESSION-002)
  - GET /api/v1/forecast/plume (stub until SESSION-002)
  - GET /api/v1/anomalies (stub until SESSION-002)
  - GET /api/v1/federated/status (stub until SESSION-003)
  - GET /api/v1/alerts + /api/v1/alerts/latest (real incidents table)
  - POST /api/v1/alerts/incident (creates ticket with measured_pm25 + measured_aqi)
  - POST /api/v1/citizen/photo (stub returning {pm25_estimate: 99.0, confidence: "medium"} until SESSION-002)
  - GET /api/v1/sensorthings/Things (static 2-node response)
  - GET /health
- WebSocket /ws/{city_id}: snapshot on connect (delhi_pm25_ugm3, delhi_aqi_index, fire_count, latest_alert); update broadcast every 60s if data changed; alert broadcast on threshold (aqi_index > 300)
- Static fallback files:
  - backend/data/static/firms_fallback.geojson
  - backend/data/static/tropomi_aai_fallback.geojson
  - backend/data/static/tropomi_no2_fallback.geojson
- CORS middleware: origins loaded from CORS_ORIGINS env var (SEC-004)
- .env.example with all required vars
- pytest test fixtures: firms_sample_response.csv, openaq_*.json, open_meteo_response.json
- pytest tests: test_ingest.py (mocked), test_alerts.py, test_ws.py, test_sensorthings.py, test_security.py

Verification:
- pytest -m "not integration" -- all pass
- GET /api/v1/hotspots returns GeoJSON with count field (real or fallback)
- GET /api/v1/aqi/stations Observation objects contain both pm25_ugm3 and aqi_index
- GET /api/v1/sensorthings/Things returns @iot.count: 2
- GET /health returns {"status": "ok"}

---

## SESSION-002: ML Models

Outcome: All 4 ML models integrated into backend endpoints returning real predictions.

Depends on: SESSION-001 (database and ingestion pipeline with temperature_2m data available)

Included IDs: REQ-005, REQ-006, REQ-007, REQ-009, SEC-003, SEC-005

Explicitly excluded: FL simulation (SESSION-003), frontend

Work:
- backend/ml/downscaler.py:
  - GP Regression using Open-Meteo CAMS AOD + aqi_readings (pm25_ugm3)
  - Input features: tropomi_aai, dist_nearest_station_km, hour_sin, hour_cos, season_flag
  - Output: /api/v1/aqi/surface GeoJSON with pm25_estimate + aqi_index per grid cell
- backend/ml/trajectory.py:
  - DBSCAN clustering of FIRMS fire points; Gaussian-plume per cluster
  - Inputs include temperature_2m from cached Open-Meteo (for stability class)
  - Output: /api/v1/forecast/plume GeoJSON with max_pm25_est + max_aqi_est per polygon
- backend/ml/anomaly.py:
  - IsolationForest per (station, parameter)
  - Writes one row per (station, parameter, day, is_nighttime) with hour_of_day
  - Output: /api/v1/anomalies includes hour_of_day + is_nighttime; daytime and nighttime rows distinct
- backend/ml/haze_estimator.py:
  - EfficientNet-B0 + DCP; MC-Dropout confidence
  - File validation middleware order: Content-Type -> file size -> magic bytes -> EXIF strip (SEC-003)
  - SlowAPI rate limiter: 10/min per IP (SEC-005)
  - Response includes pm25_estimate (ug/m3) + aqi_index + aqi_category + aqi_color
- Pre-trained model weights: backend/ml/weights/haze_estimator.pt
- Training data: backend/data/training/gp_training_pairs.parquet

Verification:
- pytest backend/tests/test_ml.py -- all pass
- pytest backend/tests/test_citizen.py -- all pass (including SEC-003a/b/c and SEC-005 negative tests)
- POST /api/v1/citizen/photo with test JPEG: pm25_estimate returned in <3s; aqi_index present

---

## SESSION-003: Federated Learning Simulation

Outcome: Flower in-process FL simulation runs 10 rounds; metrics in fl_rounds table; /api/v1/federated/status returns ascending global_accuracy.

Depends on: SESSION-001 (database; fl_rounds UNIQUE constraint in place)

Included IDs: REQ-008, SEC-006

Explicitly excluded: All other models, frontend

Work:
- backend/data/synthetic/ -- generate NPZ files with 4-feature sequences [pm25_ugm3, temperature_2m, windspeed_10m, fire_count_100km]:
  - punjab_train.npz: Oct-Nov 2022-2024 statistics for Punjab fire + AQI distributions
  - delhi_train.npz: same for Delhi receptor statistics
- backend/ml/federated/client_punjab.py -- Flower NumPyClient; LSTM 2-layer 64-unit; fit() returns (parameters, len(train_dataset), {}) only (SEC-006)
- backend/ml/federated/client_delhi.py -- same for Delhi data
- backend/ml/federated/server.py -- fl.simulation.run_simulation; FedAvg; 10 rounds; 3 local epochs; logs per-round metrics to fl_rounds table using run_id UUID; handles UNIQUE (run_id, round_number) on insert
- backend/routers/federated.py:
  - GET /api/v1/federated/status: reads fl_rounds for latest run_id
  - POST /api/v1/federated/run: triggers new simulation (rate-limit: 1 run per 5 min); returns run_id
- Pre-run cached metrics: backend/data/cache/fl_prerun.json; served if simulation takes >60s (RISK-005)

Verification:
- pytest backend/tests/test_fl.py -- all pass including SEC-006 assertion
- GET /api/v1/federated/status: 10 rounds; round 10 global_accuracy > punjab_accuracy and > delhi_accuracy
- UNIQUE constraint: triggering simulation twice does not duplicate rows (run_id differs per run)

---

## SESSION-004: Next.js Website

Outcome: All 6 Next.js pages deployed to Vercel, connecting to production backend, with MapLibre GL JS, live data layers, charts, FL animation, and alert feed.

Depends on: SESSION-001 (stable API); SESSION-002 (ML endpoints); SESSION-003 (FL endpoint)

Included IDs: REQ-013

Explicitly excluded: Flutter app (SESSION-005)

Work:
- web/ Next.js 14 App Router project
- next.config.ts: NEXT_PUBLIC_API_URL env var; NEXT_PUBLIC_WS_URL env var
- All 6 pages matching 02_ux.md:
  - app/page.tsx (/ landing)
  - app/dashboard/page.tsx
  - app/forecast/page.tsx
  - app/federated/page.tsx
  - app/alerts/page.tsx
  - app/api-docs/page.tsx
- MapLibre GL JS: dynamic import (no SSR); useEffect mount; all 4 layer toggles
- useWebSocket hook: connects to WS /ws/ncr; updates React state with both pm25_ugm3 and aqi_index
- All charts (Recharts): LineChart (forecast correlation), BarChart (fire count), ScatterChart, accuracy LineChart (FL)
- FLNetworkAnimation component: SVG + CSS keyframe; animated data packets
- AQI display: always show both pm25_ugm3 (raw) and aqi_index (India scale) on hover/cards
- SEO: title + meta description on all 6 pages
- Lighthouse CI config: mobile target >= 70

Verification:
- npm run build -- exits code 0; no TypeScript errors
- npx tsc --noEmit -- no errors
- Deployed URL: all 6 pages return HTTP 200; no console errors
- Lighthouse mobile score >= 70 on /

---

## SESSION-005: Flutter Mobile App

Outcome: Flutter app on Android and iOS; all 6 screens functional; push notifications working.

Depends on: SESSION-001 (stable API); SESSION-002 (ML endpoints); SESSION-003 (FL endpoint)

Included IDs: REQ-012, REQ-015, DEC-005, DEC-008, DEC-009, DEC-011

Explicitly excluded: Next.js (SESSION-004)

Work:
- mobile/ Flutter project (flutter create mobile --org in.prana --platforms android,ios)
- pubspec.yaml: all packages from 02_ux.md Flutter Package Dependencies table
- lib/core/: theme.dart (dark theme; Outfit + Inter; AQI color extension), router.dart (GoRouter with /citizen as modal sub-route per DEC-011), constants.dart (API URLs; AQI breakpoints; bbox)
- lib/core/utils/aqi_converter.dart: converts pm25_ugm3 to aqi_index (same CPCB breakpoints as server; used for display when aqi_index not returned)
- lib/features/dashboard/: DashboardScreen + DashboardProvider (AsyncNotifierProvider; polls /aqi/stations every 60s); shows Lottie AQI gauge; fire count; sparkline
- lib/features/map/: MapScreen + MapProvider; MapLibre maplibre_gl; all 4 layers (heatmap, fire, trajectory, wind); displays both pm25_ugm3 and aqi_index on tap
- lib/features/forecast/: ForecastScreen + ForecastProvider; time buttons; mini-map; correlation chart
- lib/features/citizen/: CitizenUploadSheet (ModalBottomSheet per DEC-011); image_picker; Dio multipart POST; displays pm25_estimate + aqi_index + aqi_category from response
- lib/features/alerts/: AlertsScreen + AlertsProvider (StreamProvider on WebSocket channel); ticker; severity badges; fallback poll every 60s on disconnect
- lib/features/federated/: FederatedScreen + FederatedProvider; CustomPainter node diagram; AnimationController; accuracy chart
- lib/shared/widgets/: AQIGauge (Lottie), AdvisoryCard, FireCountBadge, AQIValueDisplay (shows both units)
- Background notifications (REQ-015):
  - main.dart: background_fetch.configure(minimumFetchInterval: 15)
  - Background task: GET /api/v1/alerts/latest; compare to SharedPreferences last_seen_id; if new -> flutter_local_notifications.show()
  - Deep link: notification tap opens /alerts route via GoRouter
- Widget tests for all 6 screens in mobile/test/

Verification:
- flutter analyze -- no errors
- flutter test -- all widget tests pass
- flutter run --debug on Android emulator: all 6 screens navigate; map shows data; citizen modal opens from FAB; AQI shows both units
- flutter run --debug on iOS simulator: all 6 screens navigate
- Manual REQ-015: background notification appears within one background_fetch cycle

---

## SESSION-006: Integration & Deployment

Outcome: All three workstreams connected in production; end-to-end smoke test passes; all URLs confirmed and updated.

Depends on: SESSION-001 to SESSION-005 complete

Included IDs: DEC-006, DEC-007, RISK-001, RISK-002, RISK-003, RISK-007

Work:
- Deploy backend to Railway (or Render if Railway unavailable): set all env vars from .env; confirm platform name
- Record actual Railway URL; test GET /health returns {"status": "ok"}
- Deploy Next.js to Vercel: record actual deployment URL
- Update backend CORS_ORIGINS env var to include actual Vercel URL
- Update NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL on Vercel to Railway URL
- Update mobile constants.dart PROD_API_URL and PROD_WS_URL to Railway URL
- Build Flutter APK: flutter build apk --release
- Build Flutter for iOS simulator: flutter build ios --simulator
- Smoke test end-to-end: fire data visible; trajectory visible; FL demo runs; photo upload returns estimate; WebSocket alert delivered in-app; OS notification delivered when backgrounded

Verification:
- GET {ACTUAL_RAILWAY_URL}/health returns {"status": "ok"}
- GET {ACTUAL_VERCEL_URL} returns HTTP 200; all 6 pages load
- Flutter APK installs on Android emulator; Dashboard shows live or fallback AQI (both pm25_ugm3 and aqi_index)
- CORS test from browser against actual Vercel URL: requests succeed; cross-origin from evil.com rejected

---

## SESSION-007: Final Verification

Outcome: All REQ and SEC verified; Requirement Completion Matrix filled; walkthrough recorded.

Depends on: SESSION-006 complete

Work:
- Run pytest -m "not integration" backend/tests/ against production backend URL
- Run pytest -m integration (with live credentials if available)
- Run flutter test
- Run npm run build; npx tsc --noEmit
- Complete full manual verification checklist from 06_testing.md
- Update all verification statuses in 06_testing.md from "not run" to "pass" or "fail"
- Record any failures as RISK entries in 00_registry.md
- Produce Requirement Completion Matrix (inline below when complete)

Completion Matrix (to be filled in SESSION-007):

| ID | Approved outcome | Design location | Session | Repository evidence | Verification | Status |
|---|---|---|---|---|---|---|
| REQ-001 | FIRMS fire ingestion | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-002 | GEE AAI + NO2 ingestion | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-003 | OpenAQ stations ingestion | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-004 | Open-Meteo wind + temp | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-005 | GP Downscaler AAI+ground | 03_data.md | SESSION-002 | TBD | TBD | pending |
| REQ-006 | Gaussian-plume forecast | 03_data.md | SESSION-002 | TBD | TBD | pending |
| REQ-007 | IsolationForest anomaly | 03_data.md | SESSION-002 | TBD | TBD | pending |
| REQ-008 | FL 10-round simulation | 03_data.md | SESSION-003 | TBD | TBD | pending |
| REQ-009 | Photo PM2.5 estimate | 04_api.md | SESSION-002 | TBD | TBD | pending |
| REQ-010 | Incident ticket | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-011 | WebSocket alert push | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-012 | Flutter 6 screens | 02_ux.md | SESSION-005 | TBD | TBD | pending |
| REQ-013 | Next.js 6 pages | 02_ux.md | SESSION-004 | TBD | TBD | pending |
| REQ-014 | OGC SensorThings | 04_api.md | SESSION-001 | TBD | TBD | pending |
| REQ-015 | Foreground + background notifications | 02_ux.md | SESSION-005 | TBD | TBD | pending |
