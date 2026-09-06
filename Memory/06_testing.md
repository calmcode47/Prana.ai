# PRANA — Testing & Verification Matrix
## 06_testing.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Defines verification layer, commands, expected evidence, and status for every REQ and SEC |
| Canonical IDs | All REQ-001 to REQ-015, SEC-001 to SEC-006 |
| Dependencies | 00_registry.md, 04_api.md, 03_data.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## CI / Credential Strategy

Backend integration tests that hit live external APIs (FIRMS, GEE, OpenAQ) must be marked `@pytest.mark.integration`. In CI environments (GitHub Actions, Railway build), these tests are skipped by default. Only unit tests and mocked integration tests run in CI.

Mocking strategy:
- `pytest-httpx` (or `respx`) for mocking outbound HTTP calls in unit tests
- `pytest.fixture` in `conftest.py` providing mock API response JSON files from `backend/tests/fixtures/`
- Integration tests: `pytest -m integration` (requires FIRMS_MAP_KEY and GEE credentials to be set)
- CI command: `pytest -m "not integration" --tb=short -v`
- Local full run: `pytest --tb=short -v` (requires .env loaded)

Test fixture files:
```
backend/tests/fixtures/
  firms_sample_response.csv       # Real FIRMS CSV with 10 fire rows for bbox
  openaq_locations_response.json  # 15 Delhi/NCR stations
  openaq_measurements_response.json
  open_meteo_response.json        # windspeed, winddirection, boundary_layer_height, temperature_2m
```

---

## Verification Matrix

