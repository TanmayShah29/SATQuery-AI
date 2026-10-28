"""Agreement between the two training checkers on the candidates both labelled.

gpt-oss-20b (Groq) checked the first ~467 training candidates before Groq's daily token cap stalled
the run; Nemotron Ultra (OpenRouter) then re-checked all of them. Only Nemotron's checks decide
what is kept. This measures how much the choice of checker matters.

Run from ml/router_ft:  uv run python compare_checkers.py
"""

import json

from sklearn.metrics import cohen_kappa_score

from common import AUTO, GENERATED, RESULTS, read_jsonl

OLD = AUTO / "train_checks_gpt-oss-20b.jsonl"
NEW = AUTO / "train_checks_nemotron-3-ultra-550b-a55b.jsonl"
FIELDS = ("intent", "secondary_intents", "entities", "temporal", "cloud_piercing_required")


def main():
    proposals = {r["id"]: r["proposed_label"] for p in GENERATED.glob("*.jsonl") for r in read_jsonl(p)
                 if r.get("query") and r["proposal_valid"]}
    old = {r["id"]: r["label"] for r in read_jsonl(OLD) if r.get("label")}
    new = {r["id"]: r["label"] for r in read_jsonl(NEW) if r.get("label")}
    both = sorted(set(old) & set(new) & set(proposals))
    keep_old = {i for i in both if old[i] == proposals[i]}
    keep_new = {i for i in both if new[i] == proposals[i]}
    report = {
        "candidates_checked_by_both": len(both),
        "labels_identical": sum(old[i] == new[i] for i in both),
        "per_field_agreement": {f: round(sum(old[i][f] == new[i][f] for i in both) / len(both), 3) for f in FIELDS},
        "intent_kappa": round(cohen_kappa_score([old[i]["intent"] for i in both], [new[i]["intent"] for i in both]), 3),
        "kept_by_gpt-oss-20b": len(keep_old),
        "kept_by_nemotron": len(keep_new),
        "kept_by_both": len(keep_old & keep_new),
        "keep_decision_agreement": round(sum((i in keep_old) == (i in keep_new) for i in both) / len(both), 3),
    }
    (RESULTS / "checker_agreement.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
