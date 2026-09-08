# Backend verification report

Verified locally on 8 September 2026. This report supersedes the previous unsupported “94% production ready” checklist.

## Result

The backend runs at **http://127.0.0.1:8000**. The current user-supplied configuration leaves `DATABASE_URL` empty, so this running process uses ephemeral in-memory storage. The isolated **PostgreSQL 16.15 / PostGIS 3.6.2** database on loopback port 55432 remains available and passed the dedicated persistence suite, but it is not selected by the current environment file. Backend work only was performed in this task; no frontend changes were made.

The current scope is local backend completion plus connection of the existing web and mobile clients. Cloud deployment is explicitly excluded at the user's request. All new verification artifacts and temporary files are kept inside this repository.

| Verification | Result |
| --- | --- |
| Unit and regression suite | **102 passed**, one PostGIS test skipped when no test URL is supplied |
| Dedicated real PostGIS suite | **1 passed** after applying the expanded schema |
| External NASA integration test | Deselected; a live API key is required |
| Preflight checks with local PostGIS | **25 passed**, zero failures |
| Concurrent load benchmark | **298 successful requests**, zero request errors |
| Actual HTTP process | Health/readiness and backend REST routes respond successfully |
| Repeatable local deployment verifier | **7 passed**, including all four WebSocket channels |
| Local production-mode HTTPS/WSS checks | **12 passed**, including TLS trust, CORS, and unavailable-input handling |
| WebSockets | Snapshot, ping/pong, incident broadcasts, periodic telemetry implemented and tested |
| Dependency consistency and critical Python lint | Passed |
| Docker execution | Not run locally: Docker is not installed |
| Cloud deployment | Outside current scope; no deployment performed |

### Live provider check after credential configuration

| Provider | Result |
| --- | --- |
| NASA FIRMS | Passed; 4 current corridor hotspots returned |
| Open-Meteo weather | Passed; current Punjab and Delhi records returned |
| Open-Meteo CAMS global air quality | Passed; 24 current corridor grid cells returned |
| OpenAQ v3 | Passed; 5 current Indian stations met the 24-hour freshness rule. Older and non-Indian provider records are excluded. |

The suite has four dependency deprecation warnings; no test failures. It tests behavior, not 100% code coverage.

## Completed corrections

