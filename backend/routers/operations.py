"""Backend telemetry, empirical analytics, briefing content, and integration status."""
import math
import os
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from backend.config import demo_enabled
from backend.database import get_db_pool, get_in_memory_store
from backend.ingesters.ingest_meteo import fetch_meteo_forecast
from backend.routers.alerts import fetch_alerts
from backend.models import MobilePushRegistration
from backend.push import register_push_token
from backend.tts import ensure_briefing_audio, get_existing_briefing_audio
from backend.routers.citizen import limiter
from backend.auth import require_operator

router = APIRouter(prefix="/api/v1", tags=["Operational intelligence"])


def _wind_vector(speed, direction_from):
    angle = math.radians(direction_from)
    return {"eastward_ms": round(-speed * math.sin(angle), 3),
            "northward_ms": round(-speed * math.cos(angle), 3),
            "direction_from_deg": round(direction_from, 2),
            "direction_toward_deg": round((direction_from + 180) % 360, 2)}


@router.get("/meteorology")
async def meteorology():
    data = await fetch_meteo_forecast()
    regions = {}
    for name in ("punjab", "delhi"):
        row = data[name]
        speed, direction = float(row["windspeed_10m"]), float(row["winddirection_10m"])
        hourly = row.get("hourly", {})
        heights = [float(v) for v in hourly.get("boundary_layer_height", []) if v is not None]
        regions[name] = {"latitude": row["latitude"], "longitude": row["longitude"],
                         "observed_at": row["timestamp"], "source": row["source"],
                         "wind_speed_ms": speed, "wind": _wind_vector(speed, direction),
                         "mixing_layer_height_m_agl": float(row["boundary_layer_height"]),
                         "forecast_mixing_layer_min_m_agl": min(heights) if heights else None,
                         "forecast_mixing_layer_max_m_agl": max(heights) if heights else None}
    return {"fetched_at": data["fetched_at"], "regions": regions,
            "streamlines": {"status": "vectors_available", "integration_method":
                            "Clients may integrate the supplied hourly wind vectors; no observed streamline is claimed"},
            "inversion": {"status": "not_measured", "reason":
                          "Boundary-layer height is available; inversion depth requires a vertical temperature profile"}}


async def _hourly_inputs(days):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            fires = [dict(r) for r in await conn.fetch("""SELECT date_trunc('hour',acq_datetime) bucket,
                count(*)::integer fire_count,coalesce(sum(frp),0)::double precision frp_sum
                FROM fire_hotspots WHERE acq_datetime >= $1 AND ($2::boolean OR source='NASA_FIRMS_VIIRS_SNPP_NRT')
                GROUP BY 1 ORDER BY 1""", since, demo_enabled())]
            aqi = [dict(r) for r in await conn.fetch("""SELECT date_trunc('hour',measured_at) bucket,
                avg(pm25_ugm3)::double precision pm25 FROM aqi_readings WHERE measured_at >= $1
                AND parameter='pm25' AND ($2::boolean OR source='OPENAQ_LIVE') GROUP BY 1 ORDER BY 1""",
                since, demo_enabled())]
        return fires, aqi
    fires, aqi = [], []
    for row in get_in_memory_store()["fire_hotspots"]:
        stamp = datetime.fromisoformat(str(row["acq_datetime"]).replace("Z", "+00:00"))
        if stamp >= since and (demo_enabled() or row.get("source") == "NASA_FIRMS_VIIRS_SNPP_NRT"):
            fires.append({"bucket": stamp.replace(minute=0, second=0, microsecond=0), "fire_count": 1,
                          "frp_sum": float(row.get("frp") or 0)})
    for row in get_in_memory_store()["aqi_readings"]:
        stamp = datetime.fromisoformat(str(row["measured_at"]).replace("Z", "+00:00"))
        if stamp >= since and (demo_enabled() or row.get("source") == "OPENAQ_LIVE"):
            aqi.append({"bucket": stamp.replace(minute=0, second=0, microsecond=0),
                        "pm25": float(row["pm25_ugm3"])})
    return fires, aqi


def lag_correlations(fires, aqi, max_lag_hours=72, step_hours=6):
    fire_by_hour = {}
    for row in fires:
        key = row["bucket"]
        fire_by_hour[key] = fire_by_hour.get(key, 0) + int(row["fire_count"])
    aqi_groups = {}
    for row in aqi:
        aqi_groups.setdefault(row["bucket"], []).append(float(row["pm25"]))
    aqi_by_hour = {key: sum(values) / len(values) for key, values in aqi_groups.items()}
    results = []
    for lag in range(0, max_lag_hours + 1, step_hours):
        pairs = [(fire_by_hour.get(hour - timedelta(hours=lag), 0), value)
                 for hour, value in aqi_by_hour.items()]
        if len(pairs) < 8:
            continue
        x, y = np.asarray(pairs, dtype=float).T
        if np.std(x) == 0 or np.std(y) == 0:
            continue
        results.append({"lag_hours": lag, "pearson_r": round(float(np.corrcoef(x, y)[0, 1]), 6),
                        "paired_hours": len(pairs)})
    return results


