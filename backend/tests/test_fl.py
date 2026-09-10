"""
Federated Learning Simulation Tests (REQ-008, SEC-006)
Validates:
1. SEC-006: Weight-only serialization with strictly empty metrics dict in fit().
2. REQ-008: 10 rounds of measured FedAvg simulation telemetry.
3. Database uniqueness constraint on (run_id, round_number).
4. REST API status and run endpoint schemas.
"""

import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport

from backend.main import app
from backend.ml.federated.client_punjab import PunjabClient
from backend.ml.federated.client_delhi import DelhiClient
from backend.ml.federated.server import run_federated_simulation, FederatedServer, save_fl_rounds
from backend.ml.federated.model import CorridorPredictor
from backend.ml.federated.privacy import (
    gaussian_zcdp_epsilon, noise_multiplier_for_epsilon, paillier_fed_avg,
)
from backend.database import get_in_memory_store


@pytest.mark.asyncio
async def test_fl_memory_upsert_replaces_existing_score():
    row = dict(run_id="FL-UPSERT", round_number=1, punjab_accuracy=0.2, delhi_accuracy=0.3, global_accuracy=0.4)
    await save_fl_rounds([row])
    await save_fl_rounds([{**row, "global_accuracy": 0.5}])
    saved = get_in_memory_store()["fl_rounds"]
    assert len(saved) == 1 and saved[0]["global_accuracy"] == 0.5


# ==============================================================================
# 1. SEC-006 Privacy Guarantee: Weight-Only Serialization
# ==============================================================================
def test_fl_client_no_raw_data():
    """
    Validates SEC-006:
    The client fit() method MUST return strictly a 3-tuple (parameters, num_examples, {}).
    The third parameter must be an empty dictionary to prevent covert data leakage.
    """
    p_client = PunjabClient(seed=101)
    d_client = DelhiClient(seed=202)

    # Initial parameter extraction
    initial_params = p_client.get_parameters()
    assert isinstance(initial_params, list)
    assert len(initial_params) == 6

    # Test Punjab fit
    p_res = p_client.fit(initial_params, {"epochs": 2, "lr": 0.01})
    assert isinstance(p_res, tuple)
    assert len(p_res) == 3

    p_weights, p_n, p_metrics = p_res
    assert isinstance(p_weights, list)
    assert isinstance(p_n, int)
    assert p_n > 0
    # Strict SEC-006 assertion: metrics dict MUST be empty {}
    assert isinstance(p_metrics, dict)
    assert p_metrics == {}, f"Punjab client leaked metrics: {p_metrics}"

    # Verify weights are strictly valid numeric numpy arrays matching architecture
    for w in p_weights:
        assert isinstance(w, np.ndarray)
        assert np.issubdtype(w.dtype, np.floating)
        assert not np.isnan(w).any()

    # Test Delhi fit
    d_res = d_client.fit(initial_params, {"epochs": 2, "lr": 0.01})
    assert isinstance(d_res, tuple)
    assert len(d_res) == 3

    d_weights, d_n, d_metrics = d_res
    assert isinstance(d_weights, list)
    assert isinstance(d_n, int)
    assert d_n > 0
    # Strict SEC-006 assertion: metrics dict MUST be empty {}
    assert isinstance(d_metrics, dict)
    assert d_metrics == {}, f"Delhi client leaked metrics: {d_metrics}"


# ==============================================================================
# 2. REQ-008 Federated Aggregation & Superiority
# ==============================================================================
@pytest.mark.asyncio
async def test_federated_training_10_rounds():
    """
    Validates REQ-008:
    10 rounds of Federated Averaging simulation.
    Ensures the backend returns observed loss and accuracy without manufacturing
    a superiority claim.
    """
    result = await run_federated_simulation(num_rounds=10)

    assert result["status"] == "complete"
    assert result["total_rounds"] == 10
    rounds = result["rounds"]
    assert len(rounds) == 10

    # Verify distinct round numbers 1 through 10
    round_numbers = [r["round_number"] for r in rounds]
    assert round_numbers == list(range(1, 11))

    # Scores and losses are measured rather than synthesized for display.
    final_round = rounds[-1]
    assert final_round["round_number"] == 10
    g_acc = final_round["global_accuracy"]
    p_acc = final_round["punjab_accuracy"]
    d_acc = final_round["delhi_accuracy"]

    assert all(0.0 <= value <= 1.0 for value in (g_acc, p_acc, d_acc))
    assert all(np.isfinite(r["global_loss"]) and r["global_loss"] >= 0 for r in rounds)


def test_dp_accounting_and_clipped_training():
    target, steps, delta = 0.42, 20, 1e-5
    sigma = noise_multiplier_for_epsilon(target, steps, delta)
    assert gaussian_zcdp_epsilon(steps, sigma, delta) == pytest.approx(target)
    model = CorridorPredictor(seed=9)
    rng = np.random.default_rng(10)
    X, y = rng.normal(size=(20, 4)), rng.normal(size=20)
    loss, clipped = model.fit_epoch_dp(X, y, 0.01, 1.0, sigma, rng)
    assert np.isfinite(loss) and 0 <= clipped <= 1


def test_paillier_2048_homomorphic_fedavg():
    clients = [[np.array([1.25, -0.5]), np.array([[2.0]])],
               [np.array([3.0, 1.5]), np.array([[4.0]])]]
    encrypted, stats = paillier_fed_avg(clients, [1, 3])
    expected = [clients[0][i] * 0.25 + clients[1][i] * 0.75 for i in range(2)]
    assert stats["scheme"] == "Paillier" and stats["key_bits"] == 2048
    for actual, wanted in zip(encrypted, expected):
        assert np.allclose(actual, wanted, atol=2e-6)


# ==============================================================================
# 3. Uniqueness Constraint
# ==============================================================================
@pytest.mark.asyncio
async def test_fl_unique_constraint():
    """
    Validates that each simulation run has a unique run_id and
    no duplicate (run_id, round_number) entries are stored.
    """
    run_1 = await run_federated_simulation(num_rounds=5)
    run_2 = await run_federated_simulation(num_rounds=5)

    assert run_1["run_id"] != run_2["run_id"]

    store = get_in_memory_store()
    fl_store = store.get("fl_rounds", [])

    # Check for run_1
    run_1_items = [item for item in fl_store if item["run_id"] == run_1["run_id"]]
    assert len(run_1_items) == 5
    run_1_rounds = [item["round_number"] for item in run_1_items]
    assert len(set(run_1_rounds)) == len(run_1_rounds)

    # Check for run_2
    run_2_items = [item for item in fl_store if item["run_id"] == run_2["run_id"]]
    assert len(run_2_items) == 5
    run_2_rounds = [item["round_number"] for item in run_2_items]
    assert len(set(run_2_rounds)) == len(run_2_rounds)


# ==============================================================================
# 4. REST Endpoints
# ==============================================================================
@pytest.mark.asyncio
async def test_federated_api_endpoints():
    """
    Tests GET /api/v1/federated/status and POST /api/v1/federated/run.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": "Bearer test-operator-key"},
    ) as client:
        # Trigger run
        post_resp = await client.post("/api/v1/federated/run?num_rounds=10")
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        assert "run_id" in post_data
        assert post_data["total_rounds"] == 10
        assert len(post_data["rounds"]) == 10

        # Query status
        get_resp = await client.get("/api/v1/federated/status")
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["run_id"] == post_data["run_id"]
        assert get_data["total_rounds"] == 10
        assert get_data["status"] == "complete"
        assert len(get_data["rounds"]) == 10
        assert get_data["rounds"][-1]["global_loss"] >= 0
