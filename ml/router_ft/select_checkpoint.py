"""Pick the LoRA checkpoint with the best exact match on val (val + its hint copies). Never looks at test.

Run from ml/router_ft:  uv run python select_checkpoint.py adapters/qwen1.5b-r8
Writes results/router_ft/train/<run>_selection.json and copies the winner to <adapter dir>-best/.
"""

import json
import shutil
import sys
from pathlib import Path

import eval as ev
from common import RESULTS, read_jsonl
from routers.llm_router import LLMRouter

MODEL = "mlx-community/Qwen2.5-1.5B-Instruct-4bit"


def main():
    run_dir = Path(sys.argv[1])
    rows = read_jsonl(ev.SPLITS["val"])
    ckpts = sorted(run_dir.glob("[0-9]*_adapters.safetensors"))
    results = {}
    for ck in ckpts:
        tmp = run_dir.parent / f"{run_dir.name}-tmp"
        tmp.mkdir(exist_ok=True)
        shutil.copy(run_dir / "adapter_config.json", tmp / "adapter_config.json")
        shutil.copy(ck, tmp / "adapters.safetensors")
        router = LLMRouter("mlx", MODEL, adapter_path=str(tmp), prompt="sft")
        preds = [{"id": r["id"], "pred": router.route(r["query"], r["hints"])[0], "latency_ms": None} for r in rows]
        s = ev.score([(r, p) for r, p in zip(rows, preds)])
        step = int(ck.name.split("_")[0])
        results[step] = {"exact": s["exact"], "intent_acc": s["field_acc"]["intent"], "valid": s["valid_rate"],
                         "exact_bitemporal_hints": s["by_hints"].get("bitemporal", {}).get("exact")}
        print(step, results[step], flush=True)
        del router
        shutil.rmtree(tmp)
    best = max(results, key=lambda k: (results[k]["exact"], -k))  # ties -> earlier checkpoint
    best_dir = run_dir.parent / f"{run_dir.name}-best"
    best_dir.mkdir(exist_ok=True)
    shutil.copy(run_dir / "adapter_config.json", best_dir / "adapter_config.json")
    shutil.copy(run_dir / f"{best:07d}_adapters.safetensors", best_dir / "adapters.safetensors")
    out = {"selected_iter": best, "by_iter": results, "criterion": "val exact match (val + hint copies), ties to earlier"}
    (RESULTS / "train" / f"{run_dir.name}_selection.json").write_text(json.dumps(out, indent=2) + "\n")
    print("selected", best)


if __name__ == "__main__":
    main()
