from backend.config import demo_enabled
"""
WebSocket Real-Time Push Router (REQ-011, DEC-010)
Provides live bi-directional and server-push streaming of:
- Immediate corridor snapshot on connect
- 60s periodic AQI updates carrying both pm25_ugm3 and aqi_index
- Real-time alert broadcasts on threshold crossings (aqi_index > 300)
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Set, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.database import compute_cpcb_aqi, get_in_memory_store, get_db_pool

logger = logging.getLogger("prana.routers.websocket")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages active WebSocket connections grouped by city / corridor."""
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "delhi": set(),
            "ncr": set(),
            "punjab": set(),
            "haryana": set()
        }
        self._peers: Dict[WebSocket, str] = {}
        self.max_total = 200
        self.max_per_channel = 75
        self.max_per_peer = 10

    async def connect(self, websocket: WebSocket, city_id: str):
        key = city_id.lower()
        peer = websocket.client.host if websocket.client else "unknown"
        total = len(set().union(*self.active_connections.values()))
        peer_count = sum(1 for value in self._peers.values() if value == peer)
        if (total >= self.max_total or len(self.active_connections[key]) >= self.max_per_channel
                or peer_count >= self.max_per_peer):
            await websocket.close(code=1013)
            return False
        await websocket.accept()
        self.active_connections[key].add(websocket)
        self._peers[websocket] = peer
        logger.info(f"WebSocket client connected to channel: {key}")
        return True

    def disconnect(self, websocket: WebSocket, city_id: str):
        key = city_id.lower()
        if key in self.active_connections:
            self.active_connections[key].discard(websocket)
        self._peers.pop(websocket, None)
        logger.info(f"WebSocket client disconnected from channel: {key}")

    async def broadcast_to_channel(self, city_id: str, message: Dict[str, Any]):
        key = city_id.lower()
        targets = set(self.active_connections.get(key, set()))
        # If broadcasting to ncr, also broadcast to delhi
        if key == "ncr":
            targets = targets.union(self.active_connections.get("delhi", set()))

        await self._send_many(targets, message)

    async def broadcast_all(self, message: Dict[str, Any]):
        targets = set().union(*self.active_connections.values())
        await self._send_many(targets, message)

    async def _send_many(self, targets: Set[WebSocket], message: Dict[str, Any]):
        async def send(connection):
            try:
                await asyncio.wait_for(connection.send_json(message), timeout=2)
            except Exception:
                for sockets in self.active_connections.values():
                    sockets.discard(connection)
                self._peers.pop(connection, None)
        if targets:
            await asyncio.gather(*(send(connection) for connection in targets))



manager = ConnectionManager()
_snapshot_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
_snapshot_locks = {city: asyncio.Lock() for city in ("delhi", "ncr", "punjab", "haryana")}


@router.websocket("/ws/{city_id}")
async def websocket_endpoint(websocket: WebSocket, city_id: str):
    """
    WebSocket endpoint for mobile app and web command center.
    Sends snapshot on connection, then listens for client pings or pushes server events.
    """
    if city_id.lower() not in manager.active_connections:
        await websocket.close(code=1008)
        return
    if not await manager.connect(websocket, city_id):
        return
    try:
        await websocket.send_json(await build_snapshot(city_id))
        last_ping_at = 0.0
        while True:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=70)
            if len(data) > 64:
                await websocket.close(code=1009)
                return
            if data != "ping":
                await websocket.close(code=1008)
                return
            now = time.monotonic()
            if now - last_ping_at < 5:
                await websocket.close(code=1008)
                return
            last_ping_at = now
            await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket disconnected (%s)", type(exc).__name__)
    finally:
        manager.disconnect(websocket, city_id)


