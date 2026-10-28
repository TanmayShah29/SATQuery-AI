"""Fully automatic Phase 2: build the test set, training pool and splits with no human steps.

The project owner chose automation over hand-writing and hand-reviewing. To keep the
evaluation as honest as possible without a human:

  * TEST queries are written by TEST_GEN_MODEL with its own personas/regions and no
    examples, so they don't share the training data's prompt or phrasing.
  * Each test query is labelled independently and blind by two TEST_LABELLERS; only rows
    where both produce the identical label are kept ("silver" labels). Their agreement
    (Cohen's kappa on intent, raw agreement per field) is reported.
  * The large reference baseline (openai/gpt-oss-120b) never labels the test set.
  * TRAINING candidates come from TRAIN_GEN_MODEL; a second model (TRAIN_CHECKER)
    re-labels each one blind, and a candidate is kept only if both labels match.
  * build_splits.py then removes near-duplicates of test/probe/guideline queries.

Every stage is resumable; progress goes to results/router_ft/pipeline_status.json.
Run from ml/router_ft:  uv run python auto_dataset.py   (or press Start in ui.py)
"""

import json
import os
import signal
import math
import random
import threading
import time
import traceback
from collections import Counter
from datetime import datetime, timezone

import httpx
from sklearn.metrics import cohen_kappa_score

import build_splits
import generate
import schema
from common import (AUTO, GENERATED, GUIDE_EXAMPLES, HINT_CONFIGS, PIPELINE_STATUS, PROBES, RESULTS, REVIEWED,
                    TEST, TEST_FREEZE, append_jsonl, read_jsonl, sha256, test_is_frozen, write_jsonl)

TEST_GEN_MODEL = "qwen/qwen3.8-27b"
TEST_LABELLERS = ("qwen/qwen3.8-27b", "openai/gpt-oss-20b")
TRAIN_GEN_MODEL = "openai/gpt-oss-120b"
# Was openai/gpt-oss-20b on Groq until its 200K tokens/day cap stalled the run (LOG.md, 2026-10-28). OpenRouter
# free models are capped by requests (50/day), not tokens, so the checker uses bigger batches. Chosen by a trial
# on 30 already-checked candidates: 30/30 valid labels; Gemma's free endpoints were rate-limited upstream.
TRAIN_CHECKER = "nvidia/nemotron-3-ultra-550b-a55b:free"
LABEL_BATCH = 10
CHECK_BATCH = 30
MIN_TEST_ROWS = 150
MAX_TEST_ROUNDS = 3  # extra rounds of test candidates if too few labels agree
PROMPT_VERSION = "auto-v1"

# ~300 candidates, so ~150+ survive the two-labeller agreement filter. Same shape as TEST_SET_PLAN.md.
TEST_SLICE_TARGETS = {"clean": 50, "paraphrase": 55, "negation": 35, "typo_hinglish": 45,
                      "compound": 45, "hint_driven": 35, "keyword_trap": 35}
TEST_INTENT_WEIGHTS = {"optical_vqa": 40, "bitemporal_change": 30, "crossmodal_fusion": 25,
                       "visual_grounding": 25, "sar_vqa": 20, "scene_captioning": 20}
# Disjoint from the training generator's lists, so test and train don't share personas or places.
TEST_PERSONAS = ["NDMA duty officer", "coast guard watch officer", "remote-sensing PhD student",
                 "district GIS assistant", "news fact-checker", "mining regulator inspector",
                 "railway infrastructure planner", "wildlife NGO field coordinator", "municipal engineer",
                 "crop insurance surveyor", "airport operations manager", "glaciologist"]
TEST_REGIONS = ["the Odisha coast", "Kaziranga", "Hyderabad", "Pune", "Goa", "the Andaman islands", "Jaipur",
                "Lucknow", "Mangaluru port", "Uttarakhand", "Nagpur", "Bhuj", "Thoothukudi", "no named place"]

TEST_CANDIDATES = AUTO / "test_candidates.jsonl"
TRAIN_CHECKS = AUTO / f"train_checks_{TRAIN_CHECKER.split('/')[-1].removesuffix(':free')}.jsonl"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _slug(model):
    return model.split("/")[-1]


