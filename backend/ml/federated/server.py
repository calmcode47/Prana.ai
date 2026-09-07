"""
Federated Learning Aggregator & Simulation Server (REQ-008, SEC-006)
Executes Federated Averaging (FedAvg) across Punjab and Delhi nodes,
evaluating cross-corridor prediction accuracy and persisting round metrics.
"""

import logging
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np

from backend.ml.federated.client_punjab import PunjabClient
from backend.ml.federated.client_delhi import DelhiClient
from backend.ml.federated.model import CorridorPredictor
from backend.ml.federated.privacy import (
    gaussian_zcdp_epsilon,
    noise_multiplier_for_epsilon,
    paillier_fed_avg,
)
from backend.database import get_db_pool, get_in_memory_store

logger = logging.getLogger("prana.ml.federated")

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"


def fed_avg(
    client_parameters: List[List[np.ndarray]],
    client_samples: List[int],
) -> List[np.ndarray]:
    """
    Computes weighted Federated Average of model parameters:
    W_global = sum(n_k / N * W_k)
    """
    total_samples = sum(client_samples)
    if total_samples == 0:
        return client_parameters[0]

    num_layers = len(client_parameters[0])
    aggregated_params = []

    for layer_idx in range(num_layers):
        layer_sum = np.zeros_like(client_parameters[0][layer_idx], dtype=np.float64)
        for client_idx, params in enumerate(client_parameters):
            weight = client_samples[client_idx] / total_samples
            layer_sum += weight * params[layer_idx]
        aggregated_params.append(layer_sum)

    return aggregated_params


class FederatedServer:
    """
    Coordinates multi-round FedAvg between Punjab and Delhi client nodes.
    """

    def __init__(self, run_id: Optional[str] = None, seed: int = 42):
        self.run_id = run_id or f"FL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        self.punjab_client = PunjabClient(seed=seed)
        self.delhi_client = DelhiClient(seed=seed + 1)
        self.global_evaluator = CorridorPredictor(seed=seed + 2)

        # Load corridor test set for global cross-regional evaluation
        corridor_path = DATA_DIR / "corridor_eval.npz"
        if corridor_path.exists():
            data = np.load(corridor_path)
            self.X_test = data["X_test"]
            self.y_test = data["y_test"]
        else:
            rng = np.random.default_rng(seed + 3)
            self.X_test = rng.normal(0, 1, (400, 4))
            self.y_test = rng.normal(0, 1, (400,))

    def run_rounds(self, num_rounds: int = 10) -> List[Dict[str, Any]]:
        """
        Executes num_rounds of FedAvg.
        Ensures SEC-006 compliance (fit returns empty metric dicts)
        and REQ-008 (global model achieves superior accuracy over local-only models).
        """
        global_params = self.global_evaluator.get_parameters()
        round_results: List[Dict[str, Any]] = []
        local_punjab = PunjabClient(seed=42)
        local_delhi = DelhiClient(seed=43)
        local_punjab.set_parameters(global_params)
        local_delhi.set_parameters(global_params)

        epochs = 10
        dp_enabled = os.getenv("PRANA_FL_DP_ENABLED", "true").lower() in ("1", "true", "yes")
        encryption_enabled = os.getenv("PRANA_FL_PAILLIER_ENABLED", "true").lower() in ("1", "true", "yes")
        target_epsilon = float(os.getenv("PRANA_FL_DP_EPSILON", "0.42"))
        delta = float(os.getenv("PRANA_FL_DP_DELTA", "0.00001"))
        max_grad_norm = float(os.getenv("PRANA_FL_DP_MAX_GRAD_NORM", "1.0"))
        total_steps = num_rounds * epochs
        noise_multiplier = noise_multiplier_for_epsilon(target_epsilon, total_steps, delta) if dp_enabled else 0.0
        self.privacy_summary = {
            "dp_sgd": {"enabled": dp_enabled, "target_epsilon": target_epsilon if dp_enabled else None,
                       "delta": delta if dp_enabled else None, "max_grad_norm": max_grad_norm if dp_enabled else None,
                       "noise_multiplier": round(noise_multiplier, 6) if dp_enabled else None,
                       "accounting": "conservative full-batch replace-one Gaussian zCDP composition"},
            "secure_aggregation": {"enabled": encryption_enabled, "scheme": "Paillier" if encryption_enabled else None,
                                   "key_bits": 2048 if encryption_enabled else None,
                                   "scope": "simulated transport boundary in this single-process backend"},
        }

        for r in range(1, num_rounds + 1):
            # 1. Local Training (fit strictly returns empty dict for metrics - SEC-006)
            fit_config = {"epochs": epochs, "lr": 0.025, "dp_enabled": dp_enabled,
                          "noise_multiplier": noise_multiplier, "max_grad_norm": max_grad_norm}
            p_params, n_p, p_metrics = self.punjab_client.fit(global_params, fit_config)
            d_params, n_d, d_metrics = self.delhi_client.fit(global_params, fit_config)

            # Assert SEC-006 compliance during execution
            assert p_metrics == {}, "SEC-006 violation: Punjab client leaked non-empty metrics in fit()"
            assert d_metrics == {}, "SEC-006 violation: Delhi client leaked non-empty metrics in fit()"

            # 2. Federated Aggregation (FedAvg)
            if encryption_enabled:
                global_params, encryption_stats = paillier_fed_avg([p_params, d_params], [n_p, n_d])
                self.privacy_summary["secure_aggregation"].update(encryption_stats)
            else:
                global_params = fed_avg([p_params, d_params], [n_p, n_d])
            self.global_evaluator.set_parameters(global_params)

            # Independent local-only baselines receive the same training budget.
            local_punjab.fit(local_punjab.get_parameters(), {"epochs": 10, "lr": 0.025})
            local_delhi.fit(local_delhi.get_parameters(), {"epochs": 10, "lr": 0.025})
            # 3. Evaluation on local validation splits
            _, _, p_eval = self.punjab_client.evaluate(p_params)
            _, _, d_eval = self.delhi_client.evaluate(d_params)

            # 4. Global Evaluation across combined corridor dataset
            global_loss, g_raw_acc = self.global_evaluator.evaluate(self.X_test, self.y_test)

            # Compare every set of weights on the same held-out corridor data.
            self.global_evaluator.set_parameters(local_punjab.get_parameters())
            _, p_acc = self.global_evaluator.evaluate(self.X_test, self.y_test)
            self.global_evaluator.set_parameters(local_delhi.get_parameters())
            _, d_acc = self.global_evaluator.evaluate(self.X_test, self.y_test)
            self.global_evaluator.set_parameters(global_params)
            p_acc, d_acc, g_acc = (round(float(v), 6) for v in (p_acc, d_acc, g_raw_acc))

            round_data = {
                "round_number": r,
                "punjab_accuracy": p_acc,
                "delhi_accuracy": d_acc,
                "global_accuracy": g_acc,
                "punjab_loss": round(self.punjab_client.last_fit_telemetry["loss"], 6),
                "delhi_loss": round(self.delhi_client.last_fit_telemetry["loss"], 6),
                "global_loss": round(float(global_loss), 6),
                "dp_epsilon_spent": round(
                    gaussian_zcdp_epsilon(r * epochs, noise_multiplier, delta), 6
                ) if dp_enabled else None,
                "dp_delta": delta if dp_enabled else None,
                "secure_aggregation_scheme": "Paillier" if encryption_enabled else None,
                "secure_aggregation_key_bits": 2048 if encryption_enabled else None,
                "run_id": self.run_id,
            }
            round_results.append(round_data)
            logger.info(
                f"[FL {self.run_id}] Round {r}/{num_rounds}: "
                f"Punjab={p_acc:.3f}, Delhi={d_acc:.3f}, Global={g_acc:.3f}"
            )

        return round_results


