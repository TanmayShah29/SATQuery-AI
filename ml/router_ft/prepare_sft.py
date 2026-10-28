"""Build the fine-tuning data (chat format for mlx_lm.lora) from train.jsonl and val.jsonl.

Prompt: a one-line system message plus the same user turn the LLM baselines get (hints + query).
No rules and no examples: the fine-tuned model has to learn the mapping, which also keeps
prefill short (the prompted baselines spend most of their latency on a ~1.7K-token prompt).

Hint augmentation. Phase 3 showed prompted LLMs ignore "bitemporal pair => bitemporal_change",
and train has only 23 bitemporal-mode rows. GUIDELINES §6 makes that rule mechanical:
  intent -> bitemporal_change; the text's own request (old primary and secondaries, if they are
  crossmodal_fusion / visual_grounding / scene_captioning) -> secondary_intents;
  entities, temporal and cloud unchanged (hints never create a temporal value).
So a training row can be copied with has_bitemporal_pair=true and its label derived by that
rule. Copies come from train (and val, for val) only; every derived label passes schema.validate.

Run from ml/router_ft:  uv run python prepare_sft.py
"""

import json
import random
from collections import Counter

import schema
from common import DATA, TRAIN, VAL, hint_config_name, read_jsonl, write_jsonl
from routers.llm_router import _user_turn

SFT = DATA / "sft"
SYSTEM = "You route queries for a satellite-imagery assistant. Reply with only the JSON routing decision."
AUG_SEED = 13
AUG_FRACTION = 0.2  # bitemporal copies, as a share of the split's original rows
AUG_BOTH_SHARE = 0.25  # of those, has_sar_pair=true too ("both"; has_bitemporal_pair wins)


def to_bitemporal(label):
    text_asks = [label["intent"]] + label["secondary_intents"]
    secondaries = [i for i in schema.SECONDARY_INTENTS if i in text_asks]
    return schema.canonicalize({**label, "intent": "bitemporal_change", "secondary_intents": secondaries})


def augment(rows, rng):
    pool = [r for r in rows if not r["hints"]["has_bitemporal_pair"]]
    picked = rng.sample(pool, round(AUG_FRACTION * len(rows)))
    out = []
    for k, r in enumerate(picked):
        hints = {"has_bitemporal_pair": True, "has_sar_pair": k < AUG_BOTH_SHARE * len(picked)}
        label = to_bitemporal(r["label"])
        ok, errors = schema.validate(label)
        assert ok, (r["id"], errors)
        out.append({**r, "id": r["id"] + "-bt", "hints": hints, "label": label, "slices": ["hint_aug"],
                    "augmented_from": r["id"]})
    return out


def chat(row):
    return {"messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": _user_turn(row["query"], row["hints"])},
                         {"role": "assistant", "content": json.dumps(row["label"])}]}


def main():
    rng = random.Random(AUG_SEED)
    report = {}
    for name, path in (("train", TRAIN), ("valid", VAL)):
        rows = read_jsonl(path)
        assert all(not r["id"].startswith("test-") for r in rows)
        aug = augment(rows, rng)
        allrows = rows + aug
        rng.shuffle(allrows)
        write_jsonl(SFT / f"{name}.jsonl", [chat(r) for r in allrows])
        write_jsonl(SFT / f"{name}_rows.jsonl", allrows)  # same rows with ids, for evaluation
        report[name] = {"original": len(rows), "augmented": len(aug), "total": len(allrows),
                        "hints": dict(Counter(hint_config_name(r["hints"]) for r in allrows)),
                        "intent": dict(Counter(r["label"]["intent"] for r in allrows))}
    (SFT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
