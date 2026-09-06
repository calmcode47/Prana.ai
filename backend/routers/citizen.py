"""
Citizen Science Photo Upload Router (REQ-009, SEC-003, SEC-005, DEC-010)
Handles sky photo upload with strict security validation:
1. Content-Type header check (400)
2. File size check <= 5MB BEFORE body buffering (413)
3. Magic bytes check (400)
4. EXIF strip with Pillow
5. SlowAPI rate limiting (10 req/min per IP)
"""

import io
import time
import hashlib
import logging
from datetime import datetime, timezone
from starlette.concurrency import run_in_threadpool
from typing import Optional
from PIL import Image
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.models import CitizenPhotoResponse
from backend.database import compute_cpcb_aqi, get_aqi_category_and_color, get_db_pool, get_in_memory_store

logger = logging.getLogger("prana.routers.citizen")

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/v1/citizen", tags=["Citizen Science"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB in bytes


@router.post("/photo", response_model=CitizenPhotoResponse)
@limiter.limit("10/minute")
async def upload_sky_photo(
    request: Request,
    photo: UploadFile = File(...),
    latitude: Optional[float] = Form(None, ge=-90, le=90, allow_inf_nan=False),
    longitude: Optional[float] = Form(None, ge=-180, le=180, allow_inf_nan=False)
):
    """
    Accepts a sky photo for PM2.5 haze estimation.
    Strictly follows SEC-003 validation sequence.
    """
    start_time = time.perf_counter()

    # Step 1: Content-Type header check (SEC-003a)
    content_type = photo.content_type or ""
    if content_type.lower() not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. JPEG or PNG only."
        )

    # Step 2: File size check BEFORE reading full body (SEC-003b)
    if photo.size is not None and photo.size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum 5MB.")
    if (latitude is None) != (longitude is None):
        raise HTTPException(422, "Provide both latitude and longitude")

    # Read the first 16 bytes for magic bytes verification
    magic_header = await photo.read(16)
    if not magic_header or len(magic_header) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file or empty body."
        )

    # Step 3: Magic bytes check (SEC-003c)
    # JPEG: starts with FF D8 FF
    # PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    is_jpeg = magic_header.startswith(b"\xff\xd8\xff")
    is_png = magic_header.startswith(b"\x89PNG\r\n\x1a\n")

    if not (is_jpeg or is_png):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match image header magic bytes."
        )

    # Read remaining body with a strict 5MB limit
    remaining = await photo.read(MAX_FILE_SIZE - len(magic_header) + 1)
    if len(remaining) > (MAX_FILE_SIZE - len(magic_header)):
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="File too large. Maximum 5MB."
        )

    full_image_bytes = magic_header + remaining

    # Step 4: EXIF strip with Pillow
    try:
        with Image.open(io.BytesIO(full_image_bytes)) as img:
            if img.width * img.height > 20_000_000:
                raise ValueError("Image exceeds 20 megapixels")
            # Re-create clean image without EXIF metadata
            clean_img = img.convert("RGB")
            # Resize for model inference (224x224)
            resized = clean_img.resize((224, 224))
            buf = io.BytesIO()
            resized.save(buf, format="JPEG")
            clean_bytes = buf.getvalue()
    except Exception as ex:
        logger.warning(f"Error processing image with Pillow: {ex}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode image."
        )

    # Step 5: Compute SHA-256 of sanitized image bytes (no raw image persisted)
    photo_hash = hashlib.sha256(clean_bytes).hexdigest()

    # Step 6: ML Inference via Dark Channel Prior (DCP) Haze Estimator (REQ-009)
    try:
        from backend.ml.haze_estimator import estimate_pm25_from_photo
        result = await run_in_threadpool(estimate_pm25_from_photo, clean_bytes)
        pm25_estimate = result["pm25_estimate"]
        confidence = result["confidence"]
        aqi_index = result["aqi_index"]
        aqi_cat = result["aqi_category"]
        aqi_col = result["aqi_color"]
    except Exception as ex:
        raise HTTPException(503, "Image estimator is unavailable") from None

    report = {"photo_hash": photo_hash, "latitude": latitude, "longitude": longitude,
              "pm25_estimate": pm25_estimate, "confidence": confidence,
              "submitted_at": datetime.now(timezone.utc).isoformat()}
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO citizen_reports
                    (photo_hash, latitude, longitude, geom, pm25_estimate, confidence)
                    VALUES ($1,$2,$3,CASE WHEN $2::float8 IS NULL THEN NULL
                    ELSE ST_SetSRID(ST_Point($3,$2),4326) END,$4,$5)
                    ON CONFLICT (photo_hash) DO NOTHING""",
                    photo_hash, latitude, longitude, pm25_estimate, confidence)
        except Exception:
            raise HTTPException(503, "Report could not be saved") from None
    else:
        reports = get_in_memory_store()["citizen_reports"]
        if not any(r["photo_hash"] == photo_hash for r in reports):
            reports.append(report)

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    return {
        "pm25_estimate": pm25_estimate,
        "confidence": confidence,
        "aqi_category": aqi_cat,
        "aqi_index": aqi_index,
        "aqi_color": aqi_col,
        "processing_time_ms": max(elapsed_ms, 1)
    }