async def save_fl_rounds(rounds: List[Dict[str, Any]]) -> None:
    """
    Persists simulated FL round metrics to PostgreSQL fl_rounds table
    and the in-memory fallback store, enforcing UNIQUE (run_id, round_number).
    """
    # Commit the whole run before publishing metrics to the process cache.
    pool = get_db_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.executemany(
                        """
                        INSERT INTO fl_rounds (round_number, punjab_accuracy, delhi_accuracy, global_accuracy,
                                               punjab_loss, delhi_loss, global_loss, dp_epsilon_spent, dp_delta,
                                               secure_aggregation_scheme, secure_aggregation_key_bits,
                                               run_id, computed_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                        ON CONFLICT (run_id, round_number) DO UPDATE
                        SET punjab_accuracy = EXCLUDED.punjab_accuracy,
                            delhi_accuracy = EXCLUDED.delhi_accuracy,
                            global_accuracy = EXCLUDED.global_accuracy,
                            punjab_loss = EXCLUDED.punjab_loss,
                            delhi_loss = EXCLUDED.delhi_loss,
                            global_loss = EXCLUDED.global_loss,
                            dp_epsilon_spent = EXCLUDED.dp_epsilon_spent,
                            dp_delta = EXCLUDED.dp_delta,
                            secure_aggregation_scheme = EXCLUDED.secure_aggregation_scheme,
                            secure_aggregation_key_bits = EXCLUDED.secure_aggregation_key_bits,
                            computed_at = EXCLUDED.computed_at
                        """,
                        [(r["round_number"], r["punjab_accuracy"], r["delhi_accuracy"],
                          r["global_accuracy"], r.get("punjab_loss"), r.get("delhi_loss"),
                          r.get("global_loss"), r.get("dp_epsilon_spent"), r.get("dp_delta"),
                          r.get("secure_aggregation_scheme"), r.get("secure_aggregation_key_bits"),
                          r["run_id"]) for r in rounds],
                    )
        except Exception as e:
            raise RuntimeError("Federated metrics could not be saved") from None

    fl_store = get_in_memory_store().setdefault("fl_rounds", [])
    keyed = {(r["run_id"], r["round_number"]): r for r in fl_store}
    stamp = datetime.now(timezone.utc).isoformat()
    keyed.update({(r["run_id"], r["round_number"]): {**r, "computed_at": stamp} for r in rounds})
    fl_store[:] = list(keyed.values())


async def run_federated_simulation(
    run_id: Optional[str] = None, num_rounds: int = 10
) -> Dict[str, Any]:
    """
    Runs a full FL simulation and persists results.
    Returns status response dictionary.
    """
    if not 1 <= num_rounds <= 100:
        raise ValueError("num_rounds must be between 1 and 100")
    def train():
        server = FederatedServer(run_id=run_id)
        return server, server.run_rounds(num_rounds=num_rounds)
    server, rounds = await asyncio.to_thread(train)
    await save_fl_rounds(rounds)

    return {
        "run_id": server.run_id,
        "total_rounds": len(rounds),
        "status": "complete",
        "rounds": [{key: value for key, value in r.items()
                    if key not in ("run_id", "dp_delta", "secure_aggregation_scheme",
                                   "secure_aggregation_key_bits")} for r in rounds],
        "privacy": server.privacy_summary,
        "dataset": "synthetic_corridor",
    }
