# Backend verification report

Verified locally on 7 September 2026. This report supersedes the previous unsupported “94% production ready” checklist.

## Result

The backend runs at **http://127.0.0.1:8000**, connected to an isolated, persistent **PostgreSQL 16.15 / PostGIS 3.6.2** database on loopback port 55432. The database and API start with `backend/scripts/run-local.ps1`. Backend work only was performed in this task; no frontend changes were made.

| Verification | Result |
| --- | --- |
| Unit, regression, and real PostGIS suite | **70 passed** |
| External NASA integration test | Deselected; a live API key is required |
| Preflight checks with local PostGIS | **22 passed**, zero failures |
| Concurrent load benchmark | **298 successful requests**, zero request errors |
| Actual HTTP process | Health/readiness and backend REST routes respond successfully |
| WebSockets | Snapshot, ping/pong, incident broadcasts, periodic telemetry implemented and tested |
| Dependency consistency and critical Python lint | Passed |
| Docker execution | Not run locally: Docker is not installed |
| Cloud deployment | Deferred per the request to finish and verify locally first |

The suite has four dependency deprecation warnings; no test failures. It tests behavior, not 100% code coverage.

## Completed corrections

- Added persistent citizen reports with sanitized image hashes, coordinate validation, and duplicate protection. Original photos and EXIF metadata are not stored. Uploads are bounded before multipart buffering, including chunked requests; decoded image dimensions are bounded too.
- Made database initialization transactional and fail when a configured database cannot connect or initialize. Added an actual readiness probe, observation deduplication, and NO2/SO2 history storage. There are eight application tables, in addition to PostGIS-owned objects.
- Verified incident, photo, observation, forecast geometry, and federated-result persistence against real PostGIS, including reconnecting with empty process caches.
- Corrected OpenAQ v3 ingestion to join actual latest sensor observations. Removed invented 120 µg/m³ readings, retained measurement times, and separated NO2/SO2 history from PM2.5.
- Corrected Open-Meteo wind units, current/hourly field handling, and boundary-layer-height selection. Live weather retrieval succeeded for Punjab and Delhi.
- Implemented both Earth Engine AAI and NO2 sampling with explicit date intervals, preserved point geometries, correct NO2 unit conversion, and the required SDK dependency.
- Removed fabricated federated convergence curves. Returned scores now come from trained models and independent local-only baselines evaluated on the same synthetic corridor test set.
- Added per-channel snapshots, 60-second telemetry, incident broadcasts, dead-connection removal, and duplicate-send protection. Startup ingestion runs immediately and refreshes every 15 minutes.
- Removed manufactured incident tickets and satellite proof. Incident evidence is calculated from recent live fire observations when available. Added date filtering and validation, empty-state responses, trilingual latest alerts, and rate-limit regression coverage.
- Separated labeled historical/synthetic demo data from live observations. Disabled demo mode returns unavailable inputs instead of replacing failures with synthetic data. Successful empty provider results stay empty.
- Corrected the PM2.5 sub-index to the 0–500 CPCB display range, rejected non-finite values, and labeled instantaneous readings as estimates rather than official daily AQI.
- Added atomic file caches and shared ingestion requests. Offloaded model training from the API event loop, bounded federated run lengths, and prevented overlapping simulation runs.
- Corrected container build context, dynamic port handling, single-worker startup, CI PostGIS testing, and failure exit codes in verification commands. Added a verified dependency lock and local run instructions.

## Load evidence

Measured on this machine with PostGIS and an ASGI concurrency harness on 6 September. These timings include initial computation/upstream weather retrieval and are not cloud latency guarantees.

| Endpoint | Requests | p95 milliseconds |
| --- | ---: | ---: |
| Health | 100 | 1.15 |
| Hotspots | 50 | 186.04 |
| Surface | 30 | 607.59 |
| Plume | 30 | 1160.36 |
| Anomalies | 30 | 709.01 |
| Photo upload | 8 | 808.89 |
| Federated status | 50 | 13.43 |

## Boundaries of verification

- NASA FIRMS, OpenAQ, and Earth Engine live credentials were not supplied. Their adapters have regression checks, but credentialed end-to-end verification remains pending. Historical demo data is explicitly identified.
- This is a single-server backend. Multiple API workers/replicas require shared rate limiting, scheduling, and WebSocket messaging. Celery/Redis and remote deployment were not added.
- The atmospheric and image models are prototypes. The photo estimator is a DCP heuristic, the plume model is simplified, and federated results are measured on synthetic datasets. Scientific field accuracy and formal privacy are not established by these software tests.
- Federated learning uses **NumPy FedAvg**, not Flower. The SensorThings endpoint is a read-only Things adapter, not a certified implementation of the complete OGC standard.
- Instantaneous PM2.5 sub-index estimates are not official 24-hour multi-pollutant AQI. No government notifications or portal submissions are sent.

See [README.md](README.md) for startup, configuration, test commands, and official adapter references.