async def build_snapshot(city_id="delhi"):
    """Return a briefly shared snapshot so connection bursts do not fan out upstream work."""
    key = city_id.lower()
    cached = _snapshot_cache.get(key)
    now = time.monotonic()
    if cached and now - cached[0] <= 15:
        return {**cached[1]}
    async with _snapshot_locks[key]:
        cached = _snapshot_cache.get(key)
        now = time.monotonic()
        if cached and now - cached[0] <= 15:
            return {**cached[1]}
        snapshot = await _build_snapshot_uncached(key)
        _snapshot_cache[key] = (time.monotonic(), snapshot)
        return {**snapshot}


async def _build_snapshot_uncached(city_id="delhi"):
    from backend.ingesters.ingest_openaq import fetch_openaq_stations
    from backend.routers.alerts import fetch_alerts
    store = get_in_memory_store()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    from backend.routers.aqi import _is_fresh
    readings = [row for row in store.get("aqi_readings", []) if _is_fresh(row.get("measured_at"), cutoff)]
    fire_count = len(store.get("fire_hotspots", []))
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                readings = [dict(r) for r in await conn.fetch("""SELECT DISTINCT ON (station_id)
                    station_id,state,pm25_ugm3,source,measured_at FROM aqi_readings
                    WHERE parameter='pm25' AND ($1::boolean OR source='OPENAQ_LIVE')
                      AND measured_at >= $2 AND measured_at <= $3
                    ORDER BY station_id,measured_at DESC""",
                    demo_enabled(), cutoff, datetime.now(timezone.utc) + timedelta(minutes=15))]
                fire_count = await conn.fetchval("""SELECT count(*) FROM fire_hotspots
                    WHERE acq_datetime >= NOW() - INTERVAL '24 hours'
                    AND ($1::boolean OR source='NASA_FIRMS_VIIRS_SNPP_NRT')""", demo_enabled())
        except Exception:
            readings, fire_count = [], None
    if not readings:
        try:
            readings = await fetch_openaq_stations()
        except Exception:
            readings = []
    if not demo_enabled():
        readings = [row for row in readings if _is_fresh(row.get("measured_at"), cutoff)]
    delhi = [r for r in readings if (r.get("state") or "").lower() == "delhi"]
    regional = delhi if city_id in ("delhi", "ncr") else [r for r in readings if (r.get("state") or "").lower() == city_id]
    pm = max((r["pm25_ugm3"] for r in regional), default=None)
    delhi_pm = max((r["pm25_ugm3"] for r in delhi), default=None)
    try:
        alerts = (await fetch_alerts(limit=1))["items"]
    except Exception:
        alerts = []
    return {"type": "snapshot", "city_id": city_id,
        "fire_count": fire_count,
        "pm25_ugm3": pm, "aqi_index": compute_cpcb_aqi(pm) if pm is not None else None,
        "delhi_pm25_ugm3": delhi_pm,
        "delhi_aqi_index": compute_cpcb_aqi(delhi_pm) if delhi_pm is not None else None,
        "source": sorted({r.get("source", "unknown") for r in regional}),
        "measured_at": max((str(r.get("measured_at", "")) for r in regional), default=None),
        "latest_alert": alerts[0] if alerts else None}


async def broadcast_telemetry():
    for city, connections in manager.active_connections.items():
        if connections:
            snapshot = await build_snapshot(city)
            snapshot["type"] = "aqi_update"
            # Direct per-channel send avoids duplicate Delhi delivery via NCR alias.
            for connection in list(connections):
                try:
                    await asyncio.wait_for(connection.send_json(snapshot), timeout=5)
                except Exception:
                    connections.discard(connection)


async def broadcast_alert(incident: Dict[str, Any]):
    """
    Broadcasts an emergency or warning alert to all subscribed clients.
    """
    message = {
        "type": "alert",
        "incident_id": incident.get("incident_id"),
        "severity": incident.get("severity", "warning"),
        "title": f"Air Quality {incident.get('severity', 'alert').capitalize()} — {incident.get('location_text') or 'N/A'}",
        "body": f"AQI {incident.get('measured_aqi') if incident.get('measured_aqi') is not None else 'N/A'} detected.",
        "created_at": incident.get("created_at", datetime.now(timezone.utc).isoformat())
    }
    await manager.broadcast_all(message)
