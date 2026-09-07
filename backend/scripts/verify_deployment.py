"""Read-only HTTP and WebSocket deployment checks; production requires HTTPS and live mode."""
import argparse
import asyncio
import json
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import httpx
from websockets.asyncio.client import connect
from backend.scripts.verify_live import require


def base_url(value, local=False):
    url = urlsplit(value)
    require(not url.username and not url.password and not url.query and not url.fragment,
            "Use a base URL without credentials, query, or fragment")
    require(url.hostname is not None and url.path in ("", "/"), "Expected API root URL")
    if local:
        require(url.hostname in ("127.0.0.1", "localhost", "::1") and url.scheme in ("http", "https"),
                "Local mode is restricted to loopback")
    else:
        require(url.scheme == "https", "Production verification requires HTTPS")
    return value.rstrip("/")


def validate_ready(data, local=False):
    require(data["status"] == "ready" and data["db"] == "connected", "Persistent database is not ready")
    require(isinstance(data.get("demo_mode"), bool), "Missing data-mode status")
    require(local or data["demo_mode"] is False, "Production demo mode must be disabled")


async def verify(url, local=False, ca_file=None):
    url = base_url(url, local)
    tls = ssl.create_default_context(cafile=str(ca_file) if ca_file else None)
    checks = []
    async with httpx.AsyncClient(timeout=20, follow_redirects=False, verify=tls) as client:
        for path in ("/health", "/ready", "/openapi.json"):
            try:
                response = await client.get(url + path)
                response.raise_for_status()
                data = response.json()
                if path == "/health":
                    require(data["status"] == "ok", "Health check failed")
                elif path == "/ready":
                    validate_ready(data, local)
                else:
                    require(data.get("openapi", "").startswith("3."), "OpenAPI document missing")
                    for route in ("/health", "/ready", "/api/v1/alerts/latest", "/api/v1/hotspots",
                                  "/api/v1/aqi/stations", "/api/v1/aqi/surface", "/api/v1/forecast/plume",
                                  "/api/v1/anomalies", "/api/v1/citizen/photo", "/api/v1/federated/run",
                                  "/api/v1/federated/status", "/api/v1/sensorthings/Things"):
                        require(route in data["paths"], "Required backend route missing")
                    for route in ("/api/v1/meteorology", "/api/v1/analytics/fire-aqi-lag",
                                  "/api/v1/analytics/biomass-emissions", "/api/v1/legal/notices",
                                  "/api/v1/legal/registry", "/api/v1/industrial/cems/readings",
                                  "/api/v1/briefings/latest", "/api/v1/briefings/feed.xml",
                                  "/api/v1/mobile/releases/latest", "/api/v1/integrations/requirements"):
                        require(route in data["paths"], "Required backend route missing")
                checks.append({"check": path, "status": "passed"})
            except Exception as exc:
                checks.append({"check": path, "status": "failed", "error_type": type(exc).__name__})
    parsed = urlsplit(url)
    for channel in ("delhi", "ncr", "punjab", "haryana"):
        path = f"/ws/{channel}"
        ws_url = urlunsplit(("wss" if parsed.scheme == "https" else "ws", parsed.netloc, path, "", ""))
        try:
            options = {"ssl": tls} if parsed.scheme == "https" else {}
            async with connect(ws_url, open_timeout=20, close_timeout=5, **options) as ws:
                snapshot = json.loads(await asyncio.wait_for(ws.recv(), 30))
                require(snapshot["type"] == "snapshot", "Initial snapshot missing")
                require("fire_count" in snapshot and "delhi_pm25_ugm3" in snapshot, "Incomplete snapshot")
                await ws.send("ping")
                async with asyncio.timeout(10):
                    while await ws.recv() != "pong":
                        pass  # Scheduled telemetry can arrive before the pong.
            checks.append({"check": path, "status": "passed"})
        except Exception as exc:
            checks.append({"check": path, "status": "failed", "error_type": type(exc).__name__})
    return {"checked_at": datetime.now(timezone.utc).isoformat(), "mode": "local" if local else "production",
            "base_url": url, "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--local", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--ca-file", type=Path, help="Additional trusted certificate file; verification stays enabled")
    args = parser.parse_args()
    try:
        report = asyncio.run(verify(args.base_url, args.local, args.ca_file))
    except ValueError as exc:
        parser.error(str(exc))
    content = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content + "\n", encoding="utf-8")
    print(content)
    return int(any(row["status"] != "passed" for row in report["checks"]))


if __name__ == "__main__":
    raise SystemExit(main())
