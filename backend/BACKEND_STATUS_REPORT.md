# Backend verification report

Verified locally on 9 September 2026. This report records only checks performed against the current working tree and replaces older environment-specific claims.

## Current result

| Verification | Result |
| --- | --- |
| Backend unit/regression suite | **112 passed, 1 skipped** |
| Python dependency consistency | **Passed** |
| Mobile TypeScript | **Passed** |
| Mobile Jest suite | **42 passed** |
| Web production build | **Passed** |
| Docker Compose validation | Not run: Docker is not installed on this machine |
| Live provider verification | Not run in the isolated test suite; missing/unavailable inputs return explicit unavailable responses |

## Data-integrity behavior

- Demo data is disabled by default in local examples and Docker configuration. Synthetic federated metrics are hidden in both frontends unless a real field dataset is identified.
- Station observations must have a provider timestamp within the last 24 hours and no more than 15 minutes in the future before they are exposed as current data.
- SensorThings entities are derived from the current station feed; the previous fixed Punjab and Delhi node records were removed.
- The surface model no longer imposes an invented 15 µg/m³ minimum or substitutes coordinates and PM2.5 values for incomplete stations.
- Frontends use **N/A** for missing values and no longer interpret “provider not configured” as a completed signature or dispatch.
- Public frontends no longer query a fixed demonstration CEMS facility. They show N/A until an authenticated facility-selection workflow is implemented.
- Mobile offline cache entries expire after five minutes and are used only for transport failures. A backend 4xx/5xx response is never concealed by cached data.

## Reliability and abuse controls

- HTTP request bodies are bounded before application parsing; photo upload retains its separate 5 MiB allowance.
- Incident creation, legal mutations/exports, push enrollment, and federated execution have request limits. Local incident, legal, CEMS, and push registries are capped.
- CEMS ingestion fails closed when its credential is absent.
- Public briefing reads never trigger a paid TTS provider request. Existing generated audio is served when present; otherwise the API reports N/A. An operator-key-protected endpoint performs explicit generation.
- Push enrollment is capped, expired tokens are excluded, and push fan-out is bounded.
- WebSocket connections are capped globally, per channel, and per peer; inbound frames and idle time are bounded, and broadcasts run concurrently with send timeouts.

## Deployment notes

- The backend must bind to `0.0.0.0` for physical phones. Expo web origins on ports 8081 and 19006 are included in the example CORS configuration.
- A durable PostgreSQL/PostGIS `DATABASE_URL` is expected for production. The backend also supports its durable local store for development.
- `npm run start:tunnel` proxies the HTTP API through the Expo tunnel. WebSocket upgrades require a deployed backend URL or another tunnel that explicitly supports WebSockets.
- TTS credentials supplied outside `backend/.env` are not copied automatically. Configure the documented `TTS_PROVIDER_*` values in the backend environment without committing secrets.

## Remaining security boundary

Operator identity is not implemented. Incident creation, legal workflow operations, CEMS forensic reads, and federated execution therefore must not be exposed to untrusted networks as a production control plane. Rate limits and resource caps reduce abuse but are not authorization. A real identity issuer and role model are required before those routes can be treated as production-authorized operations; embedding a shared secret in the web or Expo bundle would not be a valid fix.

No government filing, legal signature, dispatch, or enforcement action is performed automatically. Model outputs remain estimates and must not be described as official regulatory measurements.
