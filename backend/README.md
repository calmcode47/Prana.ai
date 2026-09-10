# PRANA backend

This guide covers the FastAPI backend. It runs independently of any website or mobile frontend.

## Run on this machine

From the repository root (`Prana.ai`):

```powershell
./backend/scripts/run-local.ps1
```

The launcher uses the PostgreSQL/PostGIS connection in `DATABASE_URL` when one is configured and starts the repository-local database when that configuration points to it. Without a database URL, development uses a durable JSON store at `.local/prana-store.json`. It runs the API on all network interfaces on port 8000 so a phone on the same Wi-Fi can connect. If the API is already running, it prints its address.

- API documentation: http://127.0.0.1:8000/docs
- Process liveness: http://127.0.0.1:8000/health
- Database readiness: http://127.0.0.1:8000/ready

Both local storage options persist across backend restarts. PostgreSQL is required in production and remains the appropriate multi-user store. Back up `.local/pgdata` with PostgreSQL tools, or copy `.local/prana-store.json` when using the development fallback. To stop only the repository-local database after stopping the API:

```powershell
./.local/pgsql/bin/pg_ctl.exe -D .local/pgdata stop -m fast
```

## Fresh checkout

Python 3.12 or newer is required. The validated Windows environment uses Python 3.14. Install the tested dependency set:

```powershell
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
Copy-Item backend/.env.example backend/.env
./backend/.venv/Scripts/python.exe -m backend.scripts.serve
```

Without a `DATABASE_URL`, development mode checkpoints its local API records to `.local/prana-store.json`. For production-grade persistence, configure PostgreSQL with PostGIS privileges. For Docker Compose, copy `backend/.env.docker` to the repository-root `.env`, set every required secret, then run `docker compose up --build` from the repository root. The Docker build context is the repository root:

```text
docker build -f backend/Dockerfile -t prana-backend .
```

Schema creation and additive migrations run transactionally on startup. Existing ingestion duplicates are collapsed before unique indexes are created. A configured database failure stops startup; it never silently switches to ephemeral storage. `/ready` probes the database on each call. `/health` indicates that the process can answer requests.

Use one API worker/replica: the scheduler, rate limits, computation cache, and WebSocket subscriptions are process-local. Multiple workers require shared coordination and are outside the current single-server design.

## Data modes

`PRANA_DEMO_MODE=true` permits explicitly identified historical sample inputs when a provider is unavailable. Sample timestamps are retained. Time-filtered hotspot requests may correctly return no recent fires. Forecasts based on historical examples identify those sources; they are demonstrations, not current forecasts.

`PRANA_ENV=production` requires PostgreSQL and explicit CORS origins and defaults demo mode to false. With demo mode disabled, missing provider inputs produce an unavailable response instead of fabricated observations.

Configure secrets only in the ignored environment file or hosting provider settings:

| Setting | Purpose |
| --- | --- |
| `FIRMS_MAP_KEY` | NASA FIRMS live fire observations |
| `OPENAQ_API_KEY` | OpenAQ v3 station and sensor observations |
| `DATABASE_URL` | Persistent PostgreSQL/PostGIS database |
| `TTS_PROVIDER_KEY` / `OPENAI_API_KEY` | Generate real MP3 incident briefings through an OpenAI-compatible speech endpoint |
| `TTS_PROVIDER_URL`, `TTS_MODEL`, `TTS_VOICE` | Optional speech endpoint and voice configuration |
| `CORS_ORIGINS` | Comma-separated allowed client origins |
| `PRANA_SCHEDULER_ENABLED` | Enable startup ingestion, 15-minute refresh, and 60-second telemetry |
| `CEMS_INGEST_KEYS_JSON` | JSON mapping of facility IDs to separate ingestion credentials; each batch is restricted to one mapped facility |
| `PRANA_FL_DP_ENABLED` | Enable record-level DP-SGD; defaults to true |
| `PRANA_FL_DP_EPSILON` / `PRANA_FL_DP_DELTA` | Privacy budget; defaults to 0.42 and 0.00001 |
| `PRANA_FL_PAILLIER_ENABLED` | Enable 2048-bit Paillier aggregation; defaults to true |

Open-Meteo weather and CAMS global air-quality endpoints do not require credentials for noncommercial use within their published limits. The CAMS adapter supplies current AOD, NO₂, PM2.5, dust, SO₂, and ozone fields. Credentials are redacted from HTTP request logs. Provider failures are not evidence of zero pollution; successful empty provider results are retained as empty results.

## Backend behavior

