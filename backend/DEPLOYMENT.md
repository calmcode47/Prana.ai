# Backend-only deployment and verification

The same REST API and WebSocket service can serve a future mobile app and website. Neither client is required for these steps. No frontend build is part of the backend container.

**Current scope: local backend only.** The user has explicitly deferred deployment. The cloud instructions below are reference material for later, not outstanding work for local completion.

## Verified locally on 7 September 2026

- 94 backend tests passed with the dedicated PostGIS test database; one credentialed integration test was excluded.
- Real Open-Meteo observations passed source, timestamp, coordinate, value, and wind-unit checks for Punjab and Delhi.
- All seven local deployment checks passed: health, persistent database readiness, API contract, and four WebSocket channels. The restarted API also returns the updated plume assumptions.
- All 22 local preflight checks passed. The migration-only command succeeded twice against the dedicated test database, verifying repeat execution.
- Deployment manifests passed the official Render and Railway JSON schemas. This validates configuration structure, not a completed cloud build.
- Plume checks cover wind direction, travel distance, calm wind, dilution, invalid inputs, and missing/zero fire power. These are software checks, not measurements of forecast accuracy.

## Credentials still required

Set these only in `backend/.env` locally or the hosting provider's secret settings:

| Setting | Required access |
| --- | --- |
| `FIRMS_MAP_KEY` | NASA FIRMS map key |
| `OPENAQ_API_KEY` | OpenAQ API key |

Run from the repository root:

```powershell
./backend/.venv/Scripts/python.exe -m backend.scripts.verify_live --output .local/live-verification.json
```

This separate process disables demo fallbacks and does not initialize a database connection. It refreshes provider caches. Exit status is 0 for all selected providers passing, 1 for a failed probe, and 2 for missing credentials. A successful empty response proves connectivity only; it does not prove model input coverage. The OpenAQ check requires returned station observations within 24 hours. To check only the credential-free weather adapter, add `--providers meteo`.

NASA FIRMS and OpenAQ require the configured keys. Open-Meteo weather and CAMS air quality require no key. Real field datasets with matching observations and predictions are still needed to measure environmental model accuracy. Photo and plume outputs remain heuristic estimates; federated scores use synthetic data.

## Cloud configuration

Choose an existing hosting project and PostGIS database. No cloud account access is configured on this machine, and no cloud resources have been provisioned. The Render template selects paid compute; review its resources in your account before creating them.

For Render, the root `render.yaml` defines the backend container and PostgreSQL 16 database, disables demo data, requires provider secrets, blocks external database connections, and runs migrations before deployment. Set `CORS_ORIGINS` to explicit allowed origins; the API's own HTTPS origin can be used while there is no frontend. Add actual website origins when a website is created. The configuration follows the [Render Blueprint reference](https://render.com/docs/blueprint-spec).

For Railway, the root `railway.json` builds `backend/Dockerfile` with the repository root as build context. Configure a persistent PostGIS-capable database and set `DATABASE_URL`, `PRANA_ENV=production`, `PRANA_DEMO_MODE=false`, `CORS_ORIGINS`, and the provider secrets above. A plain PostgreSQL image without the PostGIS extension files is insufficient. Migration execution and the one-replica setting follow the [Railway configuration reference](https://docs.railway.com/config-as-code/reference).

Both configurations use one API process and one replica because scheduling, rate limits, and WebSocket subscriptions are currently process-local. The migration command applies the existing transactional schema changes without starting ingestion or adding demo rows:

```text
python -m backend.scripts.migrate_db
```

The database role must be allowed to create/use PostGIS and create the application tables. Take a database backup before applying schema changes to an existing production database. Startup also checks/applies these idempotent schema changes.

Docker is unavailable on this machine, so the production Linux container build has not been executed locally. The installed Windows Python runtime and PostGIS database have been tested.

## Verify the deployed service

After the provider supplies the backend HTTPS address, run:

```text
python -m backend.scripts.verify_deployment --base-url https://YOUR-BACKEND-HOST --output .local/production-verification.json
```

This read-only command checks liveness, a connected persistent database, demo mode disabled, required API routes, and snapshot/ping/pong on all four WebSocket channels over WSS. It fails on HTTP-only production URLs, degraded readiness, missing routes, or failed WebSockets. It does not submit incidents, upload photos, or start training. Run `verify_live` in the deployment environment too; API readiness alone does not guarantee upstream provider access or scientific accuracy.

To check the running local database-backed API:

```powershell
./backend/.venv/Scripts/python.exe -m backend.scripts.verify_deployment --base-url http://127.0.0.1:8000 --local --output .local/deployment-verification.json
```

`--local` is restricted to loopback addresses and permits labeled demo mode. A local pass is not a production pass. Save reports with the release, and configure hosting health alerts and database backups before public use.
