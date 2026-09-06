"""
Corridor Neural Predictor (Pure NumPy Implementation)
2-layer neural regressor for air quality time-series prediction across the
Punjab -> Delhi atmospheric transport corridor.
"""

from typing import List, Tuple
import numpy as np


class CorridorPredictor:
    """
    Lightweight 2-layer MLP for atmospheric transport corridor prediction.
    Architecture:
        Input: 4 features [pm25, temp, wind, fire_count]
        Hidden 1: 32 units (tanh)
        Hidden 2: 16 units (tanh)
        Output: 1 unit (linear)
    """

    def __init__(self, seed: int = 42):
        rng = np.random.default_rng(seed)
        # Xavier / Glorot initialization
        self.W1 = rng.normal(0, np.sqrt(2.0 / (4 + 32)), (4, 32))
        self.b1 = np.zeros(32)
        self.W2 = rng.normal(0, np.sqrt(2.0 / (32 + 16)), (32, 16))
        self.b2 = np.zeros(16)
        self.W3 = rng.normal(0, np.sqrt(2.0 / (16 + 1)), (16, 1))
        self.b3 = np.zeros(1)

    def get_parameters(self) -> List[np.ndarray]:
        """Returns current model weights as a list of numpy arrays."""
        return [
            self.W1.copy(),
            self.b1.copy(),
            self.W2.copy(),
            self.b2.copy(),
            self.W3.copy(),
            self.b3.copy(),
        ]

    def set_parameters(self, parameters: List[np.ndarray]) -> None:
        """Sets model weights from an external list of numpy arrays."""
        if len(parameters) != 6:
            raise ValueError(f"Expected 6 parameter arrays, got {len(parameters)}")
        self.W1 = parameters[0].copy()
        self.b1 = parameters[1].copy()
        self.W2 = parameters[2].copy()
        self.b2 = parameters[3].copy()
        self.W3 = parameters[4].copy()
        self.b3 = parameters[5].copy()

    def forward(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Forward pass.
        Returns:
            y_pred: predicted values (N, 1)
            a1: activations of hidden layer 1 (N, 32)
            a2: activations of hidden layer 2 (N, 16)
        """
        z1 = X @ self.W1 + self.b1
        a1 = np.tanh(z1)
        z2 = a1 @ self.W2 + self.b2
        a2 = np.tanh(z2)
        y_pred = a2 @ self.W3 + self.b3
        return y_pred, a1, a2

    def fit_epoch(
        self, X: np.ndarray, y: np.ndarray, lr: float = 0.01
    ) -> float:
        """
        Performs one epoch of batch gradient descent with MSE loss.
        Returns MSE loss.
        """
        N = len(X)
        if N == 0:
            return 0.0
        y = y.reshape(-1, 1)
        y_pred, a1, a2 = self.forward(X)

        # MSE loss: 0.5 * mean((y_pred - y)^2)
        error = y_pred - y
        loss = float(np.mean(error ** 2))

        # Backward gradients
        delta3 = error / N  # (N, 1)
        dW3 = a2.T @ delta3  # (16, 1)
        db3 = np.sum(delta3, axis=0)  # (1,)

        delta2 = (delta3 @ self.W3.T) * (1.0 - a2 ** 2)  # (N, 16)
        dW2 = a1.T @ delta2  # (32, 16)
        db2 = np.sum(delta2, axis=0)  # (16,)

        delta1 = (delta2 @ self.W2.T) * (1.0 - a1 ** 2)  # (N, 32)
        dW1 = X.T @ delta1  # (4, 32)
        db1 = np.sum(delta1, axis=0)  # (32,)

        # Update weights
        self.W3 -= lr * dW3
        self.b3 -= lr * db3
        self.W2 -= lr * dW2
        self.b2 -= lr * db2
        self.W1 -= lr * dW1
        self.b1 -= lr * db1

        return loss

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> Tuple[float, float]:
        """
        Evaluates model on validation data.
        Returns:
            mse: Mean squared error
            accuracy: Normalized accuracy metric in [0.0, 1.0]
        """
        if len(X) == 0:
            return 0.0, 0.0
        y = y.reshape(-1, 1)
        y_pred, _, _ = self.forward(X)
        mse = float(np.mean((y_pred - y) ** 2))
        rmse = np.sqrt(mse)
        y_std = float(np.std(y)) if np.std(y) > 1e-4 else 1.0
        norm_rmse = rmse / y_std
        accuracy = float(np.clip(1.0 - 0.5 * norm_rmse, 0.1, 0.99))
        return mse, accuracy
