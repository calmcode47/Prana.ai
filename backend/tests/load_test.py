"""
PRANA Backend Concurrency & Load Testing Benchmark
Measures throughput, latency quantiles (p50, p90, p95, p99), and SLA validation
across core REST endpoints, ML pipelines, and WebSocket feeds.
"""

import asyncio
import io
import sys
from pathlib import Path
import time
from typing import Any, Dict, List, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
from PIL import Image
from httpx import AsyncClient, ASGITransport

from backend.main import app


def generate_test_jpeg(size=(200, 200), color=(135, 206, 235)) -> bytes:
    """Generates a valid in-memory sky blue JPEG image for citizen photo load testing."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


async def benchmark_endpoint(
    client: AsyncClient,
    method: str,
    url: str,
    total_requests: int = 50,
    concurrency: int = 10,
    files: Any = None,
    data: Any = None,
) -> Dict[str, Any]:
    """
    Executes concurrent requests against an endpoint and calculates latency distribution.
    """
    sem = asyncio.Semaphore(concurrency)
    latencies: List[float] = []
    errors = 0

    async def worker():
        nonlocal errors
        async with sem:
            t0 = time.perf_counter()
            try:
                if method.upper() == "GET":
                    resp = await client.get(url)
                elif method.upper() == "POST":
                    resp = await client.post(url, files=files, data=data)
                else:
                    resp = await client.request(method, url)
                
                t1 = time.perf_counter()
                if resp.status_code in (200, 201):
                    latencies.append((t1 - t0) * 1000.0)  # in ms
                elif resp.status_code == 429:
                    # SEC-005 Rate limit working as expected
                    pass
                else:
                    errors += 1
            except Exception:
                errors += 1

    start_wall = time.perf_counter()
    tasks = [worker() for _ in range(total_requests)]
    await asyncio.gather(*tasks)
    total_wall = time.perf_counter() - start_wall

    if not latencies:
        return {
            "endpoint": url,
            "total": total_requests,
            "success": 0,
            "errors": errors,
            "rps": 0.0,
            "p50_ms": None,
            "p90_ms": None,
            "p95_ms": None,
            "p99_ms": None,
        }

    arr = np.array(latencies)
    rps = len(latencies) / total_wall if total_wall > 0 else 0.0

    return {
        "endpoint": url,
        "total": total_requests,
        "success": len(latencies),
        "errors": errors,
        "rps": round(rps, 1),
        "mean_ms": round(float(np.mean(arr)), 2),
        "p50_ms": round(float(np.percentile(arr, 50)), 2),
        "p90_ms": round(float(np.percentile(arr, 90)), 2),
        "p95_ms": round(float(np.percentile(arr, 95)), 2),
        "p99_ms": round(float(np.percentile(arr, 99)), 2),
    }


async def _run_load_test():
    """Runs concurrent load benchmarks across all PRANA backend endpoints."""
    print("=" * 80)
    print("PRANA BACKEND CONCURRENCY & LATENCY BENCHMARK")
    print("=" * 80)

    transport = ASGITransport(app=app)
    jpeg_bytes = generate_test_jpeg()

    results: List[Dict[str, Any]] = []

    async with AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:
        # 1. Health Check
        print("\n[1/7] Benchmarking /health (100 requests, concurrency=20)...")
        r_health = await benchmark_endpoint(client, "GET", "/health", total_requests=100, concurrency=20)
        results.append(r_health)

        # 2. Hotspots GeoJSON
        print("[2/7] Benchmarking /api/v1/hotspots (50 requests, concurrency=10)...")
        r_hotspots = await benchmark_endpoint(client, "GET", "/api/v1/hotspots", total_requests=50, concurrency=10)
        results.append(r_hotspots)

        # 3. GP Downscaler Surface
        print("[3/7] Benchmarking /api/v1/aqi/surface (30 requests, concurrency=6)...")
        r_surface = await benchmark_endpoint(client, "GET", "/api/v1/aqi/surface?resolution_deg=0.5", total_requests=30, concurrency=6)
        results.append(r_surface)

        # 4. Trajectory Plume Dispersion
        print("[4/7] Benchmarking /api/v1/forecast/plume (30 requests, concurrency=6)...")
        r_plume = await benchmark_endpoint(client, "GET", "/api/v1/forecast/plume", total_requests=30, concurrency=6)
        results.append(r_plume)

        # 5. Industrial Anomaly Detector
        print("[5/7] Benchmarking /api/v1/anomalies (30 requests, concurrency=6)...")
        r_anomalies = await benchmark_endpoint(client, "GET", "/api/v1/anomalies?parameter=no2&nighttime_only=true", total_requests=30, concurrency=6)
        results.append(r_anomalies)

        # 6. Dark Channel Prior Sky Photo Estimator (SLA < 3000ms)
        print("[6/7] Benchmarking /api/v1/citizen/photo (8 uploads, concurrency=2)...")
        photo_files = {"photo": ("sky.jpg", jpeg_bytes, "image/jpeg")}
        photo_data = {"latitude": 28.6139, "longitude": 77.2090}
        r_photo = await benchmark_endpoint(client, "POST", "/api/v1/citizen/photo", total_requests=8, concurrency=2, files=photo_files, data=photo_data)
        results.append(r_photo)

        # 7. Federated Learning Status
        print("[7/7] Benchmarking /api/v1/federated/status (50 requests, concurrency=10)...")
        r_fl = await benchmark_endpoint(client, "GET", "/api/v1/federated/status", total_requests=50, concurrency=10)
        results.append(r_fl)

    # Print summary table
    print("\n" + "=" * 88)
    print(f"{'Endpoint':<35} | {'Reqs':<5} | {'RPS':<6} | {'p50(ms)':<8} | {'p95(ms)':<8} | {'p99(ms)':<8} | {'Status'}")
    print("-" * 88)

    all_sla_passed = True
    for r in results:
        endpoint = r["endpoint"].split("?")[0]
        status = "PASS"
        # Check SLAs
        if "citizen/photo" in endpoint and r["p95_ms"] and r["p95_ms"] > 3000:
            status = "FAIL (SLA > 3000ms)"
            all_sla_passed = False
        elif "aqi/surface" in endpoint and r["p95_ms"] and r["p95_ms"] > 1000:
            status = "WARN (> 1000ms)"
        elif r["errors"] > 0:
            status = f"FAIL ({r['errors']} errors)"
            all_sla_passed = False

        print(
            f"{endpoint:<35} | {r['success']:<5} | {r['rps']:<6} | "
            f"{r['p50_ms'] or '-':<8} | {r['p95_ms'] or '-':<8} | {r['p99_ms'] or '-':<8} | {status}"
        )

    print("=" * 88)
    if all_sla_passed:
        print("ALL LOAD TESTING AND SLA CRITERIA PASSED!")
    else:
        print("SOME SLAS OR REQUESTS FAILED!")
    return all_sla_passed


async def run_full_load_test():
    async with app.router.lifespan_context(app):
        return await _run_load_test()


if __name__ == "__main__":
    import sys
    sys.exit(0 if asyncio.run(run_full_load_test()) else 1)
