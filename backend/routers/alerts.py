"""
Alerts & Incident Tickets Router (REQ-010, REQ-015, DEC-010)
Serves automated and manual SPCB incident tickets with satellite evidence.
Carries both measured_pm25 and measured_aqi.
"""

import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, Query, Request, Response, status, HTTPException
from pydantic import AwareDatetime

from backend.models import AlertsResponse, LatestAlertResponse, IncidentCreate, IncidentItem
from backend.database import get_db_pool, get_in_memory_store, compute_cpcb_aqi
from backend.routers.citizen import limiter

logger = logging.getLogger("prana.routers.alerts")

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])

async def fetch_alerts(
    severity: Optional[str] = None,
    limit: int = 20,
    since: Optional[datetime] = None
) -> dict:
    """Internal helper to retrieve alerts without FastAPI parameter defaults."""
    items = []
    pool = get_db_pool()

    if pool:
        try:
            async with pool.acquire() as conn:
                query = "SELECT * FROM incidents WHERE 1=1"
                params = []
                idx = 1
                if severity:
                    query += f" AND severity = ${idx}"
                    params.append(severity)
                    idx += 1
                if since:
                    dt = since
                    query += f" AND created_at >= ${idx}"
                    params.append(dt)
                    idx += 1
                query += f" ORDER BY created_at DESC LIMIT ${idx}"
                params.append(limit)

                rows = await conn.fetch(query, *params)
                for r in rows:
                    items.append({
                        "incident_id": r["incident_id"],
                        "severity": r["severity"],
                        "location_text": r["location_text"],
                        "latitude": r["latitude"],
                        "longitude": r["longitude"],
                        "pollutant": r["pollutant"],
                        "measured_pm25": r["measured_pm25"],
                        "measured_aqi": r["measured_aqi"],
                        "satellite_ts": r["satellite_ts"].isoformat() if r["satellite_ts"] else None,
                        "satellite_source": r["satellite_source"],
                        "authority": r["authority"],
                        "created_at": r["created_at"].isoformat(),
                        "satellite_evidence": json.loads(r["satellite_evidence"]) if r["satellite_evidence"] else None
                    })
        except Exception as ex:
            raise HTTPException(503, "Incident storage is unavailable") from None

    if pool is None:
        store = get_in_memory_store()
        all_incidents = store.get("incidents", [])
        # Sort by created_at DESC
        sorted_incidents = sorted(
            all_incidents,
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )

        for inc in sorted_incidents:
            if severity and inc.get("severity") != severity:
                continue
            if since and datetime.fromisoformat(inc["created_at"].replace("Z", "+00:00")) < since:
                continue
            items.append(inc)
            if len(items) >= limit:
                break

    return {
        "count": len(items),
        "items": items
    }


@router.get("", response_model=AlertsResponse)
async def get_alerts(
    severity: Optional[str] = Query(None, pattern="^(emergency|warning|watch)$"),
    limit: int = Query(20, ge=1, le=100),
    since: Optional[AwareDatetime] = Query(None, description="ISO timestamp with timezone")
):
    """
    Returns SPCB incident tickets with satellite proof.
    """
    return await fetch_alerts(severity=severity, limit=limit, since=since)


