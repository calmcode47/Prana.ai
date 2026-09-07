# PRANA — Security & Privacy Model
## 05_security.md

| Field | Value |
|---|---|
| Revision | REV-002 |
| Purpose | Defines all security controls, credential handling, data privacy, and threat mitigations |
| Canonical IDs | SEC-001 to SEC-006 |
| Dependencies | 00_registry.md, 04_api.md |
| Repository baseline | NOT INSPECTED |
| Unresolved items | None |
| Supersedes | REV-001 |

---

## Data Classification

| Data type | Sensitivity | Owner | Retention | External sharing |
|---|---|---|---|---|
| NASA FIRMS fire coordinates | Public satellite data | NASA (public domain) | 90 days | None required |
| CAMS AOD and surface pollutant model fields | Public model data through Open-Meteo | Open-Meteo/Copernicus CAMS | 15 minutes cache | None |
| OpenAQ ground readings | Public government data | CPCB via OpenAQ | 90 days | None |
| Open-Meteo wind and temperature data | Public meteorological | Open-Meteo (public) | 7 days cache | None |
| Citizen sky photos | User-submitted; potentially location-revealing | Submitter | NOT STORED (hash only) | None |
| Citizen location (optional) | Potentially sensitive | Submitter (opt-in only) | 90 days | None |
| API credentials (FIRMS MAP_KEY, GEE JSON) | Confidential | Project operator | Server env vars only | Never |
| SPCB incident tickets | Internal regulatory | Project operator | Indefinite | None in demo scope |
| FL model weight tensors | Technical; no raw data | Project operator | Run duration only | Never |

---

## Credential Handling (SEC-001, SEC-002)

All credentials are stored as server-side environment variables only.
No credential appears in:
- any API response body or header
- frontend JavaScript bundles (Next.js or Flutter)
- log files (logging must redact env var values; use a redaction wrapper)
- version control (.env in .gitignore; only .env.example committed with placeholder values)

Required env vars:
```
FIRMS_MAP_KEY=<free registration at firms.modaps.eosdis.nasa.gov>
DATABASE_URL=postgresql+asyncpg://user:pass@host/prana
CORS_ORIGINS=https://<actual_vercel_url>,http://localhost:3000
```

.env.example (committed to repo):
```
FIRMS_MAP_KEY=YOUR_FIRMS_MAP_KEY_HERE
DATABASE_URL=postgresql+asyncpg://prana:prana@localhost/prana
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

---

## Citizen Photo Upload Controls (SEC-003, SEC-005)

Validation sequence — order is security-critical (size checked BEFORE body is buffered):

1. **Content-Type header check**: must be `image/jpeg` or `image/png`. Reject with 400 immediately if not. This is a cheap header check; no body is read yet.
2. **File size check**: Content-Length header must be <= 5,242,880 bytes (5 MB). Reject with 413 if exceeded. Check this BEFORE reading the body to prevent buffering large malicious uploads.
3. **Magic bytes check**: after reading first 16 bytes only, verify:
   - JPEG: first 3 bytes = FF D8 FF
   - PNG: first 8 bytes = 89 50 4E 47 0D 0A 1A 0A
   Reject with 400 if mismatch. This prevents MIME-type spoofing.
4. **EXIF strip**: open full image with Pillow (PIL); strip all EXIF metadata before any processing.
5. **Resize**: resize to 224x224 for model inference; discard resized copy after inference completes.
6. **Storage**: store only SHA-256 hash of EXIF-stripped bytes, pm25_estimate, confidence, optional lat/lon (if user opted in), submitted_at. Original photo NEVER written to disk.

Note on Content-Length: if client does not send Content-Length (chunked transfer), buffer up to 5MB + 1 byte; reject at 5MB+1 with 413.

Rate limiting (SEC-005):
- SlowAPI middleware on FastAPI
- Limit: 10 requests per 60 seconds per client IP
- Return 429 with Retry-After: 60 header when exceeded
- Scope: POST /api/v1/citizen/photo only

---

## CORS Policy (SEC-004)

FastAPI CORSMiddleware configuration:
```python
allow_origins = os.environ["CORS_ORIGINS"].split(",")  # loaded from env; never hardcoded
allow_methods = ["GET", "POST"]
allow_headers = ["Content-Type", "X-API-Key"]
allow_credentials = False
```

The list of origins is loaded from the CORS_ORIGINS env var at startup. This means the actual Vercel deployment URL is set at SESSION-006 time without code changes.

Flutter app is a native app; browser CORS does not apply to Flutter HTTP requests.

---

## Federated Learning Privacy (SEC-006)

By design, Flower client fit() returns only model parameters (weight tensors). No raw training data is included.

Verified by code inspection requirement — client_punjab.py and client_delhi.py must implement:
```python
def fit(self, parameters, config):
    set_parameters(model, parameters)
    for epoch in range(LOCAL_EPOCHS):
        train(model, train_loader)
    return get_parameters(model), len(train_dataset), {}
    # Third element must be empty metrics dict {}; no data arrays
