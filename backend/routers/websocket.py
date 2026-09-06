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
from datetime import datetime, timezone
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

    async def connect(self, websocket: WebSocket, city_id: str):
        await websocket.accept()
        key = city_id.lower()
        if key not in self.active_connections:
            self.active_connections[key] = set()
        self.active_connections[key].add(websocket)
        logger.info(f"WebSocket client connected to channel: {key}")

    def disconnect(self, websocket: WebSocket, city_id: str):
        key = city_id.lower()
        if key in self.active_connections:
            self.active_connections[key].discard(websocket)
        logger.info(f"WebSocket client disconnected from channel: {key}")

    async def broadcast_to_channel(self, city_id: str, message: Dict[str, Any]):
        key = city_id.lower()
        targets = set(self.active_connections.get(key, set()))
        # If broadcasting to ncr, also broadcast to delhi
        if key == "ncr":
            targets = targets.union(self.active_connections.get("delhi", set()))

        for connection in targets:
            try:
                await asyncio.wait_for(connection.send_json(message), timeout=5)
            except Exception as e:
                for sockets in self.active_connections.values():
                    sockets.discard(connection)

    async def broadcast_all(self, message: Dict[str, Any]):
        targets = set().union(*self.active_connections.values())
        for connection in targets:
            try:
                await asyncio.wait_for(connection.send_json(message), timeout=5)
            except Exception:
                for sockets in self.active_connections.values():
                    sockets.discard(connection)



manager = ConnectionManager()


@router.websocket("/ws/{city_id}")
async def websocket_endpoint(websocket: WebSocket, city_id: str):
    """
    WebSocket endpoint for mobile app and web command center.
    Sends snapshot on connection, then listens for client pings or pushes server events.
    """
    if city_id.lower() not in manager.active_connections:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket, city_id)
    try:
        await websocket.send_json(await build_snapshot(city_id))
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket disconnected (%s)", type(exc).__name__)
    finally:
        manager.disconnect(websocket, city_id)


async def build_snapshot(city_id="delhi"):
    from backend.ingesters.ingest_openaq import fetch_openaq_stations
    from backend.routers.alerts import fetch_alerts
    store = get_in_memory_store()
    readings = store.get("aqi_readings", [])
    fire_count = len(store.get("fire_hotspots", []))
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                readings = [dict(r) for r in await conn.fetch("""SELECT DISTINCT ON (station_id)
                    station_id,state,pm25_ugm3,source,measured_at FROM aqi_readings
                    WHERE parameter='pm25' ORDER BY station_id,measured_at DESC""")]
                fire_count = await conn.fetchval("SELECT count(*) FROM fire_hotspots WHERE acq_datetime >= NOW() - INTERVAL '24 hours'")
        except Exception:
            readings, fire_count = [], None
    if not readings and pool is None:
        try:
            readings = await fetch_openaq_stations()
        except Exception:
            readings = []
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
        "title": f"Air Quality {incident.get('severity', 'alert').capitalize()} — {incident.get('location_text', 'Corridor')}",
        "body": f"AQI {incident.get('measured_aqi', 'Spike')} detected.",
        "created_at": incident.get("created_at", datetime.now(timezone.utc).isoformat())
    }
    await manager.broadcast_all(message)
