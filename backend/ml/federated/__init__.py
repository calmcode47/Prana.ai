"""
PRANA Federated Learning Subsystem (REQ-008, SEC-006)
Simulates cross-state FedAvg aggregation between Punjab (fire source node)
and Delhi (urban receptor node) while guaranteeing zero raw data leakage.
"""

from backend.ml.federated.client_punjab import PunjabClient
from backend.ml.federated.client_delhi import DelhiClient
from backend.ml.federated.server import run_federated_simulation

__all__ = ["PunjabClient", "DelhiClient", "run_federated_simulation"]
