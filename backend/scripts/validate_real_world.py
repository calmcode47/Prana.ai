"""Evaluate saved predictions against user-supplied real observations.

This command intentionally has no network client. It only reads a CSV already
placed inside the repository and writes an aggregate report under backend/.local.
"""
import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "backend" / ".local" / "model-validation" / "report.json"


def _inside_repo(path: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise ValueError("Input and output paths must remain inside the repository") from exc
    return resolved


def evaluate_csv(input_path: Path) -> dict:
    path = _inside_repo(input_path)
    grouped = defaultdict(lambda: ([], []))
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"model", "predicted", "observed"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("CSV requires model,predicted,observed columns")
        for line, row in enumerate(reader, start=2):
            try:
                predicted, observed = float(row["predicted"]), float(row["observed"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid numeric value on CSV line {line}") from exc
            if not row["model"].strip() or not math.isfinite(predicted) or not math.isfinite(observed):
                raise ValueError(f"Invalid value on CSV line {line}")
            grouped[row["model"].strip()][0].append(predicted)
            grouped[row["model"].strip()][1].append(observed)
    results = []
    for model, (predicted, observed) in sorted(grouped.items()):
        if len(predicted) < 10:
            raise ValueError(f"Model {model!r} needs at least 10 paired observations")
        p, o = np.asarray(predicted), np.asarray(observed)
        error = p - o
        denominator = float(np.sum((o - np.mean(o)) ** 2))
        results.append({"model": model, "sample_count": len(p),
                        "mae": round(float(np.mean(np.abs(error))), 6),
                        "rmse": round(float(np.sqrt(np.mean(error ** 2))), 6),
                        "bias": round(float(np.mean(error)), 6),
                        "r_squared": round(1.0 - float(np.sum(error ** 2)) / denominator, 6) if denominator else None,
                        "pearson_r": round(float(np.corrcoef(p, o)[0, 1]), 6)
                        if np.std(p) and np.std(o) else None})
    if not results:
        raise ValueError("CSV contains no observations")
    return {"status": "computed_from_supplied_pairs", "input": str(path.relative_to(REPO_ROOT)),
            "results": results, "claim": "These metrics describe only the supplied paired dataset"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate model predictions against local real observations")
    parser.add_argument("--input", required=True, type=Path,
                        help="CSV inside this repository with model,predicted,observed columns")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = evaluate_csv(args.input)
    output = _inside_repo(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(output.relative_to(REPO_ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
