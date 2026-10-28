"""Write, label, freeze and re-label the hand-written test set.

Run from ml/router_ft:
  uv run python test_writer.py add       # write queries (no labels yet)
  uv run python test_writer.py label     # label every unlabelled row
  uv run python test_writer.py stats     # progress against TEST_SET_PLAN.md
  uv run python test_writer.py freeze    # lock the file; unlocks the generator
  uv run python test_writer.py relabel   # >= 3 days after freezing: blind re-label of 50

No model or regex output is ever shown here, by design.
"""

import argparse
import json
import random
import sys
from collections import Counter
from datetime import datetime, timezone

import schema
from common import (HINT_CONFIGS, TEST, log_activity, TEST_FREEZE, TEST_RELABEL, hint_config_name,
                    read_jsonl, sha256, test_is_frozen, write_jsonl)
from labeling import ask_label, ask_slices, show_label

RELABEL_N = 50
RELABEL_SEED = 2026
MIN_DAYS_BEFORE_RELABEL = 3

TARGET_INTENTS = {"optical_vqa": 40, "bitemporal_change": 30, "crossmodal_fusion": 25,
                  "visual_grounding": 25, "sar_vqa": 20, "scene_captioning": 20}
TARGET_SLICES = {"clean": 30, "paraphrase": 30, "negation": 20, "typo_hinglish": 25,
                 "compound": 25, "hint_driven": 20, "keyword_trap": 20}
TARGET_HINTS = {"cross_modal": 110, "bitemporal": 25, "single_image": 20, "both": 5}


def _refuse_if_frozen():
    if TEST_FREEZE.exists():
        sys.exit("The test set is frozen. It is never edited after freezing; log corrections in LOG.md instead.")


def _ask_hints():
    names = list(HINT_CONFIGS)
    menu = "  ".join(f"{i}={n}" for i, n in enumerate(names, 1))
    while True:
        raw = input(f"UI mode [enter=cross_modal]\n  {menu}\n> ").strip()
        if not raw:
            return dict(HINT_CONFIGS["cross_modal"])
        if raw.isdigit() and 1 <= int(raw) <= len(names):
            return dict(HINT_CONFIGS[names[int(raw) - 1]])
        print("  ! type one number")


def cmd_add(_):
    _refuse_if_frozen()
    rows = read_jsonl(TEST)
    print(f"{len(rows)} rows so far. Empty query to stop.\n")
    while True:
        query = input(f"[test-{len(rows) + 1:04d}] query> ").strip()
        if not query:
            break
        if any(r["query"].strip().lower() == query.lower() for r in rows):
            print("  ! you already wrote exactly this query")
            continue
        hints = _ask_hints()
        slices = ask_slices()
        notes = input("notes (optional)> ").strip()
        rows.append({"id": f"test-{len(rows) + 1:04d}", "query": query, "hints": hints,
                     "label": None, "slices": slices, "notes": notes})
        write_jsonl(TEST, rows)
        log_activity("write", rows[-1]["id"])
        print("  saved.\n")
    print(f"{len(rows)} rows in {TEST.name}.")


def cmd_label(_):
    _refuse_if_frozen()
    rows = read_jsonl(TEST)
    todo = [r for r in rows if r["label"] is None]
    print(f"{len(todo)} unlabelled of {len(rows)}. Ctrl-C to stop; progress is saved after each row.\n")
    for i, r in enumerate(todo, 1):
        print(f"--- [{i}/{len(todo)}] {r['id']}  ({hint_config_name(r['hints'])})  slices: {', '.join(r['slices'])}")
        print(f"    {r['query']}\n")
        r["label"] = ask_label()
        print(show_label(r["label"]))
        if input("slices ok? [enter=yes, e=edit]> ").strip().lower() == "e":
            r["slices"] = ask_slices(r["slices"])
        extra = input("notes (optional; 'unsure: ...' if unsure)> ").strip()
        if extra:
            r["notes"] = (r["notes"] + " | " if r["notes"] else "") + extra
        write_jsonl(TEST, rows)
        log_activity("label", r["id"])
        print("  saved.\n")


