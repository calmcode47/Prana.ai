"""
PRANA Production Pre-Flight Verification CLI (SESSION-006)
Executes pre-deployment readiness checks for cloud environments (Railway, Render, AWS, GCP):
1. Environment configuration & credential auditing
2. PostgreSQL + PostGIS database connection, extension, and spatial index validation
3. Static satellite fallbacks & synthetic corridor dataset integrity
4. Server-side CPCB AQI converter & ML model inference sanity
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Tuple
import asyncpg

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import compute_cpcb_aqi, PM25_BREAKPOINTS
from backend.ml.haze_estimator import estimate_pm25_from_photo
from PIL import Image
import io

TABLES_REQUIRED = [
    "fire_hotspots",
    "aqi_readings",
    "forecast_zones",
    "anomaly_flags",
    "citizen_reports",
    "incidents",
    "fl_rounds",
    "pollutant_readings",
    "legal_notices",
    "enforcement_dispatches",
    "cems_readings",
]

STATIC_FILES_REQUIRED = [
    "firms_fallback.geojson",
    "surface_grid_fallback.geojson",
    "open_meteo_air_quality_fallback.geojson",
]

SYNTHETIC_DATA_REQUIRED = [
    "punjab_train.npz",
    "delhi_train.npz",
    "corridor_eval.npz",
]


class PreflightChecker:
    def __init__(self):
        self.results: List[Tuple[str, str, str]] = []  # (Category, Check, Status)
        self.critical_failures = 0

    def log(self, category: str, name: str, passed: bool, detail: str = ""):
        status = "PASS" if passed else "FAIL"
        if not passed:
            self.critical_failures += 1
        msg = f"[{status}] {name}"
        if detail:
            msg += f" — {detail}"
        self.results.append((category, name, f"{status} ({detail})" if detail else status))
        print(f"  {msg}")

    async def check_environment(self):
        print("\n--- 1. Environment & Secrets Audit ---")
        env = os.getenv("PRANA_ENV", "development")
        db_url = os.getenv("DATABASE_URL")
        cors = os.getenv("CORS_ORIGINS", "")

        self.log("Env", "Environment Mode", True, f"mode={env}")
        
        # Check database url presence
        if db_url:
            is_default = "pranapass" in db_url
            if env == "production" and is_default:
                self.log("Env", "Production DB Secret", False, "Default 'pranapass' detected in production!")
            else:
                self.log("Env", "DATABASE_URL configured", True, "Configured")
        else:
            self.log("Env", "DATABASE_URL configured", env != "production", "In-memory development mode")

        # Check CORS
        if not cors:
            self.log("Env", "CORS Configuration", env != "production", "Default localhost allowed")
        else:
            self.log("Env", "CORS Configuration", env != "production" or "*" not in cors, "Explicit origins required in production")

    async def check_database(self):
        print("\n--- 2. Database & PostGIS Spatial Extension ---")
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            self.log("Database", "PostgreSQL Connection", True, "In-memory mode (skipped)")
            return

        cleaned_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
        try:
            conn = await asyncpg.connect(cleaned_url, timeout=4.0)
            self.log("Database", "PostgreSQL Connected", True, "Connection established")

            # Check PostGIS extension
            try:
                pg_ver = await conn.fetchval("SELECT PostGIS_Full_Version()")
                self.log("Database", "PostGIS Extension", True, pg_ver.split()[0] if pg_ver else "Active")
            except Exception as e:
                self.log("Database", "PostGIS Extension", False, f"PostGIS not available: {e}")

            # Check required tables
            for tbl in TABLES_REQUIRED:
                exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                    tbl
                )
                self.log("Database", f"Table `{tbl}`", exists, "Found" if exists else "Missing")

            # Check GIST indexes
            gist_count = await conn.fetchval(
                "SELECT count(*) FROM pg_indexes WHERE indexdef LIKE '%USING gist%'"
            )
            self.log("Database", "PostGIS Spatial GIST Indexes", gist_count >= 2, f"{gist_count} spatial indexes")

            await conn.close()
        except Exception as ex:
            self.log("Database", "PostgreSQL Connection", False, type(ex).__name__)

    def check_static_assets(self):
        print("\n--- 3. Static Satellite & Synthetic Datasets ---")
        static_dir = PROJECT_ROOT / "backend" / "data" / "static"
        synth_dir = PROJECT_ROOT / "backend" / "data" / "synthetic"

        for sf in STATIC_FILES_REQUIRED:
            p = static_dir / sf
            exists = p.exists() and p.stat().st_size > 100
            self.log("Assets", f"Static fallback `{sf}`", exists, f"{p.stat().st_size} bytes" if exists else "Missing")

        for df in SYNTHETIC_DATA_REQUIRED:
            p = synth_dir / df
            exists = p.exists() and p.stat().st_size > 500
            self.log("Assets", f"Synthetic dataset `{df}`", exists, f"{p.stat().st_size} bytes" if exists else "Missing")

    def check_ml_sanity(self):
        print("\n--- 4. CPCB AQI Calculator & ML Engine Sanity ---")
        # Test CPCB breakpoints
        test_cases = [(15.0, 25), (45.0, 76), (75.0, 151), (105.0, 251), (180.0, 346), (300.0, 439)]
        all_cpcb_ok = True
        for pm, expected in test_cases:
            calc = compute_cpcb_aqi(pm)
            if abs(calc - expected) > 5:
                all_cpcb_ok = False
                break
        self.log("ML", "CPCB AQI Breakpoints (DEC-010)", all_cpcb_ok, "Formula calibrated")

        # Test Dark Channel Prior photo haze estimator
        try:
            img = Image.new("RGB", (224, 224), color=(135, 206, 235))
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            res = estimate_pm25_from_photo(buf.getvalue())
            valid_est = 15.0 <= res["pm25_estimate"] <= 500.0 and res["processing_time_ms"] < 3000
            self.log("ML", "Dark Channel Prior Inference (REQ-009)", valid_est, f"{res['processing_time_ms']}ms, PM2.5={res['pm25_estimate']}")
        except Exception as e:
            self.log("ML", "Dark Channel Prior Inference", False, str(e))

    def print_summary(self) -> int:
        print("\n" + "=" * 70)
        print("PRE-FLIGHT VERIFICATION AUDIT SUMMARY")
        print("=" * 70)
        print(f"Total Checks Executed: {len(self.results)}")
        print(f"Critical Failures:     {self.critical_failures}")
        
        if self.critical_failures == 0:
            print("\nSTATUS: CONFIGURED-MODE CHECKS PASSED; live providers and deployment require separate verification")
            print("=" * 70)
            return 0
        else:
            print(f"\nSTATUS: {self.critical_failures} CHECKS FAILED! RESOLVE BEFORE DEPLOYMENT.")
            print("=" * 70)
            return 1


async def main():
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / "backend" / ".env")
    print("=" * 70)
    print("PRANA Atmospheric Corridor — Cloud Pre-Flight Readiness Checker")
    print("=" * 70)
    checker = PreflightChecker()
    await checker.check_environment()
    await checker.check_database()
    checker.check_static_assets()
    checker.check_ml_sanity()
    exit_code = checker.print_summary()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
