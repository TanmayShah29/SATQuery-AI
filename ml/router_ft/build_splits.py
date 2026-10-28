"""Leakage removal and train/val split for the reviewed training pool.

Steps (all counts go into results/router_ft/split_report.json):
  1. take accepted + edited reviews;
  2. drop exact duplicates after normalisation (lower case, no punctuation, single spaces);
  3. drop near-duplicates of any test / probe / guideline-example query
     (character 3-5-gram TF-IDF cosine >= THRESHOLD);
  4. drop near-duplicates within the pool (keep the first);
  5. stratified split by intent into train and VAL_SIZE validation rows.

Reading test.jsonl here only removes training rows that resemble it; nothing from the
test set is copied anywhere. Run from ml/router_ft:  uv run python build_splits.py
"""

import json
import random
import re
import unicodedata
from collections import Counter, defaultdict

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import schema
from common import (GUIDE_EXAMPLES, PROBES, RESULTS, REVIEWED, TEST, TRAIN, VAL, read_jsonl,
                    require_frozen_test, write_jsonl)

THRESHOLD = 0.85
POOL_THRESHOLD = 0.90
SENSITIVITY = (0.70, 0.80, 0.85, 0.90, 0.95)
VAL_SIZE = 100
SPLIT_SEED = 13


def normalise(q: str) -> str:
    q = unicodedata.normalize("NFKC", q).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", q)).strip()


def main():
    require_frozen_test("build splits")
    reviewed = [r for r in read_jsonl(REVIEWED) if r["decision"] in ("accept", "edit")]
    pool = [{"id": r["id"].replace("gen-", "train-", 1), "query": r["query_final"], "hints": r["hints"],
             "label": r["label"], "slices": r["slices"], "source": r["model"], "review": r["decision"],
             "notes": ""} for r in reviewed]
    for r in pool:
        assert schema.validate(r["label"])[0] and schema.validate_hints(r["hints"]), r["id"]
    report = {"reviewed_kept": len(pool)}

    # 2. exact duplicates within the pool
    seen, unique = set(), []
    for r in pool:
        key = (normalise(r["query"]), json.dumps(r["hints"], sort_keys=True))
        if key not in seen:
            seen.add(key)
            unique.append(r)
    report["removed_exact_dup_in_pool"] = len(pool) - len(unique)
    pool = unique

    # 3. near-duplicates against held-out / reference queries
    refs = {"test": read_jsonl(TEST), "probes": read_jsonl(PROBES), "guideline_examples": read_jsonl(GUIDE_EXAMPLES)}
    ref_texts = [normalise(r["query"]) for rows in refs.values() for r in rows]
    ref_src = [name for name, rows in refs.items() for _ in rows]
    pool_texts = [normalise(r["query"]) for r in pool]
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5)).fit(pool_texts + ref_texts)
    sim = cosine_similarity(vec.transform(pool_texts), vec.transform(ref_texts))
    best = sim.max(axis=1)
    best_src = [ref_src[j] for j in sim.argmax(axis=1)]
    report["near_dup_vs_refs_sensitivity"] = {
        f"{t:.2f}": dict(Counter(s for b, s in zip(best, best_src) if b >= t)) for t in SENSITIVITY}
    drop = {i for i, b in enumerate(best) if b >= THRESHOLD}
    report["removed_near_dup_vs_refs"] = dict(Counter(best_src[i] for i in drop))
    report["removed_near_dup_vs_refs_examples"] = [
        {"train": pool[i]["query"], "ref_source": best_src[i], "similarity": round(float(best[i]), 3)}
        for i in sorted(drop, key=lambda i: -best[i])[:15]]
    pool = [r for i, r in enumerate(pool) if i not in drop]

    # 4. near-duplicates within the pool (greedy, keep the earliest)
    texts = [normalise(r["query"]) for r in pool]
    inner = cosine_similarity(vec.transform(texts)) if texts else []
    keep = []
    for i in range(len(pool)):
        if all(inner[i][j] < POOL_THRESHOLD for j in keep):
            keep.append(i)
    report["removed_near_dup_in_pool"] = len(pool) - len(keep)
    pool = [pool[i] for i in keep]

    # 5. stratified split
    rng = random.Random(SPLIT_SEED)
    by_intent = defaultdict(list)
    for r in pool:
        by_intent[r["label"]["intent"]].append(r)
    val_size = min(VAL_SIZE, len(pool) // 7)  # never let a small pool end up mostly in val
    val = []
    for intent, rows in sorted(by_intent.items()):
        rng.shuffle(rows)
        val += rows[: round(val_size * len(rows) / len(pool))]
    val_ids = {r["id"] for r in val}
    train = [r for r in pool if r["id"] not in val_ids]
    rng.shuffle(train)
    write_jsonl(TRAIN, train)
    write_jsonl(VAL, val)

    for name, rows in (("train", train), ("val", val)):
        report[name] = {"rows": len(rows),
                        "intent": dict(Counter(r["label"]["intent"] for r in rows)),
                        "slices": dict(Counter(s for r in rows for s in r["slices"])),
                        "source": dict(Counter(r["source"] for r in rows))}
    report["thresholds"] = {"vs_refs": THRESHOLD, "in_pool": POOL_THRESHOLD, "vectoriser": "char_wb 3-5 TF-IDF cosine"}
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "split_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "removed_near_dup_vs_refs_examples"}, indent=2))


if __name__ == "__main__":
    main()
