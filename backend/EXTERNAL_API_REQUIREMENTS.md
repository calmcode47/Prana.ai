# External API and dataset requirements

PRANA does not register accounts, retrieve secrets, or download validation datasets. Add credentials only to `backend/.env`; never commit them.

| Capability | What you need to provide | Obtain it from | Cost/access note |
|---|---|---|---|
| Live fire hotspots | `FIRMS_MAP_KEY` | [NASA FIRMS map-key registration](https://firms.modaps.eosdis.nasa.gov/api/map_key/) | Free registration; NASA usage limits apply. |
| Live air-quality stations | `OPENAQ_API_KEY` | [OpenAQ Explorer account](https://explore.openaq.org/) | Free account; provider rate limits apply. |
| Weather and boundary-layer forecasts | Nothing | [Open-Meteo Weather API](https://open-meteo.com/en/docs) | The noncommercial endpoint needs no API key. |
| AOD, NO₂, PM2.5, dust, SO₂, and ozone model fields | Nothing | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Uses CAMS global data for India; no key for noncommercial use within published limits. AOD is not presented as Sentinel-5P AAI. |
| Facility CEMS data | A data agreement/feed from each plant or SPCB plus a private `CEMS_INGEST_API_KEY` chosen by you | The plant operator, CEMS vendor, or relevant SPCB | There is no universal public CEMS feed. PRANA now accepts authenticated batches. |
| Legally valid electronic signature | `ESIGN_PROVIDER_URL`, `ESIGN_ASP_ID`, and `ESIGN_CLIENT_CERT` | A [CCA-licensed eSign service provider](https://cca.gov.in/service-providers.html) | Provider onboarding and an agreement are required. e-Pramaan authentication is separate from document signing. |
| e-Pramaan sign-in, if desired | Client credentials and redirect configuration | [e-Pramaan department onboarding](https://department.epramaan.gov.in/) | Optional identity/SSO integration; it does not itself make a legal document signed. |
| Police, district, flying-squad, or SPCB delivery | `AUTHORITY_DISPATCH_URL`, client ID, and client secret | The specific receiving authority's integration owner | No universal public endpoint exists. The backend queues records until configured. |
| Audio generation | `TTS_PROVIDER_URL`, `TTS_PROVIDER_KEY`, and `AUDIO_STORAGE_URL` | Your selected speech and object-storage provider | Provider-dependent; the backend already produces briefing text and RSS without these. |
| Mobile app download | `MOBILE_APP_DOWNLOAD_URL`, `MOBILE_APP_VERSION`, and the file's `MOBILE_APP_SHA256` | Your selected HTTPS artifact store after a signed app exists | No mobile or frontend files are created by this backend work. |

## Real-world model validation data

Provide a CSV inside this repository with the columns `model,predicted,observed` and at least ten paired rows per model. Optional columns such as `timestamp`, `station_id`, `source`, and `split` are preserved as provenance in your source file. Run:

```powershell
backend/.venv/Scripts/python.exe -m backend.scripts.validate_real_world --input backend/data/validation/paired_observations.csv
```

The report is written inside `backend/.local/model-validation/report.json`. The evaluator performs no downloads and reports MAE, RMSE, bias, R², and Pearson correlation. Model accuracy remains unestablished until you supply representative, independently observed ground truth.