@router.get("/analytics/fire-aqi-lag")
async def fire_aqi_lag(days: int = Query(7, ge=2, le=90),
                       max_lag_hours: int = Query(72, ge=0, le=168),
                       step_hours: int = Query(6, ge=1, le=24)):
    fires, aqi = await _hourly_inputs(days)
    correlations = lag_correlations(fires, aqi, max_lag_hours, step_hours)
    strongest = max(correlations, key=lambda row: abs(row["pearson_r"])) if correlations else None
    return {"period_days": days, "status": "computed" if correlations else "insufficient_data",
            "strongest_lag": strongest, "correlations": correlations,
            "method": "Pearson correlation of hourly fire count with later hourly mean PM2.5",
            "caution": "Correlation is empirical association, not causal source attribution"}


def _region(lat, lon):
    if 28.35 <= lat <= 28.95 and 76.8 <= lon <= 77.5:
        return "Delhi-NCR"
    if lat >= 30.3:
        return "Punjab"
    if 27.6 <= lat <= 30.3:
        return "Haryana"
    return "Other"


@router.get("/analytics/biomass-emissions")
async def biomass_emissions(days: int = Query(7, ge=1, le=90)):
    totals = {}
    # Aggregated DB rows do not retain coordinates, so retrieve source records for regional shares.
    since = datetime.now(timezone.utc) - timedelta(days=days)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            rows = [dict(r) for r in await conn.fetch("""SELECT latitude,longitude,coalesce(frp,0) frp
                FROM fire_hotspots WHERE acq_datetime >= $1 AND ($2::boolean OR source='NASA_FIRMS_VIIRS_SNPP_NRT')""",
                since, demo_enabled())]
    else:
        rows = get_in_memory_store()["fire_hotspots"]
    for row in rows:
        region = _region(float(row["latitude"]), float(row["longitude"]))
        entry = totals.setdefault(region, {"hotspot_count": 0, "frp_sum_mw": 0.0})
        entry["hotspot_count"] += 1
        entry["frp_sum_mw"] += max(0.0, float(row.get("frp") or 0))
    total_frp = sum(row["frp_sum_mw"] for row in totals.values())
    coefficient = os.getenv("PRANA_FRP_TO_AEROSOL_KG_S_PER_MW")
    factor = float(coefficient) if coefficient else None
    if factor is not None and (not math.isfinite(factor) or factor <= 0):
        raise HTTPException(503, "Configured emissions coefficient is invalid")
    regions = []
    for name, row in sorted(totals.items()):
        regions.append({"region": name, **row,
                        "frp_share_percent": round(100 * row["frp_sum_mw"] / total_frp, 2) if total_frp else None,
                        "estimated_aerosol_kg_s": round(row["frp_sum_mw"] * factor, 6) if factor else None})
    return {"period_days": days, "regions": regions, "source": "stored FIRMS observations",
            "emissions_model": "configured" if factor else "not_configured",
            "coefficient_kg_s_per_mw": factor,
            "caution": "FRP share is observed-data arithmetic; mass emission requires an approved regional coefficient"}


@router.get("/briefings/latest")
async def latest_briefing(request: Request):
    alerts = (await fetch_alerts(limit=1))["items"]
    if not alerts:
        return {"status": "empty", "script": None, "audio_url": None, "audio_status": "not_generated"}
    alert = alerts[0]
    script = (f"PRANA atmospheric briefing. {alert['severity'].capitalize()} conditions were recorded for "
              f"{alert.get('location_text') or 'N/A'}. The stored PM2.5 value is "
              f"{alert.get('measured_pm25') if alert.get('measured_pm25') is not None else 'N/A'} micrograms per cubic metre, with an estimated PM2.5 sub-index "
              f"of {alert.get('measured_aqi') if alert.get('measured_aqi') is not None else 'N/A'}. Review the timestamp and data source before operational use.")
    # A public read must never trigger a billable provider operation. Audio is
    # generated only by an explicitly trusted backend workflow.
    audio_filename, audio_status = get_existing_briefing_audio(alert["incident_id"], script)
    forwarded_prefix = request.headers.get("x-forwarded-prefix", "").rstrip("/")
    audio_url = (f"{str(request.base_url).rstrip('/')}{forwarded_prefix}/media/briefings/{audio_filename}"
                 if audio_filename else None)
    return {"status": "script_ready", "incident_id": alert["incident_id"], "script": script,
            "audio_url": audio_url, "audio_status": audio_status,
            "feed_url": "/api/v1/briefings/feed.xml"}