```

The server-side FedAvg strategy receives only (parameters, num_examples) tuples. Raw NPZ data never transmitted.
Unit test SEC-006: assert fit() return value has shape (list, int, dict) and dict is empty.

---

## Input Validation (General)

All query parameters validated with FastAPI/Pydantic v2 models:
```python
hours_back: Annotated[int, Field(ge=1, le=72)] = 24
min_confidence: Literal["low", "nominal", "high"] = "nominal"
parameter: Literal["pm25", "pm10", "no2", "so2"] = "pm25"
nighttime_only: bool = True
days_back: Annotated[int, Field(ge=1, le=90)] = 7
limit: Annotated[int, Field(ge=1, le=100)] = 20
city_id: Literal["delhi", "ncr", "punjab"]  # WebSocket path param
```

Invalid parameter values return 422 Unprocessable Entity with field-level error detail (FastAPI default behaviour).

---

## Threat Summary

| Threat | Control | Residual risk |
|---|---|---|
| Credential exfiltration | Env vars only; .gitignore; redacted logging | Low |
| Malicious photo upload (active content, oversized, type spoofing) | Size check before body buffering; Content-Type check; magic byte verification; EXIF strip; no storage | Low |
| API abuse / DoS via photo endpoint | Rate limiting 10/min per IP | Medium (IP spoofing possible; accepted for demo scope) |
| Cross-origin data exfiltration | CORS allowlist loaded from env var at startup | Low |
| Raw FL training data leakage | Flower design; fit() returns tensors only; SEC-006 unit test | Low |
| Citizen location privacy | Opt-in only; stored only if provided; 90-day retention; not logged by default | Low |
| Vercel URL mismatch in CORS | CORS_ORIGINS env var set at SESSION-006 with actual URL | Low |

---

## Security Verification Commands

```bash
# Verify no credentials in git history or tracked files
git log --all --full-history -- .env
grep -r "FIRMS_MAP_KEY" --include="*.py" --include="*.ts" --include="*.js" . | grep -v ".env.example"

# Verify CORS rejects wrong origin
curl -H "Origin: https://evil.com" https://prana-api.railway.app/api/v1/hotspots -v
# Expected: no Access-Control-Allow-Origin: https://evil.com in response

# Verify validation order: size check BEFORE magic byte check
# Send 6MB file; should return 413 immediately (fast) not 400 after buffering
time curl -s -o /dev/null -w "%{http_code}" -X POST https://prana-api.railway.app/api/v1/citizen/photo -F "photo=@6mb_dummy.bin"
# Expected: 413 in <100ms

# Verify wrong MIME type rejected
curl -s -X POST https://prana-api.railway.app/api/v1/citizen/photo -F "photo=@test.exe" -w "%{http_code}"
# Expected: 400

# Verify rate limiting
for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://prana-api.railway.app/api/v1/citizen/photo -F photo=@test.jpg; done
# Expected: 10x 200 then 2x 429

# Verify FL client returns no raw data
# Unit test: pytest backend/tests/test_fl.py::test_fl_client_no_raw_data
# Assertion: isinstance(result[0], list) and result[1] == len(train_dataset) and result[2] == {}
```
