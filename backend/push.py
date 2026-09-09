"""Expo push-token persistence and incident notification delivery."""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

import httpx

from backend.database import get_db_pool, get_in_memory_store, persist_local_store

logger = logging.getLogger("prana.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_TOKEN_RE = re.compile(r"^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$")


def validate_expo_push_token(token: str) -> str:
    normalized = token.strip()
    if not _TOKEN_RE.fullmatch(normalized):
        raise ValueError("Invalid Expo push token")
    return normalized


async def register_push_token(token: str, platform: str, device_id: str | None = None) -> None:
    token = validate_expo_push_token(token)
    if platform not in {"android", "ios"}:
        raise ValueError("Push registration requires an Android or iOS device")
    now = datetime.now(timezone.utc)
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO mobile_push_tokens
                   (push_token, platform, device_id, enabled, last_registered_at)
                   VALUES ($1,$2,$3,TRUE,$4)
                   ON CONFLICT (push_token) DO UPDATE SET
                     platform=EXCLUDED.platform, device_id=EXCLUDED.device_id,
                     enabled=TRUE, last_registered_at=EXCLUDED.last_registered_at""",
                token, platform, device_id, now,
            )
        return

    rows = get_in_memory_store()["mobile_push_tokens"]
    match = next((row for row in rows if row["push_token"] == token), None)
    record = {
        "push_token": token,
        "platform": platform,
        "device_id": device_id,
        "enabled": True,
        "last_registered_at": now.isoformat(),
    }
    if match:
        match.update(record)
        persist_local_store()
    else:
        rows.append(record)


async def _enabled_tokens() -> List[str]:
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT push_token FROM mobile_push_tokens WHERE enabled=TRUE ORDER BY last_registered_at DESC"
            )
        return [row["push_token"] for row in rows]
    return [
        row["push_token"]
        for row in get_in_memory_store()["mobile_push_tokens"]
        if row.get("enabled", True)
    ]


async def _disable_tokens(tokens: Iterable[str]) -> None:
    rejected = set(tokens)
    if not rejected:
        return
    pool = get_db_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE mobile_push_tokens SET enabled=FALSE WHERE push_token=ANY($1::text[])",
                list(rejected),
            )
        return
    for row in get_in_memory_store()["mobile_push_tokens"]:
        if row["push_token"] in rejected:
            row["enabled"] = False
    persist_local_store()


async def send_incident_push(incident: Dict[str, Any]) -> int:
    """Deliver a visible OS notification even when the app is backgrounded."""
    tokens = await _enabled_tokens()
    if not tokens:
        return 0

    severity = str(incident.get("severity") or "alert")
    location = incident.get("location_text") or "monitored corridor"
    aqi = incident.get("measured_aqi")
    title = f"Air Quality {severity.capitalize()} — {location}"
    body = f"AQI {aqi} detected." if aqi is not None else "A new verified incident was recorded."
    delivered = 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        for offset in range(0, len(tokens), 100):
            batch_tokens = tokens[offset:offset + 100]
            messages = [
                {
                    "to": token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "priority": "high",
                    "channelId": "prana-alerts",
                    "data": {
                        "type": "incident",
                        "incident_id": incident.get("incident_id"),
                        "severity": severity,
                    },
                }
                for token in batch_tokens
            ]
            try:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate"},
                )
                response.raise_for_status()
                receipts = response.json().get("data", [])
                if isinstance(receipts, dict):
                    receipts = [receipts]
                disabled: List[str] = []
                for token, receipt in zip(batch_tokens, receipts):
                    if receipt.get("status") == "ok":
                        delivered += 1
                    elif receipt.get("details", {}).get("error") == "DeviceNotRegistered":
                        disabled.append(token)
                await _disable_tokens(disabled)
            except Exception as exc:
                logger.warning("Expo push delivery failed (%s)", type(exc).__name__)
    return delivered