@router.post("/briefings/latest/audio")
@limiter.limit("2/hour")
async def generate_latest_briefing_audio(request: Request,
                                          _: None = Depends(require_operator)):
    """Explicit trusted operation for generating audio; public reads never spend provider quota."""
    item = await latest_briefing(request)
    if not item.get("incident_id") or not item.get("script"):
        raise HTTPException(404, "No current briefing is available")
    audio_filename, audio_status = await ensure_briefing_audio(item["incident_id"], item["script"])
    forwarded_prefix = request.headers.get("x-forwarded-prefix", "").rstrip("/")
    audio_url = (f"{str(request.base_url).rstrip('/')}{forwarded_prefix}/media/briefings/{audio_filename}"
                 if audio_filename else None)
    return {**item, "audio_url": audio_url, "audio_status": audio_status}


@router.get("/briefings/feed.xml")
async def briefing_feed(request: Request):
    item = await latest_briefing(request)
    description = (item.get("script") or "No current atmospheric briefing").replace("&", "&amp;").replace("<", "&lt;")
    xml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel>"
           "<title>PRANA Atmospheric Briefings</title><link>/api/v1/briefings/latest</link>"
           f"<description>{description}</description></channel></rss>")
    return Response(xml, media_type="application/rss+xml")


@router.get("/mobile/releases/latest")
async def mobile_release(response: Response):
    url, version, sha256 = (os.getenv("MOBILE_APP_DOWNLOAD_URL"), os.getenv("MOBILE_APP_VERSION"),
                            os.getenv("MOBILE_APP_SHA256"))
    if not all((url, version, sha256)):
        response.status_code = status.HTTP_204_NO_CONTENT
        return None
    parsed = urlsplit(url)
    if parsed.scheme != "https" or len(sha256) != 64 or any(c not in "0123456789abcdefABCDEF" for c in sha256):
        raise HTTPException(503, "Mobile release configuration is invalid")
    return {"version": version, "download_url": url, "sha256": sha256.lower(),
            "status": "configured_external_artifact"}


@router.post("/mobile/push/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def mobile_push_registration(request: Request, payload: MobilePushRegistration):
    try:
        await register_push_token(payload.expo_push_token, payload.platform, payload.device_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    except Exception:
        raise HTTPException(503, "Push registration storage is unavailable") from None
    return {"status": "registered", "platform": payload.platform}


@router.get("/integrations/requirements")
async def integration_requirements():
    items = [
        ("NASA FIRMS", ("FIRMS_MAP_KEY",), "https://firms.modaps.eosdis.nasa.gov/api/map_key/", "free email registration"),
        ("OpenAQ v3", ("OPENAQ_API_KEY",), "https://explore.openaq.org/", "free account; provider limits apply"),
        ("Open-Meteo CAMS air quality", (), "https://open-meteo.com/en/docs/air-quality-api", "no key for noncommercial use within published limits"),
        ("CCA-licensed eSign provider", ("ESIGN_PROVIDER_URL", "ESIGN_ASP_ID", "ESIGN_CLIENT_CERT"), "https://cca.gov.in/service-providers.html", "provider onboarding/agreement required"),
        ("CEMS ingestion", ("CEMS_INGEST_KEYS_JSON",), "the selected plant/SPCB CEMS operator", "organization-specific source agreement and facility-scoped key"),
        ("Authority dispatch", ("AUTHORITY_DISPATCH_URL", "AUTHORITY_DISPATCH_CLIENT_ID", "AUTHORITY_DISPATCH_CLIENT_SECRET"), "the relevant SPCB/district/police integration owner", "no universal public API"),
        ("Text-to-speech", ("TTS_PROVIDER_KEY",), "an OpenAI-compatible speech provider", "provider-dependent"),
        ("Operator audio generation", ("PRANA_OPERATOR_API_KEY",), "the deployment administrator", "server-side secret; never bundle in web/mobile clients"),
        ("Mobile artifact hosting", ("MOBILE_APP_DOWNLOAD_URL", "MOBILE_APP_VERSION", "MOBILE_APP_SHA256"), "the selected HTTPS artifact store", "requires an actual signed app build"),
    ]
    return {"items": [{"service": service, "settings": list(settings), "obtain_from": source, "access": access,
                       "configured": all(os.getenv(key) for key in settings)}
                      for service, settings, source, access in items],
            "note": "The backend does not request credentials or contact these onboarding services"}
