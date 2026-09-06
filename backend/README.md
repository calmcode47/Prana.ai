# PRANA backend

FastAPI backend only. No website or mobile frontend is included or required.

## Run on this machine

From the repository root (`Prana.ai`):

```powershell
./backend/scripts/run-local.ps1
```

The isolated PostgreSQL 16.15 / PostGIS 3.6.2 instance lives in `.local/`, listens only on `127.0.0.1:55432`, and uses a generated password saved in the ignored `backend/.env`. It is not a Windows service. The launcher starts that database when necessary and runs the API on port 8000. If the API is already running, it prints its address.

- API documentation: http://127.0.0.1:8000/docs
- Process liveness: http://127.0.0.1:8000/health
- Database readiness: http://127.0.0.1:8000/ready

The database is persistent. Back up `.local/pgdata` using PostgreSQL backup tools before removing the local runtime. To stop only the local database after stopping the API:

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

Without a `DATABASE_URL`, development mode uses ephemeral in-memory storage. For persistent storage, configure a PostgreSQL database with PostGIS privileges, or run `docker compose up --build` from the repository root. The Docker build context is the repository root:

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
| `GEE_SERVICE_ACCOUNT_JSON` | Earth Engine service-account JSON |
| `GEE_PROJECT_ID` | Enabled Earth Engine project; defaults to the credential project |
| `DATABASE_URL` | Persistent PostgreSQL/PostGIS database |
| `CORS_ORIGINS` | Comma-separated allowed client origins |
| `PRANA_SCHEDULER_ENABLED` | Enable startup ingestion, 15-minute refresh, and 60-second telemetry |

Open-Meteo does not require credentials for this development integration. Credentials are redacted from HTTP request logs. Provider failures are not evidence of zero pollution; successful empty provider results are retained as empty results.

## Backend behavior

- Station responses support PM2.5 and include source, observation time, and an estimated PM2.5 AQI sub-index. Unsupported pollutants are rejected instead of mislabeled as PM2.5.
- OpenAQ NO2/SO2 observations are stored separately. Anomaly detection uses each station's same-unit history in India local time and needs at least eight readings. Synthetic anomalies are labeled and never persisted as live detections.
- Citizen uploads are limited before multipart parsing, decoded with a pixel limit, stripped of metadata, and reduced to a hash and result. Original photos are not saved. Duplicate sanitized photos are stored once.
- Incident creation stores the report before broadcasting. Satellite evidence is calculated from recent live observations when available; missing evidence stays null. `/alerts/latest?lang=en|hi|pa` supports English, Hindi, and Punjabi.
- WebSockets support `/ws/delhi`, `/ws/ncr`, `/ws/punjab`, and `/ws/haryana`, with an initial snapshot, ping/pong, 60-second updates, and incident broadcasts.
- Federated simulation uses real NumPy FedAvg training and measured scores on synthetic data. Independent local-only baselines receive the same training budget. It is not Flower and has no formal differential-privacy guarantee.
- The SensorThings route is a read-only Things adapter, not a certified implementation of the entire OGC SensorThings standard.

The dispersion and photo models are heuristics, not validated environmental measurement instruments. PM2.5 sub-indices computed from instantaneous readings or estimates are not official 24-hour, multi-pollutant AQI observations. The CPCB display range is capped at 500.

## Verification

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

`seed_db.py --verify-only` checks the schema and counts. Other seeder modes insert demonstration data; `--clean` deletes existing rows and should only be used with disposable development databases. Synthetic seeding is refused in production. Verification and load-test commands return failure exit codes on errors.

NASA's live integration test is separate: `pytest backend/tests -m integration`. A successful fallback cannot satisfy it. No cloud deployment is needed for the local backend.

## Adapter references

The OpenAQ adapter joins [location sensor metadata with latest observations](https://docs.openaq.org/resources/latest). Open-Meteo requests [wind speeds in metres per second](https://open-meteo.com/en/docs). Earth Engine uses an explicit [start/end date range](https://developers.google.com/earth-engine/apidocs/ee-imagecollection-filterdate) and requests [sample geometries](https://developers.google.com/earth-engine/apidocs/ee-image-sampleregions). AQI categories follow [CPCB's National AQI explanation](https://cpcb.gov.in/displaypdf.php?id=bmF0aW9uYWwtYWlyLXF1YWxpdHktaW5kZXgvQWJvdXRfQVFJLnBkZg%3D%3D).