# ------------------------------------------------------------------ status file
class Status:
    STAGES = [
        ("test_generate", "Write test queries", f"{TEST_GEN_MODEL}"),
        ("test_label", "Label test queries twice", " + ".join(TEST_LABELLERS)),
        ("test_freeze", "Keep agreed labels, freeze test set", "local"),
        ("train_generate", "Generate training candidates", TRAIN_GEN_MODEL),
        ("train_check", "Check training labels", TRAIN_CHECKER),
        ("splits", "Leakage check + train/val split", "local"),
    ]

    def __init__(self):
        self.lock = threading.RLock()  # re-entrant: the Stop handler may log while the main thread holds it
        prev = json.loads(PIPELINE_STATUS.read_text()) if PIPELINE_STATUS.exists() else {}
        old = {s["key"]: s for s in prev.get("stages", [])}
        self.data = {"started": _now(), "finished": None, "state": "running", "error": None, "log": prev.get("log", [])[-40:],
                     "stages": [old.get(k) or {"key": k, "title": t, "by": by, "status": "pending", "done": 0,
                                               "target": None, "started": None, "ended": None, "samples": []}
                                for k, t, by in self.STAGES]}
        for s, (k, t, by) in zip(self.data["stages"], self.STAGES):
            if s["by"] != by:  # model changed (e.g. a new checker): this stage starts over
                s.update(by=by, status="pending", done=0, target=None, started=None, ended=None, samples=[])
            s["title"] = t
            if s["status"] == "running":
                s["status"] = "pending"  # interrupted last time; it resumes
        self.save()

    def stage(self, key):
        return next(s for s in self.data["stages"] if s["key"] == key)

    def update(self, key, **kw):
        with self.lock:
            s = self.stage(key)
            if kw.get("status") == "pending":
                s["started"] = s["ended"] = None  # waiting again (e.g. another test round): restart its clock
            if kw.get("status") == "running" and not s["started"]:
                s["started"] = _now()
            if kw.get("status") in ("done", "failed"):
                s["ended"] = _now()
            s.update(kw)
            if "done" in kw:
                s["samples"].append([_now(), kw["done"]])
                s["samples"] = s["samples"][-400:]
            self.save()

    def log(self, msg):
        print(msg, flush=True)
        with self.lock:
            self.data["log"] = (self.data["log"] + [f"{time.strftime('%H:%M:%S')} {msg}"])[-40:]
            self.save()

    def save(self):
        PIPELINE_STATUS.parent.mkdir(parents=True, exist_ok=True)
        tmp = PIPELINE_STATUS.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=1, ensure_ascii=False))
        tmp.replace(PIPELINE_STATUS)


# ------------------------------------------------------------------ prompts
def _test_gen_messages(cell):
    hints = HINT_CONFIGS[cell["mode"]]
    style = generate.SLICE_STYLE[cell["slice"]].format(text_intent=cell.get("text_intent", ""))
    user = (
        f"Write {generate.BATCH} NEW, realistic queries that a {cell['persona']} might type into a satellite-imagery "
        f"assistant. Place context: {cell['region']}. Register: {cell['register']}.\n"
        f"- The UI hints for every query are {json.dumps(hints)}.\n"
        f"- Under the rules above, each query's correct primary intent should be {cell['intent']}.\n"
        f"- Style: {style}\n"
        "- Vary length (3 to 30 words), sentence shape and which features are mentioned. Make them sound like real "
        "people, not textbook examples.\n\n"
        'Return only JSON: {"items": [{"query": "..."}, ...]}  (queries only, no labels)'
    )
    return [{"role": "system", "content": generate.RULES}, {"role": "user", "content": user}]


_FIXED_EXAMPLE_IDS = ("guide-002", "guide-010", "guide-014", "guide-019", "guide-031", "guide-035")


def _label_messages(items):
    guide = {r["id"]: r for r in read_jsonl(GUIDE_EXAMPLES)}
    examples = "\n".join(json.dumps({"query": guide[i]["query"], "hints": guide[i]["hints"], "label": guide[i]["label"]},
                                    ensure_ascii=False) for i in _FIXED_EXAMPLE_IDS if i in guide)
    batch = "\n".join(json.dumps({"i": k, "query": it["query"], "hints": it["hints"]}, ensure_ascii=False)
                      for k, it in enumerate(items))
    user = (f"Label each query below by the rules. Labelled examples:\n{examples}\n\nQueries:\n{batch}\n\n"
            'Return only JSON: {"labels": [{"i": 0, "label": {...}}, ...]} with one entry per query, same i.')
    return [{"role": "system", "content": generate.RULES}, {"role": "user", "content": user}]


