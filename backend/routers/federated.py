"""
Federated Learning Router (REQ-008, SEC-006)
Serves Flower simulation round history and global vs local model accuracy metrics.
"""

import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Request, Query, HTTPException
import asyncio
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.models import FLStatusResponse
from backend.database import get_db_pool, get_in_memory_store
from backend.ml.federated.server import run_federated_simulation

from backend.routers.citizen import limiter
_run_lock = asyncio.Lock()
router = APIRouter(prefix="/api/v1/federated", tags=["Federated Learning"])

PRERUN_CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "cache" / "fl_prerun.json"


@router.get("/status", response_model=FLStatusResponse)
async def get_federated_status():
    """
    Returns FL simulation round history for the latest run_id.
    Shows global model converging and outperforming local Punjab/Delhi models.
    """
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                latest_run = await conn.fetchval("SELECT run_id FROM fl_rounds ORDER BY computed_at DESC LIMIT 1")
                if latest_run:
                    rows = await conn.fetch(
                        """
                        SELECT round_number, punjab_accuracy, delhi_accuracy, global_accuracy
                        FROM fl_rounds
                        WHERE run_id = $1
                        ORDER BY round_number ASC
                        """,
                        latest_run
                    )
                    rounds = [dict(r) for r in rows]
                    return {
                        "run_id": latest_run,
                        "total_rounds": len(rounds),
                        "status": "complete",
                        "rounds": rounds
                    }
        except Exception:
            raise HTTPException(503, "Federated metrics storage is unavailable") from None

    # Check in-memory store
    store = get_in_memory_store()
    fl_store = store.get("fl_rounds", [])
    if fl_store:
        # Find latest run_id
        latest_item = fl_store[-1]
        latest_run = latest_item["run_id"]
        run_rounds = [
            {
                "round_number": r["round_number"],
                "punjab_accuracy": r["punjab_accuracy"],
                "delhi_accuracy": r["delhi_accuracy"],
                "global_accuracy": r["global_accuracy"]
            }
            for r in fl_store if r["run_id"] == latest_run
        ]
        run_rounds.sort(key=lambda x: x["round_number"])
        return {
            "run_id": latest_run,
            "total_rounds": len(run_rounds),
            "status": "complete",
            "rounds": run_rounds
        }

    return {"run_id": "", "total_rounds": 0, "status": "idle", "rounds": []}


@router.post("/run", response_model=FLStatusResponse)
@limiter.limit("5/minute")
async def trigger_federated_run(request: Request, num_rounds: int = Query(10, ge=1, le=100)):
    """
    Triggers a 10-round Federated Averaging simulation across Punjab and Delhi nodes.
    Updates fl_rounds in the database and in-memory store.
    """
    if _run_lock.locked():
        raise HTTPException(409, "A federated simulation is already running")
    async with _run_lock:
        try:
            return await run_federated_simulation(num_rounds=num_rounds)
        except Exception:
            raise HTTPException(503, "Federated simulation failed") from None