- Added persistent citizen reports with sanitized image hashes, coordinate validation, and duplicate protection. Original photos and EXIF metadata are not stored. Uploads are bounded before multipart buffering, including chunked requests; decoded image dimensions are bounded too.
- Added backend-only legal draft generation, downloadable PDFs, current-law electronic-record certificate drafts, evidence dossier/GeoJSON export, dispatch tracking, and a truthful registry with no fabricated warrants.
- Added authenticated CEMS telemetry ingestion and reproducible scrubber-bypass review indicators based on stored readings.
- Added live weather vector/boundary-layer telemetry, stored-data fire/AQI lag correlation, regional FRP shares, briefing text/RSS, mobile release metadata, and an external-integration requirements endpoint.
- Added real 2048-bit Paillier homomorphic aggregation, record-level DP-SGD with configurable epsilon/delta, a conservative accountant, and persisted measured training-loss telemetry.
- Added an offline real-world evaluation command that calculates MAE, RMSE, bias, R², and Pearson correlation from user-supplied paired observations without fetching data.
- Made database initialization transactional and fail when a configured database cannot connect or initialize. Added an actual readiness probe, observation deduplication, and NO2/SO2 history storage. There are eight application tables, in addition to PostGIS-owned objects.
- Verified incident, photo, observation, forecast geometry, and federated-result persistence against real PostGIS, including reconnecting with empty process caches.
- Made federated round batches transactional and updated process metrics only after the database commit. Verified a rejected second round rolls back the entire batch without publishing partial results. Duplicate in-memory rounds now update their scores consistently with PostgreSQL.
- Corrected live-mode WebSocket fire counts to exclude demonstration records, rejected empty production CORS lists, and removed database credential output from the legacy smoke-check script.
- Corrected OpenAQ v3 ingestion to join actual location-level latest sensor observations. Removed invented readings, retained measurement times, excluded non-Indian stations, and separated NO2/SO2 history from PM2.5.
- Corrected Open-Meteo wind units, current/hourly field handling, and boundary-layer-height selection. Live weather retrieval succeeded for Punjab and Delhi.
- Replaced Earth Engine with the keyless Open-Meteo CAMS global air-quality endpoint for AOD, surface NO₂, PM2.5, dust, SO₂, and ozone. The implementation preserves the scientific distinction between AOD and Sentinel-5P AAI.
- Removed fabricated federated convergence curves. Returned scores now come from trained models and independent local-only baselines evaluated on the same synthetic corridor test set.
- Added per-channel snapshots, 60-second telemetry, incident broadcasts, dead-connection removal, and duplicate-send protection. Startup ingestion runs immediately and refreshes every 15 minutes.
- Removed manufactured incident tickets and satellite proof. Incident evidence is calculated from recent live fire observations when available. Added date filtering and validation, empty-state responses, trilingual latest alerts, and rate-limit regression coverage.
- Separated labeled historical/synthetic demo data from live observations. Disabled demo mode returns unavailable inputs instead of replacing failures with synthetic data. Successful empty provider results stay empty.
- Corrected the PM2.5 sub-index to the 0–500 CPCB display range, rejected non-finite values, and labeled instantaneous readings as estimates rather than official daily AQI.
- Added atomic file caches and shared ingestion requests. Offloaded model training from the API event loop, bounded federated run lengths, and prevented overlapping simulation runs.
- Corrected container build context, dynamic port handling, single-worker startup, CI PostGIS testing, and failure exit codes in verification commands. Added a verified dependency lock and local run instructions.

## Load evidence

Measured on this machine with the dedicated test PostGIS database and an ASGI concurrency harness on 7 September. All 298 requests succeeded. These timings include initial computation/upstream weather retrieval. Surface p95 was 1.03 seconds, slightly above the harness's one-second warning threshold; it is not a sub-second guarantee.

| Endpoint | Requests | p95 milliseconds |
| --- | ---: | ---: |
| Health | 100 | 5.91 |
| Hotspots | 50 | 286.73 |
| Surface | 30 | 1029.62 |
| Plume | 30 | 1078.71 |
| Anomalies | 30 | 38.99 |
| Photo upload | 8 | 778.53 |
| Federated status | 50 | 12.53 |

## Boundaries of verification

The 102-test unit/regression suite and the dedicated real PostGIS test pass. Live-provider verification rejects fallback, stale, foreign-corridor data and reports missing credentials; fresh weather passed for both regions. Read-only verification covers HTTP readiness, required routes, and all four WebSocket channels. The plume model no longer substitutes invented fire power, missing weather, or a minimum pollution floor; tests cover physical behavior and invalid inputs. Deployment documentation is retained for future use and is outside the current local-only scope.

- NASA FIRMS and OpenAQ keys are configured locally. Open-Meteo weather and CAMS air quality require no key. Historical demo data is explicitly identified and disabled in the current local configuration.
- This is a single-server backend. Multiple API workers/replicas require shared rate limiting, scheduling, and WebSocket messaging. Celery/Redis and remote deployment were not added.
- The atmospheric and image models are prototypes. The photo estimator is a DCP heuristic, the plume model is simplified, and federated results are measured on synthetic datasets. Scientific field accuracy is not established until representative paired observations are supplied. The DP accountant covers this simulator's full-batch Gaussian mechanism; deployment-level privacy requires separated trust domains and operational review.
- Federated learning uses **NumPy FedAvg**, not Flower. The SensorThings endpoint is a read-only Things adapter, not a certified implementation of the complete OGC standard.
- Instantaneous PM2.5 sub-index estimates are not official 24-hour multi-pollutant AQI. No government notifications or portal submissions are sent.

See [README.md](README.md) for startup, configuration, test commands, and official adapter references.
