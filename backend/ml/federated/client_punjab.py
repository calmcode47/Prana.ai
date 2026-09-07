"""
Punjab Source Node Federated Learning Client (REQ-008, SEC-006)
Trains locally on Punjab stubble burning time-series.
Strictly returns weight-only parameter updates with zero raw data or metric leakage.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np

from backend.ml.federated.model import CorridorPredictor

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"


class PunjabClient:
    """
    Simulated Federated Learning Client for the Punjab Node.
    Encapsulates raw agricultural burning and meteorological observations.
    """

    def __init__(self, data_path: Optional[Path] = None, seed: int = 42):
        self.model = CorridorPredictor(seed=seed)
        self.rng = np.random.default_rng(seed + 10_000)
        self.last_fit_telemetry: Dict[str, float] = {}
        
        # Load local dataset
        path = data_path or (DATA_DIR / "punjab_train.npz")
        if path.exists():
            data = np.load(path)
            self.X_train = data["X_train"]
            self.y_train = data["y_train"]
            self.X_val = data["X_val"]
            self.y_val = data["y_val"]
        else:
            # Fallback synthetic generation if dataset not pre-generated
            rng = np.random.default_rng(seed)
            self.X_train = rng.normal(0, 1, (800, 4))
            self.y_train = rng.normal(0, 1, (800,))
            self.X_val = rng.normal(0, 1, (200, 4))
            self.y_val = rng.normal(0, 1, (200,))

    def get_parameters(self, config: Optional[Dict[str, Any]] = None) -> List[np.ndarray]:
        """Returns the local model parameters."""
        return self.model.get_parameters()

    def set_parameters(self, parameters: List[np.ndarray]) -> None:
        """Updates local model weights from global parameter vector."""
        self.model.set_parameters(parameters)

    def fit(
        self, parameters: List[np.ndarray], config: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[np.ndarray], int, Dict[str, Any]]:
        """
        Trains the local model for several epochs using local data.

        PRIVACY GUARANTEE (SEC-006):
        Strictly returns a 3-tuple (updated_parameters, num_examples, {}).
        The metrics dictionary is intentionally and strictly empty ({})
        to prevent any side-channel data reconstruction or metadata leakage.
        """
        self.set_parameters(parameters)
        epochs = (config or {}).get("epochs", 3)
        lr = (config or {}).get("lr", 0.02)

        losses, clipped = [], []
        for _ in range(epochs):
            if (config or {}).get("dp_enabled"):
                loss, fraction = self.model.fit_epoch_dp(
                    self.X_train, self.y_train, lr, float(config["max_grad_norm"]),
                    float(config["noise_multiplier"]), self.rng)
                clipped.append(fraction)
            else:
                loss = self.model.fit_epoch(self.X_train, self.y_train, lr=lr)
            losses.append(loss)
        self.last_fit_telemetry = {"loss": float(np.mean(losses)),
                                   "clipped_fraction": float(np.mean(clipped)) if clipped else 0.0}

        # SEC-006: Third element MUST be an empty dictionary {}
        return self.get_parameters(), len(self.X_train), {}

    def evaluate(
        self, parameters: List[np.ndarray], config: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, int, Dict[str, Any]]:
        """Evaluates the model on local validation data."""
        self.set_parameters(parameters)
        mse, accuracy = self.model.evaluate(self.X_val, self.y_val)
        return float(mse), len(self.X_val), {"accuracy": float(accuracy)}