@router.get("/latest", response_model=Optional[LatestAlertResponse])
async def get_latest_alert(response: Response, lang: Literal["en", "hi", "pa"] = Query("en")):
    """
    Returns the most recent alert for mobile background_fetch polling (REQ-015).
    Returns HTTP 204 if no alert in the last 24 hours.
    """
    alerts_data = await fetch_alerts(limit=1)
    items = alerts_data.get("items", [])

    if not items:
        response.status_code = status.HTTP_204_NO_CONTENT
        return None

    top = items[0]
    dt_created = datetime.fromisoformat(top["created_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - dt_created > timedelta(hours=24):
        response.status_code = status.HTTP_204_NO_CONTENT
        return None

    title = f"Air Quality {top['severity'].capitalize()} — {top.get('location_text') or 'N/A'}"
    aqi_text = str(top["measured_aqi"]) if top.get("measured_aqi") is not None else "N/A"
    pm25_text = f"{top['measured_pm25']:.1f} µg/m³" if top.get("measured_pm25") is not None else "N/A"
    body = f"AQI {aqi_text} ({top.get('pollutant') or 'PM2.5'}: {pm25_text})."

    location = top.get("location_text") or "N/A"
    if lang == "hi":
        title = f"वायु गुणवत्ता चेतावनी — {location}"
        body = f"अनुमानित AQI {aqi_text}; PM2.5: {pm25_text}।"
    elif lang == "pa":
        title = f"ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਚੇਤਾਵਨੀ — {location}"
        body = f"ਅਨੁਮਾਨਿਤ AQI {aqi_text}; PM2.5: {pm25_text}।"
    return {
        "incident_id": top["incident_id"],
        "severity": top["severity"],
        "title": title,
        "body": body,
        "created_at": top["created_at"]
    }


@router.post("/incident", status_code=status.HTTP_201_CREATED, response_model=IncidentItem)
@limiter.limit("10/minute")
async def create_incident(request: Request, payload: IncidentCreate):
    """
    Creates a new SPCB incident ticket.
    Computes measured_aqi from measured_pm25 server-side.
    """
    return await create_incident_internal(payload)


async def create_incident_internal(payload: IncidentCreate):
    """Persist and deliver an incident created by a trusted internal job."""
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    inc_id = f"INC-{today_str}-{uuid.uuid4().hex[:12].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    aqi_val = compute_cpcb_aqi(payload.measured_pm25)

    from backend.routers.evidence import satellite_evidence
    try:
        evidence, satellite_ts, satellite_source = await satellite_evidence(payload.latitude, payload.longitude)
    except Exception:
        raise HTTPException(503, "Satellite evidence storage unavailable") from None
    item: IncidentItem = IncidentItem(
        incident_id=inc_id,
        severity=payload.severity,
        location_text=payload.location_text,
        latitude=payload.latitude,
        longitude=payload.longitude,
        pollutant=payload.pollutant or "PM2.5",
        measured_pm25=payload.measured_pm25,
        measured_aqi=aqi_val,
        satellite_ts=satellite_ts,
        satellite_source=satellite_source,
        authority=payload.authority or "CPCB",
        created_at=now_iso,
        satellite_evidence=evidence
    )

    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                dt_now = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
                await conn.execute(
                    """
                    INSERT INTO incidents (incident_id, severity, location_text, latitude, longitude,
                                           pollutant, measured_pm25, measured_aqi, satellite_ts, satellite_source,
                                           authority, created_at, satellite_evidence)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    """,
                    inc_id, payload.severity, payload.location_text, payload.latitude, payload.longitude,
                    payload.pollutant or "PM2.5", payload.measured_pm25, aqi_val, datetime.fromisoformat(satellite_ts) if satellite_ts else None,
                    satellite_source, payload.authority or "CPCB", dt_now, json.dumps(evidence) if evidence else None
                )
        except Exception as ex:
            raise HTTPException(503, "Incident could not be saved") from None

    # The local store is the database only when PostgreSQL is unavailable. Do
    # not mirror production incidents into an unbounded process list.
    if pool is None:
        incidents = get_in_memory_store().setdefault("incidents", [])
        incidents.insert(0, item.model_dump())
        del incidents[10_000:]

    from backend.routers.websocket import broadcast_alert
    await broadcast_alert(item.model_dump())
    # Push delivery is best effort; an unavailable notification provider must not
    # roll back a successfully persisted incident.
    try:
        from backend.push import send_incident_push
        await send_incident_push(item.model_dump())
    except Exception as ex:
        logger.warning("Incident push notification failed (%s)", type(ex).__name__)
    return item
