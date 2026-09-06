# PRANA — Canonical Registry
## 00_registry.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Single source of truth for all project IDs, lifecycle state, and next valid action |
| Canonical IDs | All REQ, SEC, DEC, RISK, NON IDs |
| Dependencies | None — all other documents depend on this |
| Repository baseline | NOT INSPECTED |
| Unresolved items | DEC-006: ASSUMED (Railway/Render free tier — verify platform availability before SESSION-006 starts) |
| Supersedes | REV-001 |

---

## Project Identity

| Field | Value |
|---|---|
| Project name | PRANA — Pollution Risk & Atmospheric Network Alert System |
| Repository path | N:\Github-Repo\PRANA\ |
| Defining value | Hyperlocal, federated early-warning platform for air quality demoed on the Punjab/Haryana stubble-burning to Delhi NCR winter smog corridor. Produces 72-hour fire-to-plume forecasts, satellite-ground fused AQI surfaces, and privacy-preserving federated forecasting — delivered as a Flutter mobile app (Android + iOS) and a deployed Next.js website. |
| Primary use case | Punjab/Haryana crop residue burning to Delhi NCR winter smog (Oct-Nov annually) |
| Lifecycle state | SPECIFICATION |
| Assurance profile | STANDARD |
| Current revision | REV-002 |
| Last updated | 2026-09-06 |

---

## Revision / Changelog

| REV-ID | Date | Parent | Summary | Approval | Critic | Status |
|---|---|---|---|---|---|---|
| REV-001 | 2026-09-06 | none | Initial specification from approved architecture proposal | USER-APPROVED 2026-09-06 | Pending | superseded |
| REV-002 | 2026-09-06 | REV-001 | Audit fixes: REQ-013 page count 5->6; DEC-006 unresolved clarified; REQ-013 verification updated | USER-APPROVED 2026-09-06 | Pending | SPECIFICATION |

---

## Requirements Registry (REQ)

| ID | Statement | Source | Status | Canonical owner | Depends on | Verification | Disposition |
|---|---|---|---|---|---|---|---|
| REQ-001 | Ingest real-time fire hotspots from NASA FIRMS (VIIRS_SNPP_NRT) for bbox 73.5-77.5E 28.5-32.5N | USER-REQUIRED | VERIFIED | 04_api.md | DEC-001 | API returns >=1 fire record in Oct-Nov test window | active |
| REQ-002 | Ingest Sentinel-5P TROPOMI NO2 (L3_NO2) and Absorbing Aerosol Index (L3_AER_AI) via Google Earth Engine for corridor | USER-REQUIRED | VERIFIED | 04_api.md | DEC-002 | GEE query returns non-null image for bbox for both products | active |
| REQ-003 | Ingest ground AQI (PM2.5 PM10) from OpenAQ v3 API for Indian stations | USER-REQUIRED | VERIFIED | 04_api.md | DEC-003 | API returns >=10 Delhi/NCR station readings | active |
| REQ-004 | Ingest wind vectors, boundary-layer height, and 2m temperature from Open-Meteo API | USER-REQUIRED | VERIFIED | 04_api.md | none | Returns windspeed_10m winddirection_10m boundary_layer_height temperature_2m | active |
| REQ-005 | GP Regression fuses TROPOMI Absorbing Aerosol Index (AAI from L3_AER_AI) + CPCB ground PM2.5 readings into continuous 0.1-deg PM2.5 surface grid | USER-REQUIRED | INFERRED | 03_data.md | REQ-002 REQ-003 | /api/v1/aqi/surface returns GeoJSON grid covering corridor bbox | active |
| REQ-006 | Gaussian-plume model produces affected-zone polygons for t+24h t+48h t+72h from fire cluster + wind + mixing height | USER-REQUIRED | VERIFIED | 03_data.md | REQ-001 REQ-004 | /api/v1/forecast/plume returns 3 GeoJSON polygons per cluster | active |
| REQ-007 | IsolationForest flags unusual nighttime NO2/SO2 spikes per facility time series; one record per (station, parameter, day, is_nighttime) | USER-REQUIRED | INFERRED | 03_data.md | REQ-002 | Anomaly endpoint returns score + binary flag; nighttime and daytime rows distinct per station-day | active |
| REQ-008 | Flower in-process FL simulation: 10 rounds FedAvg Punjab+Delhi nodes; global model accuracy exceeds each local model | USER-REQUIRED | VERIFIED | 03_data.md | DEC-004 | /api/v1/federated/status returns round history with improving global accuracy | active |
| REQ-009 | Citizens submit sky photos via mobile app; system returns PM2.5 estimate within 3s via EfficientNet-B0 + DCP | USER-REQUIRED | VERIFIED | 04_api.md | none | POST /api/v1/citizen/photo returns pm25_estimate + confidence in <3s | active |
| REQ-010 | System auto-generates SPCB incident tickets with satellite evidence (timestamp coords pollutant magnitude) | USER-REQUIRED | PROPOSED | 04_api.md | REQ-001 REQ-002 | Ticket persisted and returned by /api/v1/alerts | active |
| REQ-011 | WebSocket server pushes AQI spike and new-fire events to subscribed clients in real time | USER-REQUIRED | INFERRED | 04_api.md | none | App and web receive alert within 5s of threshold crossing | active |
| REQ-012 | Flutter app (Android+iOS) shows: live AQI gauge fire map 72h forecast citizen upload alert feed FL visualization | USER-REQUIRED | PROPOSED | 02_ux.md | REQ-001 to REQ-011 | All 6 screens render without crash on Android emulator and iOS simulator | active |
| REQ-013 | Next.js website on Vercel shows 6 pages: landing / dashboard /forecast /federated /alerts /api-docs | USER-REQUIRED | PROPOSED | 02_ux.md | REQ-001 to REQ-011 | All 6 pages load at Vercel deployment URL without error | active |
| REQ-014 | All data endpoints expose OGC SensorThings API-compatible JSON schema | USER-REQUIRED | VERIFIED | 04_api.md | none | /api/v1/sensorthings/Things returns valid OGC JSON-LD | active |
| REQ-015 | Push notifications: foreground via WebSocket in-app banner; background/killed via background_fetch polling /api/v1/alerts/latest + flutter_local_notifications OS banner — no Firebase no OneSignal | USER-REQUIRED | VERIFIED | 02_ux.md | REQ-011 | OS notification banner appears when AQI crosses threshold while app is backgrounded within 5s of next poll cycle | active |

