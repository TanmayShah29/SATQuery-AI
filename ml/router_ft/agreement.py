"""Intra-annotator agreement: the original test labels vs the blind re-label of 50.

Cohen's kappa for intent (agreement corrected for chance), plus raw agreement per field.
Writes results/router_ft/agreement.json. Run from ml/router_ft:  uv run python agreement.py
"""

import json

from sklearn.metrics import cohen_kappa_score

import schema
from common import RESULTS, TEST, TEST_RELABEL, read_jsonl, require_frozen_test


def main():
    require_frozen_test("measure agreement")
    first = {r["id"]: r for r in read_jsonl(TEST)}
    second = read_jsonl(TEST_RELABEL)
    if not second:
        raise SystemExit("No re-labels yet: run test_writer.py relabel")
    pairs = [(first[r["id"]]["label"], r["label"]) for r in second]
    n = len(pairs)

    def same(a, b, f):
        return set(a[f]) == set(b[f]) if isinstance(a[f], list) else a[f] == b[f]

    report = {
        "n": n,
        "intent_cohen_kappa": round(cohen_kappa_score([a["intent"] for a, _ in pairs],
                                                      [b["intent"] for _, b in pairs], labels=list(schema.INTENTS)), 3),
        "raw_agreement": {f: round(sum(same(a, b, f) for a, b in pairs) / n, 3) for f in schema.LABEL_KEYS},
        "all_fields_agree": round(sum(all(same(a, b, f) for f in schema.LABEL_KEYS) for a, b in pairs) / n, 3),
        "intent_disagreements": [{"id": r["id"], "query": first[r["id"]]["query"],
                                  "first": first[r["id"]]["label"]["intent"], "second": r["label"]["intent"]}
                                 for r in second if first[r["id"]]["label"]["intent"] != r["label"]["intent"]],
        "note": "Intra-annotator (one person, two passes), not inter-annotator agreement.",
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "agreement.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