def label_batch(model, items, headers):
    """Blind labels for a batch; returns [(label|None, errors)] aligned with items."""
    text, _ = generate.call_groq(model, _label_messages(items), headers, temperature=0, max_tokens=8000)
    got = {}
    for e in generate.parse_items(text, "labels"):
        if isinstance(e, dict) and isinstance(e.get("i"), int):
            got[e["i"]] = e.get("label")
    out = []
    for k in range(len(items)):
        ok, errors = schema.validate(got.get(k))
        out.append((schema.canonicalize(got[k]) if ok else None, errors))
    return out


# ------------------------------------------------------------------ stages
def stage_test_generate(st, headers, rnd):
    cells = generate.build_plan(TEST_SLICE_TARGETS, TEST_INTENT_WEIGHTS, seed=101 + rnd,
                                personas=TEST_PERSONAS, regions=TEST_REGIONS)
    for c in cells:
        c["call"] += 1000 * rnd  # call ids stay unique across rounds
    rows = read_jsonl(TEST_CANDIDATES)
    done_calls = {r["call"] for r in rows}
    refs = {generate._norm(r["query"]) for path in (GUIDE_EXAMPLES, PROBES) for r in read_jsonl(path)}
    seen = refs | {generate._norm(r["query"]) for r in rows if r.get("query")}
    st.update("test_generate", status="running", target=(rnd + 1) * len(cells) * generate.BATCH,
              done=sum(1 for r in rows if r.get("query")))
    failed = 0
    for cell in [c for c in cells if c["call"] not in done_calls]:
        t0 = time.perf_counter()
        items = None
        for attempt in range(3):
            try:
                text, _ = generate.call_groq(TEST_GEN_MODEL, _test_gen_messages(cell), headers)
                items = generate.parse_items(text, "items")
                break
            except (json.JSONDecodeError, AttributeError, RuntimeError, httpx.HTTPError) as exc:
                st.log(f"test_generate call {cell['call']} attempt {attempt + 1} failed ({exc})")
                time.sleep(5)
        if items is None:
            failed += 1
            continue
        kept = 0
        for k, it in enumerate(items if isinstance(items, list) else []):
            q = str(it.get("query", "")).strip() if isinstance(it, dict) else ""
            if not q or generate._norm(q) in seen:
                continue
            seen.add(generate._norm(q))
            append_jsonl(TEST_CANDIDATES, {"id": f"cand-{cell['call']:03d}-{k:02d}", "call": cell["call"], "query": q,
                                           "hints": HINT_CONFIGS[cell["mode"]], "slice": cell["slice"],
                                           "intended_intent": cell["intent"], "model": TEST_GEN_MODEL,
                                           "prompt_version": PROMPT_VERSION, "generated_at": _now()})
            kept += 1
        if kept == 0:
            append_jsonl(TEST_CANDIDATES, {"call": cell["call"], "empty": True})
        n = sum(1 for r in read_jsonl(TEST_CANDIDATES) if r.get("query"))
        st.update("test_generate", done=n)
        st.log(f"test_generate call {cell['call']}: {kept} queries ({n} total)")
        time.sleep(max(0.0, generate.PACE_S - (time.perf_counter() - t0)))
    if failed:
        raise RuntimeError(f"{failed} test-generation calls failed 3 times; press Start again to resume")
    st.update("test_generate", status="done", target=sum(1 for r in read_jsonl(TEST_CANDIDATES) if r.get("query")))


