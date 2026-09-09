"""Draft notices, evidence packages, and internal dispatch tracking.

This module never issues a legal direction, warrant, signature, or external message.
Those actions require an authorized officer and the relevant external authority/provider.
"""
import hashlib
import io
import json
import os
import uuid
import zipfile
from datetime import datetime, timezone
from html import escape
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from backend.database import get_db_pool, get_in_memory_store
from backend.routers.citizen import limiter

router = APIRouter(prefix="/api/v1/legal", tags=["Legal workflow"])

AIR_ACT_REFERENCE = "Air (Prevention and Control of Pollution) Act, 1981, section 31A"
EVIDENCE_REFERENCE = "Bharatiya Sakshya Adhiniyam, 2023, section 63 and Schedule"


class NoticeCreate(BaseModel):
    incident_id: str = Field(min_length=1, max_length=100)
    issuing_authority: str = Field(min_length=2, max_length=200)
    authorized_officer: Optional[str] = Field(None, max_length=200)
    requested_direction: str = Field(
        "Review the incident evidence and determine appropriate pollution-control action.",
        min_length=10, max_length=2000)


class DispatchCreate(BaseModel):
    incident_id: str = Field(min_length=1, max_length=100)
    notice_id: Optional[str] = Field(None, max_length=100)
    recipient_kind: Literal["district_magistrate", "police", "flying_squad", "spcb"]
    recipient_reference: str = Field(min_length=2, max_length=300)


def _digest(title, body):
    return hashlib.sha256((title + "\n" + body).encode("utf-8")).hexdigest()


async def _incident(incident_id):
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM incidents WHERE incident_id=$1", incident_id)
            match = dict(row) if row else None
    else:
        match = next((row for row in get_in_memory_store()["incidents"]
                      if row["incident_id"] == incident_id), None)
    if not match:
        raise HTTPException(404, "Incident not found")
    return match


async def _notice(notice_id):
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM legal_notices WHERE notice_id=$1", notice_id)
            if row:
                return dict(row)
    else:
        row = next((r for r in get_in_memory_store()["legal_notices"] if r["notice_id"] == notice_id), None)
        if row:
            return row
    raise HTTPException(404, "Notice not found")


def _notice_json(row):
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in row.items() if k != "id"}


def _pdf(title, paragraphs):
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    document = SimpleDocTemplate(output, pagesize=A4, title=title,
                                 author="PRANA backend draft generator")
    story = [Paragraph(escape(title), styles["Title"]), Spacer(1, 18)]
    for text in paragraphs:
        story.extend((Paragraph(escape(str(text)).replace("\n", "<br/>"), styles["BodyText"]), Spacer(1, 10)))
    document.build(story)
    output.seek(0)
    return output


@router.post("/notices", status_code=201)
@limiter.limit("10/minute")
async def create_notice(request: Request, payload: NoticeCreate):
    incident = await _incident(payload.incident_id)
    notice_id = f"DRF-31A-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:10].upper()}"
    title = f"DRAFT REVIEW NOTE — {AIR_ACT_REFERENCE}"
    body = (
        f"This is an unissued draft for review by {payload.issuing_authority}.\n\n"
        f"Incident: {incident['incident_id']}\nLocation: {incident.get('location_text') or 'N/A'}\n"
        f"Recorded PM2.5: {incident.get('measured_pm25') if incident.get('measured_pm25') is not None else 'N/A'} ug/m3\n"
        f"Estimated PM2.5 sub-index: {incident.get('measured_aqi') if incident.get('measured_aqi') is not None else 'N/A'}\n"
        f"Recorded at: {incident.get('created_at')}\n\nRequested direction: {payload.requested_direction}\n\n"
        "This draft has no legal effect. Section 31A directions may be issued only by a competent Board "
        "or duly authorized officer after review of the evidence, jurisdiction, applicable procedure, and law."
    )
    stamp = datetime.now(timezone.utc)
    row = dict(notice_id=notice_id, incident_id=payload.incident_id,
               issuing_authority=payload.issuing_authority, authorized_officer=payload.authorized_officer,
               legal_basis=AIR_ACT_REFERENCE, title=title, body=body, status="DRAFT",
               document_sha256=_digest(title, body), signature_provider=None,
               signature_reference=None, signed_at=None, created_at=stamp)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.execute("""INSERT INTO legal_notices
                (notice_id,incident_id,issuing_authority,authorized_officer,legal_basis,title,body,status,document_sha256,created_at)
                VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9)""", notice_id, payload.incident_id,
                payload.issuing_authority, payload.authorized_officer, AIR_ACT_REFERENCE, title, body,
                row["document_sha256"], stamp)
    else:
        notices = get_in_memory_store()["legal_notices"]
        notices.append(row)
        del notices[:-10_000]
    return _notice_json(row)


@router.get("/notices/{notice_id}")
async def get_notice(notice_id: str):
    return _notice_json(await _notice(notice_id))


