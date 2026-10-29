"""Exact-match chart for RESULTS.md / README, read from the eval metrics (no numbers typed in).

Run from ml/router_ft:  uv run python plot_results.py   ->  docs/router-ft/figures/exact_match.png
"""

import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from common import RESULTS, ROOT  # noqa: E402

OUT = ROOT / "docs" / "router-ft" / "figures" / "exact_match.png"
# (run name, label, role): role picks the colour, so identity is not carried by hue alone (labels say it too)
RUNS = [
    ("gpt-oss-120b-12shot-b10", "gpt-oss-120b, 12-shot (reference*)", "reference"),
    ("served-backend-llm", "Deployed: fine-tuned 1.5B + regex fallback", "ours"),
    ("ft-qwen1.5b-r8", "Fine-tuned Qwen2.5-1.5B (model alone)", "ours"),
    ("qwen3b-ollama-12shot", "Qwen2.5-3B, 12-shot prompt", "baseline"),
    ("ft-qwen3b-lora-q4km", "Fine-tuned 3B, deployable export", "ours_faded"),
    ("regex", "Regex AgentRouter (current)", "baseline"),
    ("qwen1.5b-12shot", "Qwen2.5-1.5B, 12-shot prompt", "baseline"),
]
COLOR = {"ours": "#2a78d6", "ours_faded": "#9dc0ea", "baseline": "#9aa3ad", "reference": "#ffffff"}
INK, MUTED, GRID = "#1f2328", "#59636e", "#e6e8eb"


def main():
    rows = []
    for name, label, role in RUNS:
        m = json.loads((RESULTS / "eval" / name / "test" / "metrics.json").read_text())
        rows.append((label, role, 100 * m["exact"], [100 * x for x in m["exact_ci"]]))
    fig, ax = plt.subplots(figsize=(8.6, 4.2), dpi=200)
    y = list(range(len(rows)))[::-1]
    for yi, (label, role, v, (lo, hi)) in zip(y, rows):
        ax.barh(yi, v, height=0.56, color=COLOR[role], edgecolor="#59636e" if role == "reference" else "none",
                linewidth=1.2, linestyle=(0, (3, 2)) if role == "reference" else "solid", zorder=2)
        ax.plot([lo, hi], [yi, yi], color=INK, linewidth=1.2, zorder=3)
        ax.text(hi + 1.2, yi, f"{v:.1f}%", va="center", fontsize=9, color=INK)
    ax.set_yticks(y, [r[0] for r in rows], fontsize=9, color=INK)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Exact match on 189 silver-labelled test queries (%, all five fields right; line = 95% CI)",
                  fontsize=8.5, color=MUTED)
    ax.xaxis.grid(True, color=GRID, zorder=0)
    ax.tick_params(axis="x", colors=MUTED, labelsize=8)
    ax.tick_params(axis="y", length=0)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    fig.text(0.01, 0.01, "*Reference: wrote the training data and shares a family with one test labeller; an upper "
             "bound, not a competitor.", fontsize=7.5, color=MUTED)
    fig.text(0.01, 0.97, "Query routing: the fine-tuned 1.5B router with regex fallback doubles regex exact match",
             fontsize=11, color=INK, va="top")
    fig.tight_layout(rect=(0, 0.04, 1, 0.93))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, facecolor="white")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
