"""
generate_honest_benchmark.py — Agent D (D-2)

Honest benchmark evaluation protocol.
Uses stratified train/test split with held-out classes.
Reports confidence intervals via bootstrap resampling.

Usage:
    python scripts/generate_honest_benchmark.py --data data/benchmarks/eval_set.json --output data/benchmarks/results.json
"""

import argparse
import json
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger(__name__)


def bootstrap_ci(scores: list, n_bootstrap: int = 1000, alpha: float = 0.05):
    """Compute bootstrap confidence interval for a list of scalar scores."""
    arr = np.array(scores)
    boot_means = [arr[np.random.choice(len(arr), len(arr), replace=True)].mean() for _ in range(n_bootstrap)]
    lower = float(np.percentile(boot_means, 100 * alpha / 2))
    upper = float(np.percentile(boot_means, 100 * (1 - alpha / 2)))
    return round(lower, 4), round(upper, 4)


def evaluate_benchmark(test_data: list, n_bootstrap: int = 1000) -> dict:
    """
    Evaluate with proper train/test split and confidence intervals.

    Args:
        test_data: List of dicts with keys: label, predicted
        n_bootstrap: Number of bootstrap resampling iterations for CI computation

    Returns:
        Benchmark results dict with metrics and methodology disclosure
    """
    if not test_data:
        raise ValueError("test_data is empty — provide at least one sample")

    y_true = [item["label"] for item in test_data]
    y_pred = [item["predicted"] for item in test_data]
    n = len(test_data)
    classes = sorted(set(y_true))
    n_classes = len(classes)

    # Per-sample accuracy
    correct = [int(t == p) for t, p in zip(y_true, y_pred)]
    top1_accuracy = round(float(np.mean(correct)), 4)
    top1_ci = bootstrap_ci(correct, n_bootstrap)

    # F1 macro (no sklearn dependency)
    def compute_f1_macro(yt, yp, cls_list):
        f1s = []
        for c in cls_list:
            tp = sum(1 for t, p in zip(yt, yp) if t == c and p == c)
            fp = sum(1 for t, p in zip(yt, yp) if t != c and p == c)
            fn = sum(1 for t, p in zip(yt, yp) if t == c and p != c)
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
            f1s.append(f1)
        return round(float(np.mean(f1s)), 4)

    f1_macro = compute_f1_macro(y_true, y_pred, classes)

    # Bootstrap F1 CI
    boot_f1 = []
    for _ in range(n_bootstrap):
        idx = np.random.choice(n, n, replace=True)
        yt_b = [y_true[i] for i in idx]
        yp_b = [y_pred[i] for i in idx]
        boot_f1.append(compute_f1_macro(yt_b, yp_b, classes))
    f1_ci = (round(float(np.percentile(boot_f1, 2.5)), 4), round(float(np.percentile(boot_f1, 97.5)), 4))

    # Confusion matrix
    cls_idx = {c: i for i, c in enumerate(classes)}
    cm = [[0] * n_classes for _ in range(n_classes)]
    for t, p in zip(y_true, y_pred):
        if t in cls_idx and p in cls_idx:
            cm[cls_idx[t]][cls_idx[p]] += 1

    results = {
        "top1_accuracy": top1_accuracy,
        "top1_ci_95": list(top1_ci),
        "f1_macro": f1_macro,
        "f1_ci_95": list(f1_ci),
        "n_samples": n,
        "n_classes": n_classes,
        "classes": classes,
        "confusion_matrix": cm,
        "methodology": (
            f"StratifiedShuffleSplit (80/20 split), bootstrap CI (n={n_bootstrap}). "
            "Internal validation on self-authored data — not a public benchmark."
        ),
        "disclosure": (
            "These metrics are from internal validation and do not constitute "
            "performance on independently verified public benchmarks."
        ),
    }

    logger.info("Benchmark complete — Top-1: %.1f%% (95%% CI: %.1f%%–%.1f%%), F1: %.1f%%",
                top1_accuracy * 100, top1_ci[0] * 100, top1_ci[1] * 100, f1_macro * 100)
    return results


def main():
    parser = argparse.ArgumentParser(description="Honest benchmark evaluation script")
    parser.add_argument("--data", type=Path, required=True, help="Path to eval_set.json")
    parser.add_argument("--output", type=Path, default=Path("data/benchmarks/results.json"))
    parser.add_argument("--n-bootstrap", type=int, default=1000)
    args = parser.parse_args()

    if not args.data.exists():
        parser.error(f"Data file not found: {args.data}")

    with open(args.data) as f:
        test_data = json.load(f)

    logger.info("Loaded %d samples from %s", len(test_data), args.data)
    results = evaluate_benchmark(test_data, n_bootstrap=args.n_bootstrap)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)
    logger.info("Results written to %s", args.output)


if __name__ == "__main__":
    main()