def _label_all(st, model, cands, headers, counter):
    out = AUTO / f"test_labels_{_slug(model)}.jsonl"
    done = {r["id"] for r in read_jsonl(out)}
    todo = [c for c in cands if c["id"] not in done]
    for i in range(0, len(todo), LABEL_BATCH):
        batch = todo[i:i + LABEL_BATCH]
        t0 = time.perf_counter()
        labels = None
        for attempt in range(3):
            try:
                labels = label_batch(model, batch, headers)
                break
            except (json.JSONDecodeError, AttributeError, RuntimeError, httpx.HTTPError) as exc:
                st.log(f"test_label {_slug(model)} attempt {attempt + 1} failed ({exc})")
                time.sleep(5)
        if labels is None:
            continue
        for c, (label, errors) in zip(batch, labels):
            append_jsonl(out, {"id": c["id"], "model": model, "label": label, "valid": label is not None,
                               "errors": errors, "labelled_at": _now()})
        with counter["lock"]:
            counter["n"] += len(batch)
            st.update("test_label", done=counter["n"])
        time.sleep(max(0.0, generate.PACE_S - (time.perf_counter() - t0)))


def stage_test_label(st, headers):
    cands = [r for r in read_jsonl(TEST_CANDIDATES) if r.get("query")]
    already = sum(len(read_jsonl(AUTO / f"test_labels_{_slug(m)}.jsonl")) for m in TEST_LABELLERS)
    counter = {"n": already, "lock": threading.Lock()}
    st.update("test_label", status="running", target=len(cands) * len(TEST_LABELLERS), done=already)
    threads = [threading.Thread(target=_label_all, args=(st, m, cands, headers, counter)) for m in TEST_LABELLERS]
    [t.start() for t in threads]
    [t.join() for t in threads]
    missing = len(cands) * len(TEST_LABELLERS) - counter["n"]
    if missing:
        raise RuntimeError(f"{missing} test labels still missing after retries; press Start again to resume")
    st.update("test_label", status="done")


def stage_test_freeze(st, last_round):
    """Freeze the agreed rows. Returns False (without freezing) if too few agree and more rounds remain."""
    st.update("test_freeze", status="running")
    cands = [r for r in read_jsonl(TEST_CANDIDATES) if r.get("query")]
    labels = {m: {r["id"]: r for r in read_jsonl(AUTO / f"test_labels_{_slug(m)}.jsonl")} for m in TEST_LABELLERS}
    a, b = TEST_LABELLERS
    both_valid = [c for c in cands if labels[a][c["id"]]["valid"] and labels[b][c["id"]]["valid"]]
    same = lambda c, f: labels[a][c["id"]]["label"][f] == labels[b][c["id"]]["label"][f]
    agreement = {
        "labellers": list(TEST_LABELLERS), "candidates": len(cands), "both_valid": len(both_valid),
        "intent_cohen_kappa": round(cohen_kappa_score([labels[a][c["id"]]["label"]["intent"] for c in both_valid],
                                                      [labels[b][c["id"]]["label"]["intent"] for c in both_valid],
                                                      labels=list(schema.INTENTS)), 3) if both_valid else None,
        "raw_agreement": {f: round(sum(same(c, f) for c in both_valid) / max(1, len(both_valid)), 3) for f in schema.LABEL_KEYS},
        "all_fields_agree": sum(all(same(c, f) for f in schema.LABEL_KEYS) for c in both_valid),
        "intended_intent_matches_agreed": None,
        "note": "Inter-model agreement between two LLM labellers (not human). Only all-fields-agree rows enter the test set.",
    }
    if agreement["intent_cohen_kappa"] is not None and math.isnan(agreement["intent_cohen_kappa"]):
        agreement["intent_cohen_kappa"] = None  # undefined when only one intent occurs; NaN isn't valid JSON
    kept = [c for c in both_valid if all(same(c, f) for f in schema.LABEL_KEYS)]
    agreement["intended_intent_matches_agreed"] = round(
        sum(labels[a][c["id"]]["label"]["intent"] == c["intended_intent"] for c in kept) / max(1, len(kept)), 3)
    agreement["kept_by_slice"] = dict(Counter(c["slice"] for c in kept))
    agreement["kept_by_intent"] = dict(Counter(labels[a][c["id"]]["label"]["intent"] for c in kept))
    agreement["dropped_by_slice"] = dict(Counter(c["slice"] for c in cands if c not in kept))
    (RESULTS / "agreement.json").write_text(json.dumps(agreement, indent=2) + "\n")
    st.log(f"test labels: {len(kept)} of {len(cands)} candidates have identical labels from both labellers "
           f"(intent kappa {agreement['intent_cohen_kappa']})")
    st.update("test_freeze", done=len(kept), target=MIN_TEST_ROWS)
    if len(kept) < MIN_TEST_ROWS:
        if not last_round:
            st.log(f"only {len(kept)} agreed rows (< {MIN_TEST_ROWS}); generating another round of candidates")
            st.update("test_freeze", status="pending")
            return False
        raise RuntimeError(f"only {len(kept)} agreed test rows after {MAX_TEST_ROUNDS} rounds; see agreement.json")
    random.Random(5).shuffle(kept)
    rows = [{"id": f"test-{n:04d}", "query": c["query"], "hints": c["hints"], "label": labels[a][c["id"]]["label"],
             "slices": [c["slice"]], "notes": "",
             "provenance": {"source": "auto", "candidate": c["id"], "generator": c["model"],
                            "labels": "identical from " + " and ".join(TEST_LABELLERS)}}
            for n, c in enumerate(kept, 1)]
    write_jsonl(TEST, rows)
    TEST_FREEZE.write_text(json.dumps({"sha256": sha256(TEST), "rows": len(rows), "frozen_at": _now(),
                                       "source": "auto: LLM-written queries, two-LLM agreed labels"}, indent=2) + "\n")
    st.update("test_freeze", status="done", done=len(rows), target=len(rows))
    return True