- Station responses support PM2.5 and include source, observation time, and an estimated PM2.5 AQI sub-index. Unsupported pollutants are rejected instead of mislabeled as PM2.5.
- OpenAQ NO2/SO2 observations are stored separately. Anomaly detection uses each station's same-unit history in India local time and needs at least eight readings. Synthetic anomalies are labeled and never persisted as live detections.
- Citizen uploads are limited before multipart parsing, decoded with a pixel limit, stripped of metadata, and reduced to a hash and result. Original photos are not saved. Duplicate sanitized photos are stored once.
- Incident creation stores the report before broadcasting. Satellite evidence is calculated from recent live observations when available; missing evidence stays null. `/alerts/latest?lang=en|hi|pa` supports English, Hindi, and Punjabi.
- WebSockets support `/ws/delhi`, `/ws/ncr`, `/ws/punjab`, and `/ws/haryana`, with an initial snapshot, ping/pong, 60-second updates, and incident broadcasts.
- Federated simulation uses NumPy FedAvg, record-level clipped DP-SGD with Gaussian noise, a conservative zCDP privacy accountant, and 2048-bit Paillier homomorphic aggregation. It returns measured local/global loss and accuracy. The included run is a single-process protocol simulation on synthetic data; production privacy also requires separate client/key-holder trust domains.
- Legal routes create review drafts, PDFs, electronic-record certificate drafts, evidence ZIP/GeoJSON exports, and internal dispatch records. They do not issue a direction, warrant, signature, or authority notification.
- CEMS routes accept authenticated facility batches and flag deterministic scrubber-load/stack-velocity patterns for review. A flag is not proof of tampering.
- Meteorology exposes Open-Meteo wind vectors and boundary-layer heights. It explicitly reports inversion depth as unavailable because a vertical temperature profile is required.
- Analytics calculate stored-data fire/AQI lag correlations and regional FRP shares. Mass-emission output remains empty until an approved conversion coefficient is configured.
- Briefing routes produce incident-derived text and RSS. Mobile release metadata returns no content until a signed application artifact and checksum are configured.
- The SensorThings route is a read-only Things adapter, not a certified implementation of the entire OGC SensorThings standard.

The dispersion and photo models are heuristics, not validated environmental measurement instruments. PM2.5 sub-indices computed from instantaneous readings or estimates are not official 24-hour, multi-pollutant AQI observations. The CPCB display range is capped at 500.

See [EXTERNAL_API_REQUIREMENTS.md](EXTERNAL_API_REQUIREMENTS.md) for the exact external accounts and local validation-data format. The validation command reads only a supplied repository-local CSV and never downloads a dataset.

## Verification

Current scope is local backend completion. No hosting account or deployment is required. See [BACKEND_STATUS_REPORT.md](BACKEND_STATUS_REPORT.md) for measured results and the distinction between live weather, labeled sample providers, and model estimates. Deployment reference material is retained for future use.

```powershell
./backend/.venv/Scripts/python.exe -m pytest backend/tests -q -m 'not integration'
./backend/.venv/Scripts/python.exe backend/scripts/preflight_check.py
./backend/.venv/Scripts/python.exe backend/tests/load_test.py
```

The normal suite isolates environment settings, rate limits, caches, and memory. PostGIS tests skip unless `PRANA_TEST_DATABASE_URL` names a dedicated database ending in `_test`; that test clears its tables. Never use an application database for this setting.

On this configured machine, run the complete suite, including PostGIS:

```powershell
$env:PRANA_TEST_DATABASE_URL = 'postgresql://prana:' + (Get-Content .local/db-password.txt -Raw) + '@127.0.0.1:55432/prana_test'
./backend/.venv/Scripts/python.exe -m pytest backend/tests -q -m 'not integration'
```

For repository-contained temporary files, set `TEMP`, `TMP`, and `TMPDIR` to the absolute `.local/tmp` directory before testing. Production-mode behavior can also be verified locally without publishing the API:

```powershell
./backend/.venv/Scripts/python.exe -m backend.scripts.verify_production_local
```

This uses `PRANA_TEST_DATABASE_URL`, starts a temporary loopback HTTPS server, checks all four WSS channels, CORS, certificate trust, and missing-input behavior, then stops that server. Certificates, logs, and the report stay in `.local/production-verification/`. System certificate trust is unchanged. This check does not replace real provider or scientific validation.

`seed_db.py --verify-only` checks the schema and counts. Other seeder modes insert demonstration data; `--clean` deletes existing rows and should only be used with disposable development databases. Synthetic seeding is refused in production. Verification and load-test commands return failure exit codes on errors.

NASA's live integration test is separate: `pytest backend/tests -m integration`. A successful fallback cannot satisfy it. No cloud deployment is needed for the local backend.

## Adapter references

The OpenAQ adapter joins [location sensor metadata with latest observations](https://docs.openaq.org/resources/latest). Open-Meteo provides [weather](https://open-meteo.com/en/docs) and [CAMS global air-quality fields](https://open-meteo.com/en/docs/air-quality-api). AOD is retained as aerosol optical depth and is never mislabeled as Sentinel-5P absorbing aerosol index. AQI categories follow [CPCB's National AQI explanation](https://cpcb.gov.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvQWJvdXRfQVFJLnBkZg%3D%3D).
