"""
Anomalies Router (REQ-007)
Serves industrial emission spike flags (daytime vs nighttime) detected via IsolationForest.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query

from backend.models import AnomaliesResponse, AnomalyItem
from backend.database import get_db_pool, get_in_memory_store

router = APIRouter(prefix="/api/v1", tags=["Anomalies"])


@router.get("/anomalies", response_model=AnomaliesResponse)
async def get_anomalies(
    parameter: str = Query("no2", pattern="^(no2|so2)$"),
    nighttime_only: bool = Query(True),
    days_back: int = Query(7, ge=1, le=90)
):
    """
    Returns anomaly flags for industrial emission spikes.
    Stub returning items from anomaly_flags table or clean empty array until SESSION-002.
    """
    items = []
    pool = get_db_pool()

    if pool:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).date()
            async with pool.acquire() as conn:
                query = """
                SELECT station_id, parameter, day, hour_of_day, is_nighttime, anomaly_score, is_anomaly
                FROM anomaly_flags
                WHERE parameter = $1 AND day >= $2
                """
                if nighttime_only:
                    query += " AND is_nighttime = true"
                query += " ORDER BY day DESC, hour_of_day DESC"

                rows = await conn.fetch(query, parameter, cutoff)
                for r in rows:
                    items.append({
                        "station_id": r["station_id"],
                        "station_name": r["station_id"],
                        "parameter": r["parameter"],
                        "day": str(r["day"]),
                        "hour_of_day": r["hour_of_day"],
                        "is_nighttime": r["is_nighttime"],
                        "anomaly_score": r["anomaly_score"],
                        "is_anomaly": r["is_anomaly"]
                    })
        except Exception:
            pass

    return {
        "count": len(items),
        "items": items
    }