---

## Security Requirements (SEC)

| ID | Statement | Source | Status | Canonical owner | Depends on | Verification | Disposition |
|---|---|---|---|---|---|---|---|
| SEC-001 | NASA FIRMS MAP_KEY stored as server-side env var; never exposed to client | USER-REQUIRED | PROPOSED | 05_security.md | DEC-001 | MAP_KEY absent from all API responses and frontend bundles | active |
| SEC-002 | GEE service account credentials stored as server-side env var only | USER-REQUIRED | PROPOSED | 05_security.md | DEC-002 | Credentials absent from all client-side code | active |
| SEC-003 | Citizen photo uploads validated in order: Content-Type -> file size <=5MB -> magic bytes -> EXIF stripped before processing | USER-REQUIRED | PROPOSED | 05_security.md | REQ-009 | Malformed upload returns 400; oversized returns 413 | active |
| SEC-004 | FastAPI CORS allows only Vercel domain and localhost | USER-REQUIRED | PROPOSED | 05_security.md | none | Cross-origin from arbitrary domain returns 403 | active |
| SEC-005 | Photo upload endpoint rate-limited to 10 req/min per IP | USER-REQUIRED | PROPOSED | 05_security.md | REQ-009 | 11th request within 60s returns 429 | active |
| SEC-006 | FL weight updates contain only gradient/weight tensors; no raw training data | USER-REQUIRED | INFERRED | 05_security.md | REQ-008 | Flower client fit() returns only parameters tensors not raw data | active |

---

## Decisions (DEC)