def _stats(rows):
    labelled = [r for r in rows if r["label"]]
    lines = [f"rows: {len(rows)}   labelled: {len(labelled)}   unlabelled: {len(rows) - len(labelled)}", ""]

    def table(title, counts, targets):
        lines.append(title)
        for k, target in targets.items():
            n = counts.get(k, 0)
            lines.append(f"  {k:<20} {n:>4} / {target:<4} {'ok' if n >= target else ''}")
        lines.append("")

    table("primary intent (labelled rows)", Counter(r["label"]["intent"] for r in labelled), TARGET_INTENTS)
    table("slices (min)", Counter(s for r in rows for s in r["slices"]), TARGET_SLICES)
    table("UI mode (approx.)", Counter(hint_config_name(r["hints"]) for r in rows), TARGET_HINTS)
    temporal = sum(1 for r in labelled if r["label"]["temporal"])
    cloud = [r for r in labelled if r["label"]["cloud_piercing_required"]]
    cloud_nonfusion = sum(1 for r in cloud if r["label"]["intent"] != "crossmodal_fusion")
    secondary = sum(1 for r in labelled if r["label"]["secondary_intents"])
    no_ent = sum(1 for r in labelled if not r["label"]["entities"])
    ents = Counter(e for r in labelled for e in r["label"]["entities"])
    lines += ["field coverage",
              f"  temporal not null    {temporal:>4} / 35",
              f"  cloud true           {len(cloud):>4} / 20   (non-fusion primary {cloud_nonfusion} / 8)",
              f"  secondary non-empty  {secondary:>4} / 25",
              f"  no entities          {no_ent:>4} / 20",
              "  entities (each >= 10): " + ", ".join(f"{e}={ents.get(e, 0)}" for e in schema.ENTITIES)]
    return "\n".join(lines)


def cmd_stats(_):
    print(_stats(read_jsonl(TEST)))


def cmd_freeze(_):
    _refuse_if_frozen()
    rows = read_jsonl(TEST)
    problems = [r["id"] for r in rows if r["label"] is None or not schema.validate(r["label"])[0]
                or not schema.validate_hints(r["hints"]) or not r["slices"]]
    if not rows or problems:
        sys.exit(f"Cannot freeze: unlabelled or invalid rows: {problems or 'file is empty'}")
    print(_stats(rows))
    if len(rows) < 150:
        print(f"\n  ! only {len(rows)} rows; the plan is at least 150.")
    if input("\nFreezing is permanent. Type 'freeze' to confirm> ").strip() != "freeze":
        sys.exit("Not frozen.")
    TEST_FREEZE.write_text(json.dumps({
        "sha256": sha256(TEST), "rows": len(rows),
        "frozen_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, indent=2) + "\n")
    print(f"Frozen: {len(rows)} rows, sha256 recorded in {TEST_FREEZE.name}. Commit both files now.")


def cmd_relabel(args):
    if not test_is_frozen():
        sys.exit("Freeze the test set first.")
    frozen_at = datetime.fromisoformat(json.loads(TEST_FREEZE.read_text())["frozen_at"])
    days = (datetime.now(timezone.utc) - frozen_at).total_seconds() / 86400
    if days < MIN_DAYS_BEFORE_RELABEL and not args.force:
        sys.exit(f"Only {days:.1f} days since freezing; wait {MIN_DAYS_BEFORE_RELABEL} so you don't remember "
                 "your labels (or pass --force and say so in LOG.md).")
    rows = read_jsonl(TEST)
    sample = sorted(random.Random(RELABEL_SEED).sample(range(len(rows)), min(RELABEL_N, len(rows))))
    done = {r["id"] for r in read_jsonl(TEST_RELABEL)}
    todo = [rows[i] for i in sample if rows[i]["id"] not in done]
    print(f"Blind re-label: {len(todo)} of {len(sample)} left. Earlier labels are not shown.\n")
    out = read_jsonl(TEST_RELABEL)
    for i, r in enumerate(todo, 1):
        print(f"--- [{i}/{len(todo)}] {r['id']}  ({hint_config_name(r['hints'])})")
        print(f"    {r['query']}\n")
        out.append({"id": r["id"], "label": ask_label(),
                    "relabelled_at": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        write_jsonl(TEST_RELABEL, out)
        print("  saved.\n")
    print("Done. Run: uv run python agreement.py")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("add", "label", "stats", "freeze"):
        sub.add_parser(name)
    rl = sub.add_parser("relabel")
    rl.add_argument("--force", action="store_true")
    args = p.parse_args()
    {"add": cmd_add, "label": cmd_label, "stats": cmd_stats, "freeze": cmd_freeze, "relabel": cmd_relabel}[args.cmd](args)


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Everything entered so far is saved.")
