"""Generate and locally serve real briefing audio from a configured TTS provider."""

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("prana.tts")

AUDIO_DIR = Path(os.getenv("PRANA_AUDIO_DIR", Path(__file__).resolve().parent / "generated_audio"))
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
MAX_AUDIO_BYTES = 8 * 1024 * 1024


def tts_configured() -> bool:
    return bool(os.getenv("TTS_PROVIDER_KEY") or os.getenv("OPENAI_API_KEY"))


def _audio_target(incident_id: str, script: str) -> Tuple[str, Path]:
    digest = hashlib.sha256(f"{incident_id}\0{script}".encode("utf-8")).hexdigest()[:20]
    filename = f"briefing-{digest}.mp3"
    return filename, AUDIO_DIR / filename


def get_existing_briefing_audio(incident_id: str, script: str) -> Tuple[Optional[str], str]:
    """Look up already-generated audio without making a billable provider call."""
    filename, destination = _audio_target(incident_id, script)
    if destination.is_file() and destination.stat().st_size > 0:
        return filename, "generated"
    if not tts_configured():
        return None, "N/A — TTS provider not configured"
    return None, "N/A — audio has not been generated"


async def ensure_briefing_audio(incident_id: str, script: str) -> Tuple[Optional[str], str]:
    """Return a generated MP3 filename and truthful generation status."""
    if not tts_configured():
        return None, "N/A — TTS provider not configured"

    filename, destination = _audio_target(incident_id, script)
    if destination.is_file() and destination.stat().st_size > 0:
        return filename, "generated"

    provider_url = os.getenv("TTS_PROVIDER_URL", "https://api.openai.com/v1/audio/speech")
    provider_key = os.getenv("TTS_PROVIDER_KEY") or os.getenv("OPENAI_API_KEY")
    payload = {
        "model": os.getenv("TTS_MODEL", "gpt-4o-mini-tts"),
        "voice": os.getenv("TTS_VOICE", "alloy"),
        "input": script,
        "response_format": "mp3",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                provider_url,
                json=payload,
                headers={"Authorization": f"Bearer {provider_key}", "Accept": "audio/mpeg"},
            )
            response.raise_for_status()
            content_type = response.headers.get("content-type", "").lower()
            declared_size = int(response.headers.get("content-length", "0") or 0)
            if declared_size > MAX_AUDIO_BYTES or len(response.content) > MAX_AUDIO_BYTES:
                raise ValueError("TTS provider audio exceeded the size limit")
            if "audio" not in content_type or len(response.content) < 128:
                raise ValueError("TTS provider did not return an audio file")
        temporary = destination.with_suffix(".tmp")
        temporary.write_bytes(response.content)
        temporary.replace(destination)
        return filename, "generated"
    except Exception as exc:
        logger.warning("Briefing audio generation failed (%s)", type(exc).__name__)
        return None, "N/A — audio generation unavailable"
