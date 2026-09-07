"""Authenticated CEMS ingestion and deterministic scrubber-bypass indicators."""
import hmac
import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import AwareDatetime, BaseModel, Field

from backend.config import production_mode
from backend.database import get_db_pool, get_in_memory_store
from backend.routers.citizen import limiter

router = APIRouter(prefix="/api/v1/industrial", tags=["Industrial telemetry"])


class CEMSReading(BaseModel):
    facility_id: str = Field(min_length=2, max_length=100)
    measured_at: AwareDatetime
    stack_velocity_ms: float = Field(ge=0, le=200, allow_inf_nan=False)
    scrubber_load_kw: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)
    latitude: Optional[float] = Field(None, ge=-90, le=90, allow_inf_nan=False)
    longitude: Optional[float] = Field(None, ge=-180, le=180, allow_inf_nan=False)
    source: str = Field(min_length=2, max_length=100)


class CEMSBatch(BaseModel):
    readings: List[CEMSReading] = Field(min_length=1, max_length=5000)


def _authorized(supplied):
    expected = os.getenv("CEMS_INGEST_API_KEY")
    if not expected:
        if production_mode():
            raise HTTPException(503, "CEMS ingestion is not configured")
        return
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(401, "Invalid CEMS credential")


@router.post("/cems/readings", status_code=202)
@limiter.limit("30/minute")
async def ingest_cems(request: Request, payload: CEMSBatch, x_cems_key: Optional[str] = Header(None)):
    _authorized(x_cems_key)
    rows = [r.model_dump() for r in payload.readings]
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany("""INSERT INTO cems_readings
                    (facility_id,measured_at,stack_velocity_ms,scrubber_load_kw,latitude,longitude,geom,source)
                    VALUES($1,$2,$3,$4,$5,$6,
                    CASE WHEN $5::double precision IS NULL OR $6::double precision IS NULL THEN NULL
                         ELSE ST_SetSRID(ST_Point($6,$5),4326) END,$7)
                    ON CONFLICT(facility_id,measured_at) DO UPDATE SET
                    stack_velocity_ms=EXCLUDED.stack_velocity_ms,scrubber_load_kw=EXCLUDED.scrubber_load_kw,
                    latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,geom=EXCLUDED.geom,source=EXCLUDED.source""",
                    [(r["facility_id"], r["measured_at"], r["stack_velocity_ms"], r["scrubber_load_kw"],
                      r["latitude"], r["longitude"], r["source"]) for r in rows])
    store = get_in_memory_store()["cems_readings"]
    keyed = {(r["facility_id"], str(r["measured_at"])): r for r in store}
    keyed.update({(r["facility_id"], str(r["measured_at"])): r for r in rows})
    store[:] = list(keyed.values())[-100_000:]
    return {"accepted": len(rows), "status": "stored", "analysis": "No enforcement action is automatic"}


def detect_bypass(rows):
    rows = sorted(rows, key=lambda r: r["measured_at"])
    windows = []
    for index, row in enumerate(rows):
        history = rows[max(0, index - 12):index]
        if len(history) < 3:
            continue
        loads = sorted(float(item["scrubber_load_kw"]) for item in history)
        speeds = sorted(float(item["stack_velocity_ms"]) for item in history)
        baseline_load = loads[len(loads) // 2]
        baseline_speed = speeds[len(speeds) // 2]
        load_ratio = float(row["scrubber_load_kw"]) / baseline_load if baseline_load > 0 else 1.0
        speed_ratio = float(row["stack_velocity_ms"]) / baseline_speed if baseline_speed > 0 else 1.0
        if load_ratio <= 0.2 and speed_ratio >= 1.2:
            windows.append({"measured_at": str(row["measured_at"]), "scrubber_load_ratio": round(load_ratio, 4),
                            "stack_velocity_ratio": round(speed_ratio, 4), "classification": "REVIEW_REQUIRED"})
    return windows


@router.get("/cems/{facility_id}/forensics")
async def cems_forensics(facility_id: str, hours: int = Query(24, ge=1, le=24 * 31)):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            rows = [dict(r) for r in await conn.fetch("""SELECT facility_id,measured_at,stack_velocity_ms,
                scrubber_load_kw,source FROM cems_readings WHERE facility_id=$1 AND measured_at >= $2
                ORDER BY measured_at""", facility_id, since)]
    else:
        rows = []
        for raw in get_in_memory_store()["cems_readings"]:
            stamp = raw["measured_at"]
            if isinstance(stamp, str):
                stamp = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if raw["facility_id"] == facility_id and stamp >= since:
                rows.append({**raw, "measured_at": stamp})
    windows = detect_bypass(rows)
    return {"facility_id": facility_id, "period_hours": hours,
            "readings": [{**r, "measured_at": str(r["measured_at"])} for r in rows],
            "review_windows": windows, "status": "REVIEW_REQUIRED" if windows else "NO_PATTERN_DETECTED",
            "method": "Rule indicator: load <=20% and velocity >=120% of trailing median; not proof of tampering"}
