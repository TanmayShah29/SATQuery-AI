"""Paths, JSONL I/O and the test-set freeze check shared by the router-ft scripts."""

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[2]
# ROUTER_FT_DATA / ROUTER_FT_RESULTS point the tools at a scratch copy (used to test them).
DATA = Path(os.environ.get("ROUTER_FT_DATA", ROOT / "data" / "router_ft"))
TEST = DATA / "test.jsonl"
TEST_FREEZE = DATA / "test.sha256"
TEST_RELABEL = DATA / "test_relabel.jsonl"
PROBES = DATA / "probes.jsonl"
GUIDE_EXAMPLES = DATA / "guideline_examples.jsonl"
GENERATED = DATA / "generated"
REVIEWED = DATA / "reviewed.jsonl"
ACTIVITY = DATA / "activity.jsonl"  # one timestamp per test query written / labelled, for time tracking
TRAIN = DATA / "train.jsonl"
VAL = DATA / "val.jsonl"
RESULTS = Path(os.environ.get("ROUTER_FT_RESULTS", ROOT / "results" / "router_ft"))
AUTO = DATA / "auto"  # intermediate files of the automatic pipeline (auto_dataset.py)
PIPELINE_STATUS = RESULTS / "pipeline_status.json"

# UI modality -> hints, exactly as routes_query.py / query_service.py derive them.
HINT_CONFIGS = {
    "cross_modal": {"has_bitemporal_pair": False, "has_sar_pair": True},
    "bitemporal": {"has_bitemporal_pair": True, "has_sar_pair": False},
    "single_image": {"has_bitemporal_pair": False, "has_sar_pair": False},
    "both": {"has_bitemporal_pair": True, "has_sar_pair": True},
}

SLICES = ("clean", "paraphrase", "negation", "typo_hinglish", "compound", "hint_driven", "keyword_trap")


def hint_config_name(hints: Dict[str, bool]) -> str:
    for name, cfg in HINT_CONFIGS.items():
        if cfg == hints:
            return name
    raise ValueError(f"unknown hints {hints}")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    """Atomic rewrite, so a crash mid-save never truncates a hand-labelled file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def append_jsonl(path: Path, row: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def log_activity(task: str, row_id: str) -> None:
    from datetime import datetime, timezone
    append_jsonl(ACTIVITY, {"task": task, "id": row_id,
                            "at": datetime.now(timezone.utc).isoformat(timespec="seconds")})


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_is_frozen() -> bool:
    """True only if test.jsonl exists and matches the hash recorded at freeze time."""
    if not (TEST.exists() and TEST_FREEZE.exists()):
        return False
    recorded = json.loads(TEST_FREEZE.read_text())["sha256"]
    return recorded == sha256(TEST)


def require_frozen_test(action: str) -> None:
    if not test_is_frozen():
        raise SystemExit(
            f"Refusing to {action}: the test set is not frozen (or test.jsonl changed after freezing).\n"
            "Write and label the test set first, then run: uv run python test_writer.py freeze"
        )
