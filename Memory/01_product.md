# PRANA — Product Overview & Acceptance Criteria
## 01_product.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Defines problem, defining value, user roles, primary workflow, failure paths, and acceptance evidence |
| Canonical IDs | REQ-001 to REQ-015, NON-001 to NON-007 |
| Dependencies | 00_registry.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## Problem Statement

Every October-November, Punjab and Haryana farmers burn an estimated 35 million tonnes of paddy stubble. The smoke, carried south-east by post-monsoon winds, turns Delhi NCR into the world's most polluted megacity for 4-6 weeks. AQI readings regularly exceed 500 (Hazardous). The Supreme Court has issued annual emergency orders since 2017.

The structural problem is not lack of data — it is lack of fusion and federation:

- Satellite data (Sentinel-5P) is dense but coarse and biased.
- Ground stations (~700 CPCB stations nationally) are accurate but sparse.
- Punjab will not hand raw agricultural data to a Delhi-run platform.
- Tier-2 cities have no sensor network at all.
- No existing system produces a 72-hour fire-to-smog forecast that regulators can act on.

## Defining Value

PRANA fuses satellite, ground, meteorological, and citizen data into a single continuous AQI surface, then runs a Gaussian-plume trajectory model to forecast exactly which fire clusters will affect which cities in the next 24-72 hours. It does this without requiring any state to share raw data — federated learning means only model weights cross boundaries. It then closes the loop: auto-generated incident tickets for regulators, OS-level push alerts for citizens.

## Assurance Profile

STANDARD — multi-session, external APIs, persistence, public deployment, formal portfolio evaluation.
Selected triggers: portfolio evaluation, external satellite/AQI APIs, public Vercel deployment, WebSocket real-time transport, citizen photo upload (file validation risk).

---

## User Roles

| Role | Platform | Primary need |
|---|---|---|
| Citizen / Outdoor worker | Flutter mobile app | Real-time local AQI, push alerts, health advisories |
| Farmer (Punjab/Haryana) | Mobile app | Fire-day forecast, advisory push |
| SPCB / Regulator | Web dashboard | Incident tickets, satellite evidence, anomaly flags |
| Judge / Policy maker | Web dashboard | Evidence-backed corridor view, FL privacy proof |
| Researcher | Web API docs | OGC SensorThings access, data export |

---

## Primary Workflow (Happy Path)

1. Backend scheduler runs every 15 minutes.
2. Ingester fetches FIRMS fire hotspots, OpenAQ ground AQI, Open-Meteo wind + temperature for corridor bbox.
3. GP Downscaler fuses CAMS global aerosol optical depth + ground PM2.5 into a PM2.5 surface grid.
4. Gaussian-plume model generates t+24/48/72h affected-zone polygons.
5. IsolationForest scans per-station NO2 time series for nighttime anomalies.
6. WebSocket server broadcasts updated data to all subscribed clients.
7. Flutter app and Next.js dashboard re-render with new fire dots, heatmap, and trajectory polygons.
8. If AQI index crosses threshold (>300) or new fire cluster detected near corridor: alert event emitted; incident ticket auto-generated.
9a. App in foreground: WebSocket alert event received -> in-app notification banner rendered immediately.
9b. App backgrounded or killed: background_fetch wakes app every 15 minutes, polls /api/v1/alerts/latest -> if new alert found, flutter_local_notifications fires OS banner.
10. Citizen submits sky photo; backend returns PM2.5 estimate within 3s.
11. Incident ticket visible in SPCB feed with satellite evidence fields.

---

## Failure Paths