def _check_loop(st, headers, gen_done):
    """Blind second label for every valid training candidate as it appears; keep only matches."""
    while True:
        checked = {r["id"] for r in read_jsonl(TRAIN_CHECKS)}
        cands = [c for p in GENERATED.glob("*.jsonl") for c in read_jsonl(p) if c.get("query") and c["id"] not in checked]
        for c in [c for c in cands if not c["proposal_valid"]]:
            append_jsonl(TRAIN_CHECKS, {"id": c["id"], "label": None, "checked_at": _now(), "skipped": "invalid proposal"})
        valid = [c for c in cands if c["proposal_valid"]]
        if not valid:
            if gen_done.is_set():
                return
            time.sleep(5)
            continue
        if len(valid) < CHECK_BATCH and not gen_done.is_set():
            time.sleep(5)
            continue
        batch = valid[:CHECK_BATCH]
        t0 = time.perf_counter()
        try:
            labels = label_batch(TRAIN_CHECKER, batch, headers)
        except Exception as exc:  # never let the checker thread die silently; the batch is retried
            st.log(f"train_check batch failed ({type(exc).__name__}: {exc}); retrying")
            time.sleep(10)
            continue
        for c, (label, _) in zip(batch, labels):
            append_jsonl(TRAIN_CHECKS, {"id": c["id"], "label": label, "checked_at": _now()})
        generated = sum(1 for p in GENERATED.glob("*.jsonl") for r in read_jsonl(p) if r.get("query"))
        st.update("train_check", done=len(read_jsonl(TRAIN_CHECKS)), target=generated)
        time.sleep(max(0.0, generate.PACE_S - (time.perf_counter() - t0)))


