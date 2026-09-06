"""
PRANA Database Initialization, Migration & Seeding CLI (REQ-001 - REQ-010, DEC-010)
Connects to PostgreSQL + PostGIS or the in-memory fallback store to:
1. Create all 7 tables with PostGIS spatial indexes and unique constraints.
2. Seed realistic November high-pollution corridor episode datasets:
   - Active stubble burn hotspots in Sangrur, Ludhiana, Bathinda (Punjab)
   - High-severity CPCB receptor readings in Anand Vihar, Punjabi Bagh, ITO (Delhi)
   - Industrial daytime vs nighttime emission anomalies in Manesar & Narela
   - 10 rounds of Federated Learning (Flower FedAvg) convergence history
   - CPCB Emergency Incident tickets
3. Provide verification statistics on table row counts and schema integrity.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import asyncpg

# Ensure backend module is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import (
    DDL_STATEMENTS,
    MIGRATIONS,
    compute_cpcb_aqi,
    get_in_memory_store,
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://prana:pranapass@localhost:5432/prana"
)


# ==============================================================================
# Realistic Episode Seed Data
# ==============================================================================

def generate_hotspots() -> List[Dict[str, Any]]:
    """Generates ~15 realistic stubble burning hotspots across Punjab corridor."""
    base_time = datetime.now(timezone.utc) - timedelta(hours=2)
    fires = [
        # Sangrur cluster (hotspot epicenter)
        {"lat": 30.245, "lon": 75.842, "frp": 68.4, "bright": 348.2, "conf": "high"},
        {"lat": 30.258, "lon": 75.865, "frp": 112.0, "bright": 365.1, "conf": "high"},
        {"lat": 30.231, "lon": 75.820, "frp": 45.3, "bright": 332.5, "conf": "nominal"},
        {"lat": 30.280, "lon": 75.890, "frp": 89.1, "bright": 355.0, "conf": "high"},
        # Ludhiana South
        {"lat": 30.820, "lon": 75.810, "frp": 76.5, "bright": 350.4, "conf": "high"},
        {"lat": 30.845, "lon": 75.850, "frp": 52.8, "bright": 339.1, "conf": "nominal"},
        {"lat": 30.790, "lon": 75.760, "frp": 94.2, "bright": 358.7, "conf": "high"},
        # Bathinda & Mansa
        {"lat": 30.180, "lon": 75.020, "frp": 62.1, "bright": 342.6, "conf": "nominal"},
        {"lat": 30.210, "lon": 75.080, "frp": 81.3, "bright": 352.0, "conf": "high"},
        {"lat": 29.980, "lon": 75.380, "frp": 58.7, "bright": 340.2, "conf": "nominal"},
        # Patiala & Kaithal (Haryana border)
        {"lat": 30.340, "lon": 76.380, "frp": 73.0, "bright": 349.5, "conf": "high"},
        {"lat": 30.310, "lon": 76.420, "frp": 41.5, "bright": 331.0, "conf": "nominal"},
        {"lat": 29.800, "lon": 76.400, "frp": 65.4, "bright": 346.8, "conf": "nominal"},
        # Karnal / Kurukshetra
        {"lat": 29.680, "lon": 76.980, "frp": 55.2, "bright": 338.4, "conf": "nominal"},
        {"lat": 29.970, "lon": 76.880, "frp": 48.9, "bright": 334.6, "conf": "nominal"},
    ]
    return [
        {
            "latitude": f["lat"],
            "longitude": f["lon"],
            "frp": f["frp"],
            "brightness": f["bright"],
            "confidence": f["conf"],
            "acq_datetime": (base_time - timedelta(minutes=i * 7)).isoformat(),
            "sensor": "VIIRS_SNPP",
        }
        for i, f in enumerate(fires)
    ]


def generate_station_readings() -> List[Dict[str, Any]]:
    """Generates realistic CPCB monitoring stations along Punjab -> Delhi corridor."""
    now = datetime.now(timezone.utc)
    stations = [
        # Delhi NCR Receptor Stations
        {"id": "DL01", "name": "Anand Vihar", "city": "Delhi", "state": "Delhi", "lat": 28.647, "lon": 77.316, "pm25": 412.5},
        {"id": "DL02", "name": "Punjabi Bagh", "city": "Delhi", "state": "Delhi", "lat": 28.668, "lon": 77.116, "pm25": 385.0},
        {"id": "DL03", "name": "ITO", "city": "Delhi", "state": "Delhi", "lat": 28.629, "lon": 77.241, "pm25": 345.2},
        {"id": "DL04", "name": "R K Puram", "city": "Delhi", "state": "Delhi", "lat": 28.563, "lon": 77.186, "pm25": 320.0},
        {"id": "DL05", "name": "Jahangirpuri", "city": "Delhi", "state": "Delhi", "lat": 28.733, "lon": 77.170, "pm25": 445.8},
        {"id": "DL06", "name": "Bawana", "city": "Delhi", "state": "Delhi", "lat": 28.776, "lon": 77.051, "pm25": 460.2},
        {"id": "HR01", "name": "Sector 51", "city": "Gurugram", "state": "Haryana", "lat": 28.423, "lon": 77.071, "pm25": 295.4},
        {"id": "HR02", "name": "Sector 62", "city": "Noida", "state": "Uttar Pradesh", "lat": 28.624, "lon": 77.365, "pm25": 365.1},
        {"id": "HR03", "name": "NIT Faridabad", "city": "Faridabad", "state": "Haryana", "lat": 28.390, "lon": 77.310, "pm25": 335.6},
        # Punjab Source Stations
        {"id": "PB01", "name": "Civil Lines", "city": "Ludhiana", "state": "Punjab", "lat": 30.901, "lon": 75.857, "pm25": 280.4},
        {"id": "PB02", "name": "Golden Temple", "city": "Amritsar", "state": "Punjab", "lat": 31.620, "lon": 74.876, "pm25": 240.2},
        {"id": "PB03", "name": "Model Town", "city": "Patiala", "state": "Punjab", "lat": 30.339, "lon": 76.386, "pm25": 265.8},
        {"id": "PB04", "name": "Civil Station", "city": "Bathinda", "state": "Punjab", "lat": 30.211, "lon": 74.945, "pm25": 310.5},
        {"id": "PB05", "name": "Industrial Area", "city": "Khanna", "state": "Punjab", "lat": 30.707, "lon": 76.216, "pm25": 290.0},
    ]

    records = []
    for s in stations:
        records.append({
            "station_id": s["id"],
            "station_name": s["name"],
            "city": s["city"],
            "state": s["state"],
            "latitude": s["lat"],
            "longitude": s["lon"],
            "parameter": "pm25",
            "pm25_ugm3": s["pm25"],
            "unit": "ug/m3",
            "measured_at": (now - timedelta(minutes=15)).isoformat(),
        })
    return records


def generate_anomaly_flags() -> List[Dict[str, Any]]:
    """Generates industrial anomaly records with distinct daytime vs nighttime records."""
    today = date.today()
    return [
        {
            "station_id": "DL06_BAWANA",
            "parameter": "no2",
            "day": today,
            "hour_of_day": 2,
            "is_nighttime": True,
            "anomaly_score": 0.42,
            "is_anomaly": True,
        },
        {
            "station_id": "DL06_BAWANA",
            "parameter": "no2",
            "day": today,
            "hour_of_day": 14,
            "is_nighttime": False,
            "anomaly_score": -0.15,
            "is_anomaly": False,
        },
        {
            "station_id": "HR03_FARIDABAD",
            "parameter": "so2",
            "day": today,
            "hour_of_day": 3,
            "is_nighttime": True,
            "anomaly_score": 0.38,
            "is_anomaly": True,
        },
        {
            "station_id": "HR03_FARIDABAD",
            "parameter": "so2",
            "day": today,
            "hour_of_day": 12,
            "is_nighttime": False,
            "anomaly_score": -0.22,
            "is_anomaly": False,
        },
    ]


def generate_incidents() -> List[Dict[str, Any]]:
    """Generates active CPCB emergency incident tickets."""
    now = datetime.now(timezone.utc)
    return [
        {
            "incident_id": "INC-20261104-001",
            "severity": "emergency",
            "location_text": "Anand Vihar Transport Corridor, Delhi",
            "latitude": 28.647,
            "longitude": 77.316,
            "pollutant": "PM2.5",
            "measured_pm25": 445.8,
            "measured_aqi": 490,
            "satellite_ts": (now - timedelta(hours=1)).isoformat(),
            "satellite_source": "VIIRS_SNPP",
            "authority": "CPCB_CAQM",
            "auto_generated": True,
            "created_at": (now - timedelta(minutes=45)).isoformat(),
        },
        {
            "incident_id": "INC-20261104-002",
            "severity": "warning",
            "location_text": "Sangrur Agricultural Fire Cluster, Punjab",
            "latitude": 30.258,
            "longitude": 75.865,
            "pollutant": "PM2.5",
            "measured_pm25": 310.0,
            "measured_aqi": 385,
            "satellite_ts": (now - timedelta(hours=2)).isoformat(),
            "satellite_source": "VIIRS_SNPP",
            "authority": "PPCB_Punjab",
            "auto_generated": True,
            "created_at": (now - timedelta(hours=1, minutes=30)).isoformat(),
        },
    ]


def generate_fl_rounds() -> List[Dict[str, Any]]:
    """Seed measured results from the reproducible synthetic FedAvg experiment."""
    from backend.ml.federated.server import FederatedServer
    return [{**r, "computed_at": datetime.now(timezone.utc).isoformat()}
            for r in FederatedServer().run_rounds(10)]


# ==============================================================================
# Database Operations
# ==============================================================================

async def apply_migrations(conn: asyncpg.Connection):
    """Executes all PostGIS DDL table creation statements."""
    print("[MIGRATION] Applying PostGIS extensions & table schemas...")
    async with conn.transaction():
        for ddl in DDL_STATEMENTS + MIGRATIONS:
            await conn.execute(ddl)
    print("[MIGRATION] All 8 tables created or verified successfully.")


async def seed_postgres(conn: asyncpg.Connection, clean: bool = False):
    """Seeds PostgreSQL tables with realistic corridor episode data."""
    if clean:
        print("[CLEAN] Truncating existing tables...")
        await conn.execute("""
            TRUNCATE TABLE fire_hotspots, aqi_readings, forecast_zones,
                           anomaly_flags, citizen_reports, incidents, fl_rounds, pollutant_readings
            RESTART IDENTITY CASCADE;
        """)

    # 1. Fire Hotspots
    hotspots = generate_hotspots()
    for h in hotspots:
        await conn.execute(
            """
            INSERT INTO fire_hotspots (latitude, longitude, frp, brightness, confidence, acq_datetime, sensor)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            h["latitude"], h["longitude"], h["frp"], h["brightness"],
            h["confidence"], datetime.fromisoformat(h["acq_datetime"]), h["sensor"]
        )
    print(f"[SEED] Inserted {len(hotspots)} active fire hotspots.")

    # 2. AQI Readings
    stations = generate_station_readings()
    for s in stations:
        await conn.execute(
            """
            INSERT INTO aqi_readings (station_id, station_name, city, state, latitude, longitude, parameter, pm25_ugm3, unit, measured_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            s["station_id"], s["station_name"], s["city"], s["state"], s["latitude"], s["longitude"],
            s["parameter"], s["pm25_ugm3"], s["unit"], datetime.fromisoformat(s["measured_at"])
        )
    print(f"[SEED] Inserted {len(stations)} CPCB / OpenAQ station readings (DEC-010).")

    # 3. Anomaly Flags
    anomalies = generate_anomaly_flags()
    for a in anomalies:
        await conn.execute(
            """
            INSERT INTO anomaly_flags (station_id, parameter, day, hour_of_day, is_nighttime, anomaly_score, is_anomaly)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (station_id, parameter, day, is_nighttime) DO UPDATE
            SET anomaly_score = EXCLUDED.anomaly_score, is_anomaly = EXCLUDED.is_anomaly
            """,
            a["station_id"], a["parameter"], a["day"], a["hour_of_day"],
            a["is_nighttime"], a["anomaly_score"], a["is_anomaly"]
        )
    print(f"[SEED] Inserted {len(anomalies)} industrial anomaly records.")

    # 4. Incidents
    incidents = generate_incidents()
    for inc in incidents:
        await conn.execute(
            """
            INSERT INTO incidents (incident_id, severity, location_text, latitude, longitude, pollutant, measured_pm25, measured_aqi, satellite_ts, satellite_source, authority, auto_generated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (incident_id) DO NOTHING
            """,
            inc["incident_id"], inc["severity"], inc["location_text"], inc["latitude"],
            inc["longitude"], inc["pollutant"], inc["measured_pm25"], inc["measured_aqi"],
            datetime.fromisoformat(inc["satellite_ts"]), inc["satellite_source"], inc["authority"], inc["auto_generated"]
        )
    print(f"[SEED] Inserted {len(incidents)} emergency incident tickets.")

    # 5. FL Rounds
    fl_rounds = generate_fl_rounds()
    for r in fl_rounds:
        await conn.execute(
            """
            INSERT INTO fl_rounds (round_number, punjab_accuracy, delhi_accuracy, global_accuracy, run_id, computed_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (run_id, round_number) DO NOTHING
            """,
            r["round_number"], r["punjab_accuracy"], r["delhi_accuracy"],
            r["global_accuracy"], r["run_id"], datetime.fromisoformat(r["computed_at"])
        )
    print(f"[SEED] Inserted {len(fl_rounds)} Federated Learning simulation rounds.")


async def verify_postgres(conn: asyncpg.Connection):
    """Queries and prints row counts and spatial index status for all tables."""
    print("\n" + "=" * 65)
    print(f"{'Table Name':<25} | {'Row Count':<12} | {'Status'}")
    print("-" * 65)
    tables = [
        "fire_hotspots",
        "aqi_readings",
        "forecast_zones",
        "anomaly_flags",
        "citizen_reports",
        "incidents",
        "fl_rounds",
        "pollutant_readings",
    ]
    for tbl in tables:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {tbl}")
        status = "HEALTHY" if count > 0 or tbl in ("forecast_zones", "citizen_reports") else "EMPTY"
        print(f"{tbl:<25} | {count:<12} | {status}")
    print("=" * 65)


def seed_in_memory():
    """Populates in-memory fallback store when PostgreSQL is not connected."""
    store = get_in_memory_store()
    store["fire_hotspots"] = generate_hotspots()
    store["aqi_readings"] = generate_station_readings()
    store["anomaly_flags"] = generate_anomaly_flags()
    store["incidents"] = generate_incidents()
    store["fl_rounds"] = generate_fl_rounds()

    print("[IN-MEMORY] Populated in-memory fallback store:")
    for k, v in store.items():
        print(f" - {k:<20}: {len(v)} items")


async def main():
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / "backend" / ".env")
    parser = argparse.ArgumentParser(description="PRANA Database Seeder & Migration CLI")
    parser.add_argument("--clean", action="store_true", help="Truncate tables before seeding")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing row counts")
    parser.add_argument("--in-memory", action="store_true", help="Seed in-memory store directly")
    args = parser.parse_args()
    if os.getenv("PRANA_ENV") == "production" and not args.verify_only:
        parser.error("Synthetic seeding is disabled in production")

    print("=" * 70)
    print("PRANA Atmospheric Corridor — Database Seeder & Verification")
    print("=" * 70)

    if args.in_memory:
        seed_in_memory()
        return

    db_url = os.getenv("DATABASE_URL", DATABASE_URL).replace("postgresql+asyncpg://", "postgresql://")
    # Attempt PostgreSQL Connection
    try:
        print("Connecting to configured database")
        conn = await asyncpg.connect(db_url, timeout=5.0)
        print("Connected to PostgreSQL successfully.")

        try:
            await apply_migrations(conn)

            if not args.verify_only:
                await seed_postgres(conn, clean=args.clean)

            await verify_postgres(conn)
        finally:
            await conn.close()

    except Exception as e:
        print(f"Database verification failed: {type(e).__name__}")
        raise SystemExit(1)



if __name__ == "__main__":
    asyncio.run(main())