| Failure | Detection | Recovery behavior |
|---|---|---|
| FIRMS API unavailable / no MAP_KEY | HTTP 4xx/5xx or empty response | Serve cached last-known GeoJSON; UI shows "data as of [timestamp]" |
| GEE quota exceeded | GEE API error | Serve pre-computed static AAI/NO2 tiles; UI shows "satellite data delayed" |
| OpenAQ API unavailable | HTTP timeout | Use last cached ground readings; mark stations grey on map |
| Open-Meteo unavailable | HTTP timeout | Use last cached wind + temperature field; trajectory model uses cached inputs |
| Backend cold-start latency | First request slow | Frontend shows skeleton loaders; /health ping keeps warm |
| Citizen photo: invalid type or oversized | File validation (Content-Type then size then magic bytes) | Return 400/413 with user-friendly error message |
| WebSocket disconnect | Client-side reconnect | Exponential backoff reconnect (max 5 attempts); fall back to polling /api/v1/aqi/stations every 60s |
| App backgrounded — WebSocket inactive | background_fetch 15-min poll | background_fetch polls /api/v1/alerts/latest; OS notification if new alert |
| FL simulation timeout | >60s for 10 rounds | Stream pre-cached round metrics; note "simulation cached" in UI |

---

## Explicit Non-Goals

See 00_registry.md NON-001 through NON-007. In summary: no national rollout, no live government API submission, no real distributed FL infra, no WhatsApp API, no Firebase/OneSignal, no user accounts, no HYSPLIT.

---

## Acceptance Evidence (per requirement)

| ID | Acceptance check |
|---|---|
| REQ-001 | GET /api/v1/hotspots returns GeoJSON FeatureCollection with >=1 fire point in Punjab/Haryana bbox |
| REQ-002 | GEE (or fallback tile) AAI raster visible on map dashboard as colored overlay; NO2 layer also available |
| REQ-003 | GET /api/v1/aqi/stations returns >=10 Delhi/NCR station objects with pm25_ugm3 value |
| REQ-004 | Wind vectors rendered as arrows on map; boundary layer height and temperature_2m logged in trajectory payload |
| REQ-005 | GET /api/v1/aqi/surface returns GeoJSON grid; cells cover 73.5-77.5E 28.5-32.5N; each has pm25_estimate |
| REQ-006 | GET /api/v1/forecast/plume returns exactly 3 polygon features per fire cluster (24h 48h 72h) |
| REQ-007 | GET /api/v1/anomalies returns array with anomaly_score and is_anomaly boolean; nighttime and daytime rows distinct per station-day |
| REQ-008 | GET /api/v1/federated/status returns rounds array length 10 with ascending global_accuracy; final global > punjab and > delhi |
| REQ-009 | POST /api/v1/citizen/photo with valid JPEG returns {pm25_estimate: number, confidence: string} in <3s |
| REQ-010 | POST /api/v1/alerts/incident creates ticket; GET /api/v1/alerts returns it with satellite_evidence field |
| REQ-011 | Simulated AQI spike triggers WebSocket message received by connected Flutter app and Next.js client within 5s |
| REQ-012 | Flutter app: all 6 screens (Dashboard Map Forecast Citizen Alerts FL) render on Android emulator without crash |
| REQ-013 | Next.js: all 6 pages (/ /dashboard /forecast /federated /alerts /api-docs) load at Vercel deployment URL; Lighthouse score >=70 on mobile |
| REQ-014 | GET /api/v1/sensorthings/Things returns JSON with @iot.count and value array |
| REQ-015 | Foreground: WebSocket alert -> in-app banner appears. Background: app backgrounded; next background_fetch poll finds new alert; OS notification banner appears within one poll cycle (<=15 min) |

---

## Delivery Feasibility

Three parallel workstreams after backend API contract is stable:
- WORK-001 (backend) must reach stable API before WORK-002 (mobile) and WORK-003 (web) can complete integration.
- FL simulation (REQ-008) is backend-only; can be developed and cached independently.
- Static fallback data (RISK-001, RISK-002) means demo is viable even without live API keys.
- Vercel project name must be confirmed at SESSION-006; update CORS_ORIGINS and NEXT_PUBLIC_API_URL with actual URL (RISK-007).