def stage_train(st, headers):
    guide_rows = read_jsonl(GUIDE_EXAMPLES)
    out = GENERATED / f"{_slug(TRAIN_GEN_MODEL)}.jsonl"
    cells = generate.build_plan()
    done_calls = {r["call"] for r in read_jsonl(out)}
    todo = [c for c in cells if c["call"] not in done_calls]
    count = lambda: sum(1 for p in GENERATED.glob("*.jsonl") for r in read_jsonl(p) if r.get("query"))
    st.update("train_generate", status="running", target=len(cells) * generate.BATCH, done=count())
    st.update("train_check", status="running", done=len(read_jsonl(TRAIN_CHECKS)))
    gen_done = threading.Event()
    checker = threading.Thread(target=_check_loop, args=(st, headers, gen_done))
    checker.start()
    try:
        stats = generate.generate_cells(TRAIN_GEN_MODEL, todo, out, guide_rows, headers, log=st.log,
                                        on_call=lambda: st.update("train_generate", done=count()))
    finally:
        gen_done.set()
        checker.join()
    if stats.get("failed_calls"):
        raise RuntimeError(f"{stats['failed_calls']} training-generation calls failed; press Start again to resume")
    checked = {r["id"] for r in read_jsonl(TRAIN_CHECKS)}
    unchecked = sum(1 for p in GENERATED.glob("*.jsonl") for r in read_jsonl(p) if r.get("query") and r["id"] not in checked)
    if unchecked:
        raise RuntimeError(f"the checker stopped with {unchecked} candidates unchecked; press Start again to resume")
    st.update("train_generate", status="done", target=count(), done=count())

    # Turn the checks into review records (the same shape review.py writes) for build_splits.py.
    checks = {r["id"]: r for r in read_jsonl(TRAIN_CHECKS)}
    records = []
    for c in (c for p in GENERATED.glob("*.jsonl") for c in read_jsonl(p) if c.get("query")):
        chk = checks.get(c["id"])
        if chk is None:
            continue
        agree = c["proposal_valid"] and chk["label"] == c["proposed_label"]
        rec = {"id": c["id"], "model": c["model"], "query": c["query"], "hints": c["hints"],
               "proposed_label": c["proposed_label"], "proposal_valid": c["proposal_valid"],
               "reviewer": f"auto:{TRAIN_CHECKER}", "second_label": chk["label"], "reviewed_at": chk["checked_at"]}
        if agree:
            rec.update(decision="accept", query_final=c["query"], label=c["proposed_label"], slices=[c["cell"]["slice"]])
        else:
            rec.update(decision="reject", reject_reason="invalid proposal" if not c["proposal_valid"] else "checker disagreed")
        records.append(rec)
    write_jsonl(REVIEWED, records)
    c = Counter(r["decision"] for r in records)
    st.update("train_check", status="done", target=len(records), done=len(records))
    st.log(f"training candidates: {c['accept']} kept, {c['reject']} rejected by the checker")


def stage_splits(st):
    st.update("splits", status="running")
    build_splits.main()
    report = json.loads((RESULTS / "split_report.json").read_text())
    st.update("splits", status="done", done=report["train"]["rows"] + report["val"]["rows"],
              target=report["train"]["rows"] + report["val"]["rows"])


def main():
    AUTO.mkdir(parents=True, exist_ok=True)
    GENERATED.mkdir(parents=True, exist_ok=True)
    st = Status()
    def _on_wait(model, wait_s, msg):  # Groq rate limit: show when each model can be called again
        with st.lock:
            st.data.setdefault("waits", {})[model] = datetime.fromtimestamp(time.time() + wait_s, timezone.utc).isoformat(timespec="seconds")
        st.log(msg)

    generate.WAIT_LOG = _on_wait

    def _on_term(*_):  # the dashboard's Stop button
        st.data["state"] = "stopped"
        st.log("stopped by user; Start resumes")
        os._exit(0)

    signal.signal(signal.SIGTERM, _on_term)
    st.log("pipeline started")
    try:
        headers = generate._client_headers()
        if test_is_frozen():
            for k in ("test_generate", "test_label", "test_freeze"):
                if st.stage(k)["status"] != "done":
                    st.update(k, status="done")
        elif TEST.exists() or TEST_FREEZE.exists():
            raise RuntimeError("test.jsonl or test.sha256 exists but is not a valid frozen pair; resolve that by hand")
        else:
            for rnd in range(MAX_TEST_ROUNDS):
                stage_test_generate(st, headers, rnd)
                stage_test_label(st, headers)
                if stage_test_freeze(st, last_round=rnd == MAX_TEST_ROUNDS - 1):
                    break
        if st.stage("train_check")["status"] != "done":
            stage_train(st, headers)
        if st.stage("splits")["status"] != "done":
            stage_splits(st)
        st.data.update(state="done", finished=_now())
        st.log("pipeline finished")
    except BaseException as exc:  # incl. SystemExit from helpers; the UI shows the error
        running = [s for s in st.data["stages"] if s["status"] == "running"]
        for s in running:
            st.update(s["key"], status="failed")
        st.data.update(state="failed", error=f"{type(exc).__name__}: {exc}", finished=_now())
        st.log("FAILED: " + st.data["error"])
        traceback.print_exc()
    st.save()


if __name__ == "__main__":
    main()
