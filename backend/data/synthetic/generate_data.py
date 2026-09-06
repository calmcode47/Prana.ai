"""
Synthetic Corridor Dataset Generator (REQ-008, SEC-006)
Generates realistic October–November Indo-Gangetic Plain stubble burning corridor datasets
for Punjab (source node) and Delhi (receptor node).
Features: [pm25_ugm3, temperature_2m, windspeed_10m, fire_count_100km]
"""

import os
from pathlib import Path
import numpy as np

OUTPUT_DIR = Path(__file__).resolve().parent


def generate_corridor_data(n_samples: int = 1200, seed: int = 42):
    """
    Generates synthetic time series modeling the atmospheric transport
    from Punjab stubble fires to Delhi urban airshed.
    """
    rng = np.random.default_rng(seed)
    time = np.linspace(0, 45, n_samples)  # 45 days (Oct 15 - Nov 30)

    # 1. Weather cycles (diurnal + seasonal cooling)
    diurnal = np.sin(2 * np.pi * time * 24 / 24)
    temperature_punjab = 26.0 - 0.2 * time + 5.0 * diurnal + rng.normal(0, 1.2, n_samples)
    temperature_delhi = 27.5 - 0.18 * time + 4.5 * diurnal + rng.normal(0, 1.0, n_samples)

    # Wind speed (m/s) with NW advection events
    wind_punjab = np.clip(3.5 + 1.2 * np.sin(2 * np.pi * time / 7) + rng.normal(0, 0.8, n_samples), 0.5, 12.0)
    wind_delhi = np.clip(2.8 + 1.0 * np.sin(2 * np.pi * time / 7) + rng.normal(0, 0.6, n_samples), 0.4, 9.0)

    # 2. Fire activity (Punjab peak during early-mid November, days 15-30)
    fire_bell = np.exp(-((time - 22) ** 2) / (2 * (6 ** 2)))
    fire_count_punjab = np.clip(rng.poisson(250 * fire_bell + 10), 0, 500).astype(float)
    fire_count_delhi = np.clip(rng.poisson(5 * fire_bell + 1), 0, 20).astype(float)

    # 3. PM2.5 Concentrations
    # Punjab: directly impacted by local fires + stagnation
    punjab_pm25_base = 65.0 + 0.8 * fire_count_punjab - 2.5 * wind_punjab + rng.normal(0, 15, n_samples)
    punjab_pm25 = np.clip(punjab_pm25_base, 25.0, 750.0)

    # Delhi: urban base + transport lag from Punjab fires (18h-24h delay ~ 0.75-1 day lag)
    lag_steps = int(n_samples * (0.85 / 45))  # ~20-24 steps lag
    transported_plume = np.roll(fire_count_punjab, lag_steps) * 0.45
    transported_plume[:lag_steps] = 0.0

    delhi_pm25_base = 120.0 + transported_plume - 4.0 * wind_delhi + 15.0 * diurnal + rng.normal(0, 20, n_samples)
    delhi_pm25 = np.clip(delhi_pm25_base, 40.0, 850.0)

    # Normalize features for neural network stability
    # [pm25, temp, wind, fire_count]
    X_punjab = np.column_stack([
        (punjab_pm25 - 150.0) / 100.0,
        (temperature_punjab - 20.0) / 10.0,
        (wind_punjab - 3.5) / 2.0,
        (fire_count_punjab - 50.0) / 100.0,
    ])
    # Target: next step PM2.5 normalized
    y_punjab = np.roll(punjab_pm25, -1)
    y_punjab[-1] = y_punjab[-2]
    y_punjab = (y_punjab - 150.0) / 100.0

    X_delhi = np.column_stack([
        (delhi_pm25 - 180.0) / 120.0,
        (temperature_delhi - 22.0) / 10.0,
        (wind_delhi - 2.8) / 2.0,
        (fire_count_delhi - 5.0) / 10.0,
    ])
    y_delhi = np.roll(delhi_pm25, -1)
    y_delhi[-1] = y_delhi[-2]
    y_delhi = (y_delhi - 180.0) / 120.0

    # Train / validation split (80 / 20)
    split_idx = int(0.8 * n_samples)
    
    # Save Punjab dataset
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    punjab_path = OUTPUT_DIR / "punjab_train.npz"
    np.savez_compressed(
        punjab_path,
        X_train=X_punjab[:split_idx],
        y_train=y_punjab[:split_idx],
        X_val=X_punjab[split_idx:],
        y_val=y_punjab[split_idx:],
    )

    # Save Delhi dataset
    delhi_path = OUTPUT_DIR / "delhi_train.npz"
    np.savez_compressed(
        delhi_path,
        X_train=X_delhi[:split_idx],
        y_train=y_delhi[:split_idx],
        X_val=X_delhi[split_idx:],
        y_val=y_delhi[split_idx:],
    )

    # Save corridor evaluation dataset (joint corridor test set)
    corridor_eval_path = OUTPUT_DIR / "corridor_eval.npz"
    np.savez_compressed(
        corridor_eval_path,
        X_test=np.vstack([X_punjab[split_idx:], X_delhi[split_idx:]]),
        y_test=np.concatenate([y_punjab[split_idx:], y_delhi[split_idx:]]),
    )

    print(f"Generated synthetic datasets in {OUTPUT_DIR}:")
    print(f" - punjab_train.npz: {X_punjab.shape}")
    print(f" - delhi_train.npz:  {X_delhi.shape}")
    print(f" - corridor_eval.npz: {X_punjab[split_idx:].shape[0] * 2} test pairs")
    return punjab_path, delhi_path, corridor_eval_path


if __name__ == "__main__":
    generate_corridor_data()