| ID | Decision | Status | Evidence | Consequence |
|---|---|---|---|---|
| DEC-001 | NASA FIRMS REST API (VIIRS_SNPP_NRT) as primary fire source | VERIFIED | NASA FIRMS API docs 2026-09-06 | Requires free MAP_KEY; mock fallback available |
| DEC-002 | Google Earth Engine for Sentinel-5P TROPOMI (L3_NO2 and L3_AER_AI); pre-computed tile fallback | VERIFIED | GEE Catalog COPERNICUS/S5P/NRTI/L3_NO2 and L3_AER_AI 2026-09-06 | Requires free GEE account |
| DEC-003 | OpenAQ v3 API as ground AQI source; no key required | VERIFIED | OpenAQ API docs 2026-09-06 | No credential needed |
| DEC-004 | Flower in-process simulation; 2 virtual clients; 10 rounds FedAvg | VERIFIED | Flower fl.simulation docs 2026-09-06 | Single-machine; no infra cost |
| DEC-005 | flutter_local_notifications + background_fetch for push; no Firebase | VERIFIED | flutter_local_notifications pub.dev 2026-09-06 | OS-native; zero cloud dependency |
| DEC-006 | Backend: Railway or Render free tier; FastAPI+Uvicorn; PostgreSQL+PostGIS | ASSUMED | User confirmed ok with mocking locally 2026-09-06 | Cold-start latency ~500ms acceptable for demo. Must confirm platform name availability before SESSION-006. |
| DEC-007 | Frontend: Vercel free tier for Next.js 14 App Router | VERIFIED | Vercel pricing 2026-09-06 | Instant deploys; Next.js native |
| DEC-008 | Flutter map: maplibre_gl ^0.27.0 with HeatmapStyleLayer | VERIFIED | maplibre.org Flutter docs 2026-09-06 | No Mapbox token; GPU-accelerated |
| DEC-009 | Flutter state: Riverpod v2 AsyncNotifierProvider + StreamProvider | VERIFIED | Riverpod docs 2026-09-06 | Type-safe; async-native; 2024 recommended |
| DEC-010 | AQI broadcast unit: India AQI index (CPCB 24h breakpoints) computed from PM2.5 ug/m3; raw PM2.5 values labeled pm25_ugm3; AQI index values labeled aqi_index | PROPOSED | CPCB National AQI breakpoints table | Eliminates unit ambiguity in WebSocket and REST responses |
| DEC-011 | /citizen GoRouter route is a sub-route of / rendered as ModalBottomSheet; bottom nav remains 5 tabs; back navigation from /citizen pops to / | PROPOSED | 02_ux.md navigation spec | Resolves GoRouter vs ModalBottomSheet ambiguity |

---

## Non-Goals (NON)

| ID | Statement | Status |
|---|---|---|
| NON-001 | National rollout to all Indian cities | active |
| NON-002 | Real distributed FL nodes on separate servers | active |
| NON-003 | Live WhatsApp Business API integration | active |
| NON-004 | Live SPCB ticket submission to government systems | active |
| NON-005 | Firebase / OneSignal / any third-party push service | active |
| NON-006 | User authentication or accounts | active |
| NON-007 | Full HYSPLIT model; simplified Gaussian-plume sufficient | active |

---

## Risks (RISK)

| ID | Risk | Prob | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| RISK-001 | FIRMS MAP_KEY not obtained before demo | Medium | Medium | Pre-fetch real data as static GeoJSON fallback | open |
| RISK-002 | GEE account not activated before demo | Medium | Low | Pre-computed AAI and NO2 GeoJSON tiles served statically | open |
| RISK-003 | Railway/Render free-tier cold-start >2s | High | Low | /health ping to keep warm; acceptable for demo | open |
| RISK-004 | maplibre_gl iOS native linking issues | Low | High | Verify Android first; iOS simulator before submission | open |
| RISK-005 | Flower 10-round simulation takes >30s on demo machine | Low | Medium | Pre-train and cache round metrics; stream on demand | open |
| RISK-006 | Open-Meteo wind data 1-3h lag affects trajectory accuracy | Medium | Low | Noted as known limitation in UI | accepted |
| RISK-007 | Chosen Vercel project name already taken; actual URL differs from expected | Low | Low | Record actual URL at deploy time; update CORS_ORIGINS and NEXT_PUBLIC_API_URL accordingly | open |

---

## Workstreams (WORK)

| WORK ID | Path | Owned IDs | Shared interface | Dependencies | Status |
|---|---|---|---|---|---|
| WORK-001 | backend/ | REQ-001 to REQ-011 SEC-001 to SEC-006 | REST+WebSocket API contract (04_api.md) | none | not started |
| WORK-002 | mobile/ | REQ-012 REQ-015 | REST+WebSocket API contract (04_api.md) | WORK-001 API stable | not started |
| WORK-003 | web/ | REQ-013 | REST+WebSocket API contract (04_api.md) | WORK-001 API stable | not started |

---

## Critic / Build Progress

| Item | Status |
|---|---|
| Architecture Proposal | USER-APPROVED REV-001 2026-09-06 |
| Audit | 17 issues found and fixed in REV-002 |
| Critic Packet | Not yet issued |
| Critic verdict | Pending |
| Sessions completed | 0 of 7 planned |
| Active blockers | None |

---

## Next Valid Action

All specification documents complete (REV-002). Issue CRITIC_REVIEW packet, then proceed to SESSION-001.