| REQ/SEC | Behavior or failure | Test type | Command/tool | Expected evidence | Marker | Status |
|---|---|---|---|---|---|---|
| REQ-001 | FIRMS hotspot ingester returns >=1 fire in bbox | Unit (mocked) | pytest backend/tests/test_ingest.py::test_firms_fetch | JSON with count >= 1 from mock fixture | none | not run |
| REQ-001 | FIRMS live API returns real data with MAP_KEY | Integration (live) | pytest -m integration backend/tests/test_ingest.py::test_firms_live | HTTP 200; count > 0 | integration | not run |
| REQ-002 | GEE AAI query returns non-null FeatureCollection | Integration (live) | pytest -m integration backend/tests/test_ingest.py::test_gee_aai_fetch | GeoJSON with features list | integration | not run |
| REQ-002 | GEE NO2 query returns non-null FeatureCollection | Integration (live) | pytest -m integration backend/tests/test_ingest.py::test_gee_no2_fetch | GeoJSON with features list | integration | not run |
| REQ-003 | OpenAQ returns >=10 Delhi/NCR stations | Unit (mocked) | pytest backend/tests/test_ingest.py::test_openaq_fetch | @iot.count >= 10 from mock fixture | none | not run |
| REQ-004 | Open-Meteo returns wind + boundary layer + temperature fields | Unit (mocked) | pytest backend/tests/test_ingest.py::test_meteo_fetch | JSON contains windspeed_10m winddirection_10m boundary_layer_height temperature_2m | none | not run |
| REQ-005 | GP Downscaler produces surface grid covering bbox | Unit | pytest backend/tests/test_ml.py::test_downscaler_coverage | GeoJSON grid spans 73.5-77.5E 28.5-32.5N; every feature has pm25_estimate and aqi_index | none | not run |
| REQ-006 | Gaussian-plume returns exactly 3 polygons per cluster | Unit | pytest backend/tests/test_ml.py::test_trajectory_output | FeatureCollection with 3 Polygon features; horizon_hours set 24 48 72 | none | not run |
| REQ-007 | IsolationForest flags anomalies; nighttime+daytime rows distinct | Unit | pytest backend/tests/test_ml.py::test_anomaly_detector | is_anomaly=True for injected spike; UNIQUE (station, param, day, is_nighttime) enforced | none | not run |
| REQ-008 | FL simulation 10 rounds; global accuracy > local after round 7 | Integration | pytest backend/tests/test_fl.py::test_federated_training | fl_rounds table 10 rows; run_id+round_number unique; final global_accuracy > punjab and delhi | none | not run |
| REQ-009 | Photo upload returns pm25_estimate in <3s | Integration | pytest backend/tests/test_citizen.py::test_photo_upload | Response time < 3000ms; pm25_estimate float in [0,500]; aqi_index integer present | none | not run |
| REQ-010 | Incident ticket created and retrievable with both pm25 and aqi | Integration | pytest backend/tests/test_alerts.py::test_incident_lifecycle | POST 201 with incident_id; GET /api/v1/alerts returns same ID with measured_pm25 and measured_aqi | none | not run |
| REQ-011 | WebSocket alert received within 5s of threshold | Integration | pytest backend/tests/test_ws.py::test_alert_push (asyncio) | websockets client receives type=alert message within 5s of simulated aqi_index > 300 | none | not run |
| REQ-012 | Flutter app: all 6 screens render without crash | Widget test | flutter test mobile/test/ | All widget tests pass; no FlutterError in stdout | none | not run |
| REQ-013 | Next.js: all 6 pages build and load at deployment URL | Build + manual | npm run build (zero errors); Lighthouse CI | Build exits 0; all 6 routes return HTTP 200; Lighthouse mobile >= 70 | none | not run |
| REQ-014 | OGC SensorThings root returns valid schema | Contract | pytest backend/tests/test_sensorthings.py::test_things_schema | @iot.count integer; value array with 2 nodes | none | not run |
| REQ-015 | Foreground: WebSocket alert -> in-app banner | Widget test | flutter test mobile/test/alerts_test.dart::test_foreground_alert | Alert banner widget appears within 1 frame of mock WS event | none | not run |
| REQ-015 | Background: OS notification appears via background_fetch | Manual | Background app on Android emulator; POST /api/v1/alerts/incident to trigger; wait <=15 min | Notification banner appears in Android notification shade | none | not run |
| SEC-001 | MAP_KEY absent from all API response bodies | Security negative | grep FIRMS_MAP_KEY in curl responses from all endpoints | No key value found | none | not run |
| SEC-002 | GEE credentials absent from frontend bundles | Security negative | grep -r "private_key" web/.next/ | No credential found in any JS file | none | not run |
| SEC-003a | Size checked before body buffered (413 fast) | Security negative | time curl 6MB file to photo endpoint | HTTP 413 in <200ms (before body fully transferred) | none | not run |
| SEC-003b | Wrong MIME type rejected | Security negative | curl -X POST /citizen/photo -F photo=@test.exe | HTTP 400 | none | not run |
| SEC-003c | Wrong magic bytes rejected (JPEG header, TXT content) | Security negative | curl with file renamed .jpg but binary content is TXT | HTTP 400 | none | not run |
| SEC-004 | Cross-origin from arbitrary domain rejected | Security negative | curl -H "Origin: https://evil.com" /api/v1/hotspots | No Access-Control-Allow-Origin: https://evil.com | none | not run |
| SEC-005 | Rate limit on photo upload | Security negative | Loop 12 POST requests in 60s to /citizen/photo | Responses 1-10: 200; 11-12: 429 with Retry-After header | none | not run |
| SEC-006 | FL client fit() returns no raw data | Unit | pytest backend/tests/test_fl.py::test_fl_client_no_raw_data | fit() returns (list, int, {}); third element is empty dict | none | not run |

---

## Test File Structure