@router.get("/notices/{notice_id}/document.pdf")
async def notice_pdf(notice_id: str):
    row = await _notice(notice_id)
    stream = _pdf(row["title"], [row["body"], f"SHA-256: {row['document_sha256']}",
                                      "Status: DRAFT — requires authorized legal and technical review."])
    return StreamingResponse(stream, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{notice_id}.pdf"'})


@router.get("/notices/{notice_id}/signature-package")
async def signature_package(notice_id: str):
    row = await _notice(notice_id)
    configured = all(os.getenv(key) for key in ("ESIGN_PROVIDER_URL", "ESIGN_ASP_ID", "ESIGN_CLIENT_CERT"))
    return {"notice_id": notice_id, "document_sha256": row["document_sha256"],
            "status": "READY_FOR_PROVIDER" if configured else "PROVIDER_NOT_CONFIGURED",
            "provider_call_performed": False,
            "requirements": ["authorized signer consent", "licensed CCA eSign provider onboarding",
                             "ASP ID and client certificate", "provider callback verification"]}


@router.get("/notices/{notice_id}/evidence-certificate.pdf")
async def evidence_certificate(notice_id: str):
    row = await _notice(notice_id)
    stream = _pdf("DRAFT ELECTRONIC RECORD CERTIFICATE", [
        f"Reference: {EVIDENCE_REFERENCE}", f"Electronic record: notice {notice_id}",
        f"SHA-256: {row['document_sha256']}", f"Created at: {row['created_at']}",
        "The authorized person must verify lawful control, regular operation, device/source particulars, "
        "the record-production process, place, date, and time before signing the statutory form.",
        "This system-generated draft is not a signed certificate and has no independent legal effect."])
    return StreamingResponse(stream, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{notice_id}-evidence-draft.pdf"'})


@router.post("/dispatches", status_code=201)
@limiter.limit("10/minute")
async def queue_dispatch(request: Request, payload: DispatchCreate):
    await _incident(payload.incident_id)
    if payload.notice_id:
        notice = await _notice(payload.notice_id)
        if notice["incident_id"] != payload.incident_id:
            raise HTTPException(409, "Notice belongs to another incident")
    dispatch_id = f"DSP-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:10].upper()}"
    stamp = datetime.now(timezone.utc)
    row = dict(dispatch_id=dispatch_id, incident_id=payload.incident_id, notice_id=payload.notice_id,
               recipient_kind=payload.recipient_kind, recipient_reference=payload.recipient_reference,
               status="PENDING_CONFIGURATION", external_reference=None, requested_at=stamp, sent_at=None)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.execute("""INSERT INTO enforcement_dispatches
                (dispatch_id,incident_id,notice_id,recipient_kind,recipient_reference,status,requested_at)
                VALUES($1,$2,$3,$4,$5,'PENDING_CONFIGURATION',$6)""", dispatch_id,
                payload.incident_id, payload.notice_id, payload.recipient_kind,
                payload.recipient_reference, stamp)
    else:
        dispatches = get_in_memory_store()["enforcement_dispatches"]
        dispatches.append(row)
        del dispatches[:-10_000]
    return {**_notice_json(row), "message_sent": False,
            "reason": "No authority-specific dispatch connector is configured"}


@router.get("/registry")
async def registry():
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            notices = [dict(r) for r in await conn.fetch("SELECT * FROM legal_notices ORDER BY created_at DESC LIMIT 100")]
            dispatches = [dict(r) for r in await conn.fetch("SELECT * FROM enforcement_dispatches ORDER BY requested_at DESC LIMIT 100")]
    else:
        notices = list(reversed(get_in_memory_store()["legal_notices"][-100:]))
        dispatches = list(reversed(get_in_memory_store()["enforcement_dispatches"][-100:]))
    return {"notices": [_notice_json(r) for r in notices], "dispatches": [_notice_json(r) for r in dispatches],
            "warrants": [], "legal_status": "No warrant issuing authority is implemented"}


@router.get("/dossiers/{incident_id}.zip")
@limiter.limit("10/minute")
async def dossier(request: Request, incident_id: str):
    incident = await _incident(incident_id)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            notices = [dict(r) for r in await conn.fetch("SELECT * FROM legal_notices WHERE incident_id=$1", incident_id)]
    else:
        notices = [r for r in get_in_memory_store()["legal_notices"] if r["incident_id"] == incident_id]
    point = None
    if incident.get("longitude") is not None and incident.get("latitude") is not None:
        point = {"type": "Feature", "geometry": {"type": "Point", "coordinates":
                 [incident["longitude"], incident["latitude"]]}, "properties":
                 {"incident_id": incident_id, "satellite_evidence": incident.get("satellite_evidence")}}
    manifest = {"created_at": datetime.now(timezone.utc).isoformat(), "incident_id": incident_id,
                "status": "EVIDENCE_EXPORT_NOT_LEGAL_FILING", "files":
                ["incident.json", "notices.json", "evidence.geojson"]}
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("incident.json", json.dumps(incident, indent=2, default=str))
        archive.writestr("notices.json", json.dumps([_notice_json(r) for r in notices], indent=2))
        archive.writestr("evidence.geojson", json.dumps({"type": "FeatureCollection", "features": [point] if point else []}, indent=2))
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
    output.seek(0)
    return StreamingResponse(output, media_type="application/zip",
                             headers={"Content-Disposition": f'attachment; filename="{incident_id}-dossier.zip"'})
