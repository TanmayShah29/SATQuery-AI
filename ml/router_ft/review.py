"""Human review of generated candidates: accept / edit / reject, one at a time.

Run from ml/router_ft:
  uv run python review.py          # review (resumable; Ctrl-C any time)
  uv run python review.py stats    # acceptance rates, overall and per generator

Items come in a fixed shuffled order with the generator model hidden, so per-model
acceptance rates are not biased by knowing who wrote what.
Keys:  a=accept  e=edit  r=reject  s=skip for now  u=undo last  q=quit
"""

import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

import schema
from common import GENERATED, REVIEWED, append_jsonl, hint_config_name, read_jsonl, write_jsonl
from labeling import ask_label, ask_slices, show_label

ORDER_SEED = 11
REJECT_REASONS = {"1": "unrealistic", "2": "near-duplicate", "3": "unanswerable/unclear",
                  "4": "off-task", "5": "other"}


def load_candidates():
    rows = [r for path in sorted(GENERATED.glob("*.jsonl")) for r in read_jsonl(path) if not r.get("empty")]
    random.Random(ORDER_SEED).shuffle(rows)
    return rows


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def review():
    cands = load_candidates()
    decided = {d["id"] for d in read_jsonl(REVIEWED)}
    todo = [c for c in cands if c["id"] not in decided]
    print(f"{len(todo)} to review of {len(cands)} candidates.\n")
    history = []
    i = 0
    while i < len(todo):
        c = todo[i]
        slice_name = c["cell"]["slice"]
        print(f"--- [{len(decided) + 1}/{len(cands)}]  UI mode: {hint_config_name(c['hints'])}   intended slice: {slice_name}")
        print(f"    {c['query']}\n")
        if c["proposal_valid"]:
            print(show_label(c["proposed_label"]))
        else:
            print(f"  proposal INVALID: {'; '.join(c['proposal_errors'])}\n  raw: {c['proposed_label']}")
        key = input("\n[a]ccept [e]dit [r]eject [s]kip [u]ndo [q]uit > ").strip().lower()
        record = {"id": c["id"], "model": c["model"], "query": c["query"], "hints": c["hints"],
                  "proposed_label": c["proposed_label"], "proposal_valid": c["proposal_valid"],
                  "reviewed_at": _now()}
        if key == "q":
            break
        if key == "s":
            i += 1
            continue
        if key == "u":
            if not history:
                print("  nothing to undo")
                continue
            last = history.pop()
            write_jsonl(REVIEWED, [d for d in read_jsonl(REVIEWED) if d["id"] != last])
            decided.discard(last)
            i = next(k for k, t in enumerate(todo) if t["id"] == last)
            print("  undone\n")
            continue
        if key == "a":
            if not c["proposal_valid"]:
                print("  ! an invalid proposal can't be accepted as-is; edit or reject it")
                continue
            record.update(decision="accept", query_final=c["query"], label=c["proposed_label"],
                          slices=[slice_name])
        elif key == "e":
            new_q = input(f"query [enter=keep]> ").strip()
            label = ask_label(c["proposed_label"] if c["proposal_valid"] else None)
            slices = ask_slices([slice_name])
            record.update(decision="edit", query_final=new_q or c["query"], label=label, slices=slices,
                          query_edited=bool(new_q), label_edited=label != c["proposed_label"])
        elif key == "r":
            reason = input("reason: " + "  ".join(f"{k}={v}" for k, v in REJECT_REASONS.items()) + "> ").strip()
            record.update(decision="reject", reject_reason=REJECT_REASONS.get(reason, "other"))
        else:
            print("  ! a, e, r, s, u or q")
            continue
        append_jsonl(REVIEWED, record)
        decided.add(c["id"])
        history.append(c["id"])
        print(f"  {record['decision']}ed\n")
        i += 1
    print_stats()


def print_stats():
    rows = read_jsonl(REVIEWED)
    if not rows:
        print("nothing reviewed yet")
        return
    by_model = defaultdict(Counter)
    for r in rows:
        by_model["ALL"][r["decision"]] += 1
        by_model[r["model"]][r["decision"]] += 1
    print("\nacceptance (accept = kept unchanged; kept = accept + edit)")
    for model, c in sorted(by_model.items()):
        n = sum(c.values())
        print(f"  {model:<22} n={n:<5} accept {c['accept'] / n:6.1%}   edit {c['edit'] / n:6.1%}   "
              f"reject {c['reject'] / n:6.1%}   kept {(c['accept'] + c['edit']) / n:6.1%}")
    edits = [r for r in rows if r["decision"] == "edit" and r["proposal_valid"]]
    if edits:
        fields = Counter(f for r in edits for f in schema.LABEL_KEYS if r["label"][f] != r["proposed_label"][f])
        print("  fields changed in edits: " + ", ".join(f"{f}={n}" for f, n in fields.most_common()))
    reasons = Counter(r.get("reject_reason") for r in rows if r["decision"] == "reject")
    if reasons:
        print("  reject reasons: " + ", ".join(f"{k}={v}" for k, v in reasons.most_common()))


if __name__ == "__main__":
    try:
        print_stats() if sys.argv[1:] == ["stats"] else review()
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Decisions so far are saved.")