```
backend/
  tests/
    conftest.py             # pytest fixtures: test db, mock HTTP responses (respx/httpx), fixture loader
    fixtures/               # static response JSON/CSV for mocked integration tests
      firms_sample_response.csv
      openaq_locations_response.json
      openaq_measurements_response.json
      open_meteo_response.json
    test_ingest.py          # REQ-001 to REQ-004 (unit mocked + integration live)
    test_ml.py              # REQ-005 to REQ-007
    test_fl.py              # REQ-008, SEC-006
    test_citizen.py         # REQ-009, SEC-003, SEC-005
    test_alerts.py          # REQ-010
    test_ws.py              # REQ-011
    test_sensorthings.py    # REQ-014
    test_security.py        # SEC-001 to SEC-005

mobile/
  test/
    dashboard_test.dart     # REQ-012: Dashboard screen
    map_test.dart           # REQ-012: Map screen
    forecast_test.dart      # REQ-012: Forecast screen
    citizen_test.dart       # REQ-012: Citizen modal sheet
    alerts_test.dart        # REQ-012 + REQ-015: Alerts screen + foreground notification
    federated_test.dart     # REQ-012: FL screen
```

---

## Test Commands

```bash
# Backend: unit + mocked (CI-safe; no credentials needed)
pytest -m "not integration" --tb=short -v

# Backend: all including live API integration (requires .env)
pytest --tb=short -v

# Backend: single file
pytest backend/tests/test_ml.py -v

# Backend: coverage
pytest -m "not integration" --cov=backend --cov-report=term-missing

# Flutter widget tests
flutter test

# Flutter analyze
flutter analyze --no-pub

# Next.js build (TypeScript check included)
npm run build

# Next.js type check only
npx tsc --noEmit

# Security: check no secrets in API responses
curl -s https://prana-api.railway.app/api/v1/hotspots | grep -i "map_key\|firms_key\|private_key"
# Expected: no output

# Security: CORS check
curl -H "Origin: https://evil.com" https://prana-api.railway.app/api/v1/hotspots -v 2>&1 | grep -i "access-control"
# Expected: no Access-Control-Allow-Origin: https://evil.com
```

---

## Manual Verification Checklist

To be completed before submission:

- [ ] Flutter app installed on Android emulator (API 33+); all 6 screens navigable
- [ ] Flutter app installed on iOS simulator (iOS 16+); all 6 screens navigable
- [ ] Next.js site deployed to Vercel; all 6 pages (/ /dashboard /forecast /federated /alerts /api-docs) accessible
- [ ] Live fire hotspots visible on map (or fallback data banner shown)
- [ ] AQI heatmap visible as colored gradient overlay; both pm25_ugm3 and aqi_index shown on hover
- [ ] Forecast trajectory: time buttons animate polygon at 24/48/72h
- [ ] FL training animation plays; accuracy chart shows global > local by round 7+
- [ ] Photo upload: submit sky photo; receive PM2.5 and AQI estimate within 3s
- [ ] Alert feed: incident ticket visible with satellite_evidence fields
- [ ] Foreground notification: AQI spike triggers in-app banner immediately
- [ ] OS notification: background app; trigger alert; notification banner appears within one background_fetch cycle
- [ ] OGC endpoint: GET /api/v1/sensorthings/Things returns 2-node JSON
- [ ] CORS: cross-origin request from non-whitelisted domain rejected
- [ ] Actual Vercel URL recorded; CORS_ORIGINS env var updated on backend

---

## Known Limitations (Not Blocking)

| Limitation | Linked RISK | Acceptable |
|---|---|---|
| Live FIRMS data requires MAP_KEY (RISK-001) | RISK-001 | Yes — static fallback identical visually |
| Live TROPOMI requires GEE account (RISK-002) | RISK-002 | Yes — static fallback tiles used |
| Railway free-tier cold start (RISK-003) | RISK-003 | Yes — /health ping mitigates |
| Open-Meteo 1-3h lag on wind data (RISK-006) | RISK-006 | Yes — noted in UI |
| Gaussian-plume assumes Pasquill-Gifford class D stability | None | Yes — sufficient for demo; HYSPLIT explicitly excluded (NON-007) |
| FL uses synthetic training data | None | Yes — generated from real Oct-Nov statistics; demo not production |
| background_fetch minimum interval is 15 min (OS-enforced) | None | Yes — documented in REQ-015 acceptance; not a real-time push |
| OpenAQ v3 sort parameter syntax unverified | None | Low risk — verify during SESSION-001 against live API docs |
