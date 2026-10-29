"""Evaluation harness: run a router over a split, score it, and write the baseline report.

  uv run python eval.py run --name regex --router regex
  uv run python eval.py run --name qwen1.5b-0shot --router mlx --model mlx-community/Qwen2.5-1.5B-Instruct-4bit
  uv run python eval.py run --name qwen3b-12shot --router ollama --model qwen2.5:3b --shots 12
  uv run python eval.py report

`run` is resumable (rows already in predictions.jsonl are skipped). It evaluates the frozen test
set (hash checked first) and the 20 probes. `report` scores every run and writes
docs/router-ft/BASELINES.md plus results/router_ft/eval/<name>/<split>/metrics.json.

Scoring: a decision is exact when all five fields match (list fields as sets). Invalid output
counts as wrong on every field. Confidence intervals: percentile bootstrap over rows (2,000
resamples, seed 0); router-vs-regex differences use a paired bootstrap and an exact McNemar test.
"""

import argparse
import json
import statistics
import time
from collections import Counter, defaultdict

import numpy as np
from scipy.stats import binomtest
from sklearn.metrics import f1_score

import schema
from common import DATA, PROBES, RESULTS, ROOT, SLICES, TEST, TEST_FREEZE, append_jsonl, hint_config_name, read_jsonl, \
    require_frozen_test

EVAL = RESULTS / "eval"
DOC = ROOT / "docs" / "router-ft" / "BASELINES.md"
FIELDS = schema.LABEL_KEYS
SET_FIELDS = ("secondary_intents", "entities")
SPLITS = {"test": TEST, "probes": PROBES, "val": DATA / "sft" / "valid_rows.jsonl"}  # val = val + its hint copies
N_BOOT, SEED = 2000, 0


# ------------------------------------------------------------------ running
def make_router(args):
    if args.router == "regex":
        from routers.regex_router import route

        def run(query, hints):
            t0 = time.perf_counter()
            pred = schema.canonicalize(route(query, hints))
            return pred, {"latency_ms": round((time.perf_counter() - t0) * 1000, 2)}
        return run, None, {"router": "regex", "model": "AgentRouter (backend/app/agent/router.py)", "shots": 0}
    if args.router == "backend":
        from routers.backend_router import route as backend_route
        return backend_route, None, {"router": "backend", "model": "AgentRouter, ROUTER_BACKEND=llm (fine-tuned 1.5B via "
                                     "mlx_lm.server, regex fallback)", "shots": 0, "prompt": "sft"}
    from routers.llm_router import LLMRouter
    r = LLMRouter(args.router, args.model, shots=args.shots, adapter_path=args.adapter, prompt=args.prompt)
    meta = {"router": args.router, "model": args.model, "shots": len(r.shots),
            "fewshot_ids": [x["id"] for x in r.shots], "prompt": args.prompt, "adapter": args.adapter}
    if args.router == "groq" and args.model.startswith("openai/gpt-oss"):
        meta["reasoning_effort"] = "low"
    if args.batch > 1:
        meta["batch"] = args.batch
    return r.route, r.route_batch, meta


def cmd_run(args):
    require_frozen_test("evaluate on the test set")
    route, route_batch, meta = make_router(args)
    for split in args.splits:
        rows = read_jsonl(SPLITS[split])[: args.limit]
        out_dir = EVAL / args.name / split
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "run.json").write_text(json.dumps({**meta, "split": split, "test_sha256": json.loads(
            TEST_FREEZE.read_text())["sha256"] if split == "test" else None}, indent=2) + "\n")
        pred_path = out_dir / "predictions.jsonl"
        done = {r["id"] for r in read_jsonl(pred_path)}
        todo = [r for r in rows if r["id"] not in done]
        print(f"{args.name}/{split}: {len(done)} done, {len(todo)} to go")
        if args.batch > 1:
            for i in range(0, len(todo), args.batch):
                chunk = todo[i:i + args.batch]
                for row, (pred, info) in zip(chunk, route_batch(chunk)):
                    append_jsonl(pred_path, {"id": row["id"], "pred": pred, **info})
                print(f"  {i + len(chunk)}/{len(todo)}", flush=True)
            continue
        for i, row in enumerate(todo, 1):
            pred, info = route(row["query"], row["hints"])
            append_jsonl(pred_path, {"id": row["id"], "pred": pred, **info})
            if i % 20 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}", flush=True)


def cmd_derive(args):
    """The hint rule applied after the model, as a production router could do in code (see LOG.md)."""
    from prepare_sft import to_bitemporal
    for split_dir in (EVAL / args.src).iterdir():
        gold = {r["id"]: r for r in read_jsonl(SPLITS[split_dir.name])}
        out = EVAL / args.name / split_dir.name
        out.mkdir(parents=True, exist_ok=True)
        meta = json.loads((split_dir / "run.json").read_text())
        (out / "run.json").write_text(json.dumps({**meta, "hint_override": True, "derived_from": args.src}, indent=2) + "\n")
        rows = []
        for p in read_jsonl(split_dir / "predictions.jsonl"):
            if p["pred"] is not None and gold[p["id"]]["hints"]["has_bitemporal_pair"]:
                p = {**p, "pred": to_bitemporal(p["pred"])}
            rows.append(p)
        (out / "predictions.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


# ------------------------------------------------------------------ scoring
def _field_ok(field, gold, pred):
    if pred is None:
        return False
    if field in SET_FIELDS:
        return set(gold[field]) == set(pred[field])
    return gold[field] == pred[field]


def _set_prf(golds, preds):
    tp = fp = fn = 0
    for g, p in zip(golds, preds):
        g, p = set(g), set(p or [])
        tp, fp, fn = tp + len(g & p), fp + len(p - g), fn + len(g - p)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    return {"precision": prec, "recall": rec, "f1": 2 * prec * rec / (prec + rec) if prec + rec else 0.0}


def _raw_intent(p):
    """The intent a reply names even when the whole decision is invalid (for the lenient score)."""
    if p["pred"]:
        return p["pred"]["intent"]
    raw = p.get("raw") or ""
    try:
        return json.loads(raw[raw.find("{"):raw.rfind("}") + 1]).get("intent")
    except (ValueError, AttributeError):
        return None


def _macro_f1(gold_intents, pred_intents):
    return f1_score(gold_intents, pred_intents, labels=list(schema.INTENTS), average="macro", zero_division=0)


def _boot(values_fn, n, rng):
    """Percentile bootstrap CI of a statistic computed on resampled row indices."""
    stats = [values_fn(rng.integers(0, n, n)) for _ in range(N_BOOT)]
    return [float(np.percentile(stats, 2.5)), float(np.percentile(stats, 97.5))]


def joined(split, name):
    gold = {r["id"]: r for r in read_jsonl(SPLITS[split])}
    preds = {r["id"]: r for r in read_jsonl(EVAL / name / split / "predictions.jsonl")}
    if set(preds) != set(gold):
        return None  # incomplete run
    return [(gold[i], preds[i]) for i in gold]


def score(rows):
    n = len(rows)
    gold = [g["label"] for g, _ in rows]
    pred = [p["pred"] for _, p in rows]
    ok = {f: np.array([_field_ok(f, g, p) for g, p in zip(gold, pred)]) for f in FIELDS}
    exact = np.all(np.vstack([ok[f] for f in FIELDS]), axis=0)
    gi = [g["intent"] for g in gold]
    pi = [p["intent"] if p else "invalid" for p in pred]
    rng = np.random.default_rng(SEED)
    lat = [p["latency_ms"] for _, p in rows if p.get("latency_ms") is not None]

    def breakdown(key):
        groups = defaultdict(list)
        for k, (g, _) in enumerate(rows):
            for name in key(g):
                groups[name].append(k)
        return {name: {"n": len(ix), "exact": float(exact[ix].mean()), "intent_acc": float(ok["intent"][ix].mean())}
                for name, ix in sorted(groups.items())}

    return {
        "n": n,
        "valid_rate": sum(p is not None for p in pred) / n,
        "exact": float(exact.mean()),
        "exact_ci": _boot(lambda ix: exact[ix].mean(), n, rng),
        "field_acc": {f: float(ok[f].mean()) for f in FIELDS},
        "intent_acc_ci": _boot(lambda ix: ok["intent"][ix].mean(), n, rng),
        "intent_acc_lenient": sum(g["intent"] == _raw_intent(p) for g, (_, p) in zip(gold, rows)) / n,
        "intent_macro_f1": float(_macro_f1(gi, pi)),
        "intent_macro_f1_ci": _boot(lambda ix: _macro_f1([gi[k] for k in ix], [pi[k] for k in ix]), n, rng),
        "intent_f1": dict(zip(schema.INTENTS, f1_score(gi, pi, labels=list(schema.INTENTS), average=None,
                                                         zero_division=0).round(3).tolist())),
        "intent_confusion": {g: dict(Counter(p for gg, p in zip(gi, pi) if gg == g)) for g in schema.INTENTS},
        "set_fields": {f: _set_prf([g[f] for g in gold], [p[f] if p else None for p in pred]) for f in SET_FIELDS},
        "by_slice": breakdown(lambda g: g.get("slices", [])),
        "by_hints": breakdown(lambda g: [hint_config_name(g["hints"])]),
        "latency_ms": {"p50": statistics.median(lat), "p95": float(np.percentile(lat, 95))} if lat else None,
        "_exact": exact,
    }


def paired(a, b):
    """Difference in exact-match rate b - a with paired bootstrap CI and exact McNemar p."""
    rng = np.random.default_rng(SEED)
    n = len(a)
    diff = float(b.mean() - a.mean())
    ci = _boot(lambda ix: b[ix].mean() - a[ix].mean(), n, rng)
    only_b, only_a = int((b & ~a).sum()), int((a & ~b).sum())
    p = binomtest(only_b, only_b + only_a, 0.5).pvalue if only_a + only_b else 1.0
    return {"diff": diff, "ci": ci, "b_only_right": only_b, "a_only_right": only_a, "mcnemar_p": float(p)}


# ------------------------------------------------------------------ report
def _pct(x):
    return f"{100 * x:.1f}"


def _ci(c):
    return f"[{100 * c[0]:.1f}, {100 * c[1]:.1f}]"


def _label(meta):
    if meta["router"] == "regex":
        return "regex AgentRouter"
    if meta["router"] == "backend":
        return "**deployed**: AgentRouter, ROUTER_BACKEND=llm (fine-tuned 1.5B + regex fallback)"
    extra = f", reasoning {meta['reasoning_effort']}" if meta.get("reasoning_effort") else ""
    extra += f", {meta['batch']} queries/request" if meta.get("batch") else ""
    if meta.get("adapter"):
        return f"**fine-tuned** {meta['model'].split('/')[-1]} + LoRA ({meta['router']}{', hint rule in code' if meta.get('hint_override') else ''})"
    if meta.get("prompt") == "sft":  # fine-tuned model served as one artifact (GGUF / runtime LoRA)
        return f"**fine-tuned** {meta['model']}"
    extra += ", hint rule in code" if meta.get("hint_override") else ""
    return f"{meta['model']} ({meta['router']}, {meta['shots']}-shot{extra})"


def cmd_report(args):
    require_frozen_test("score the test set")
    runs = sorted(p.name for p in EVAL.iterdir() if (p / "test" / "predictions.jsonl").exists())
    scored, metas, skipped = {}, {}, []
    for name in runs:
        rows = joined("test", name)
        if rows is None:
            skipped.append(name)
            continue
        metas[name] = json.loads((EVAL / name / "test" / "run.json").read_text())
        scored[name] = score(rows)
        probe_rows = joined("probes", name) if (EVAL / name / "probes" / "predictions.jsonl").exists() else None
        scored[name]["probes"] = score(probe_rows) if probe_rows else None
        out = {k: v for k, v in scored[name].items() if not k.startswith("_")}
        if out["probes"]:
            out["probes"] = {k: v for k, v in out["probes"].items() if not k.startswith("_")}
        (EVAL / name / "test" / "metrics.json").write_text(json.dumps(out, indent=2) + "\n")
    order = sorted(scored, key=lambda k: (k != "regex", -scored[k]["exact"]))
    n = scored[order[0]]["n"] if order else 0

    L = ["# Baselines on the frozen test set", "",
         f"Generated by `ml/router_ft/eval.py report`. Test set: {n} rows, sha256 "
         f"`{json.loads(TEST_FREEZE.read_text())['sha256'][:12]}…`. **Labels are silver** (two LLMs agreed; no human "
         "check, see DATASET.md), so these are agreement-with-silver-labels numbers, not accuracy against truth.", "",
         "*Exact* = all five fields right. Invalid output counts as wrong on every field. *Intent (lenient)* reads the "
         "intent from any reply that parses as JSON, even if other fields break the schema. Brackets: 95% bootstrap CI.", "",
         "## Main results", "",
         "| Router | valid | exact | intent acc | intent (lenient) | intent macro-F1 | secondary F1 | entities F1 | temporal | cloud | p50 ms |",
         "|---|---|---|---|---|---|---|---|---|---|---|"]
    for k in order:
        s = scored[k]
        L.append(f"| {_label(metas[k])} | {_pct(s['valid_rate'])} | **{_pct(s['exact'])}** {_ci(s['exact_ci'])} | "
                 f"{_pct(s['field_acc']['intent'])} {_ci(s['intent_acc_ci'])} | {_pct(s['intent_acc_lenient'])} | "
                 f"{s['intent_macro_f1']:.3f} "
                 f"[{s['intent_macro_f1_ci'][0]:.3f}, {s['intent_macro_f1_ci'][1]:.3f}] | "
                 f"{s['set_fields']['secondary_intents']['f1']:.3f} | {s['set_fields']['entities']['f1']:.3f} | "
                 f"{_pct(s['field_acc']['temporal'])} | {_pct(s['field_acc']['cloud_piercing_required'])} | "
                 f"{'–' if metas[k].get('batch') else format(s['latency_ms']['p50'], '.0f' if s['latency_ms']['p50'] >= 10 else '.2f')} |")
    L += ["", "Latency: regex runs in-process; MLX, Ollama and llama.cpp run on this 8 GB M1. The Groq reference "
               "is a hosted model called in batches through rate-limit waits, so it has no comparable latency (–).", "",
          "**Reference caveat:** gpt-oss-120b wrote the training data and comes from the same model family as "
          "gpt-oss-20b, one of the two models whose agreement defines the silver test labels. Its score is an upper "
          "reference, not a fair competitor, and may be inflated by shared conventions with the labeller.", ""]

    if "regex" in scored:
        L += ["## Difference from regex (exact match)", "",
              "| Router | Δ exact (pts) | 95% CI | right only here | right only regex | McNemar p |", "|---|---|---|---|---|---|"]
        for k in order[1:]:
            d = paired(scored["regex"]["_exact"], scored[k]["_exact"])
            L.append(f"| {_label(metas[k])} | {100 * d['diff']:+.1f} | {_ci(d['ci'])} | {d['b_only_right']} | "
                     f"{d['a_only_right']} | {d['mcnemar_p']:.3g} |")
        L.append("")

    L += ["## Exact match by slice", "", "| Router | " + " | ".join(
        f"{s} (n={scored[order[0]]['by_slice'].get(s, {}).get('n', 0)})" for s in SLICES) + " |",
          "|---|" + "---|" * len(SLICES)]
    for k in order:
        L.append(f"| {_label(metas[k])} | " + " | ".join(
            _pct(scored[k]["by_slice"][s]["exact"]) if s in scored[k]["by_slice"] else "–" for s in SLICES) + " |")
    hint_names = list(scored[order[0]]["by_hints"]) if order else []
    L += ["", "## Exact match by UI hints", "", "| Router | " + " | ".join(
        f"{h} (n={scored[order[0]]['by_hints'][h]['n']})" for h in hint_names) + " |", "|---|" + "---|" * len(hint_names)]
    for k in order:
        L.append(f"| {_label(metas[k])} | " + " | ".join(_pct(scored[k]["by_hints"][h]["exact"]) for h in hint_names) + " |")
    L += ["", "## Intent F1 per class", "", "| Router | " + " | ".join(schema.INTENTS) + " |",
          "|---|" + "---|" * len(schema.INTENTS)]
    for k in order:
        L.append(f"| {_label(metas[k])} | " + " | ".join(f"{scored[k]['intent_f1'][i]:.2f}" for i in schema.INTENTS) + " |")
    L += ["", "## Probes (20 hand-picked regex failure cases; diagnostic, not a measurement)", "",
          "| Router | exact | intent |", "|---|---|---|"]
    for k in order:
        p = scored[k]["probes"]
        cells = [f"{round(p['exact'] * p['n'])}/{p['n']}", f"{round(p['field_acc']['intent'] * p['n'])}/{p['n']}"] \
            if p else ["TBD", "TBD"]
        L.append(f"| {_label(metas[k])} | {cells[0]} | {cells[1]} |")
    if skipped:
        L += ["", f"Incomplete runs not shown: {', '.join(skipped)} (TBD)."]
    for k in order:
        if metas[k].get("fewshot_ids"):
            L += ["", f"Few-shot examples (all from train): {', '.join(metas[k]['fewshot_ids'])}."]
            break
    DOC.write_text("\n".join(L) + "\n")
    print("\n".join(L))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--name", required=True)
    r.add_argument("--router", required=True, choices=["regex", "mlx", "ollama", "groq", "llamacpp", "backend"])
    r.add_argument("--model")
    r.add_argument("--shots", type=int, default=0, help="0 for zero-shot, anything else for the fixed train few-shot set")
    r.add_argument("--splits", nargs="+", default=["test", "probes"], choices=list(SPLITS))
    r.add_argument("--limit", type=int, default=None)
    r.add_argument("--batch", type=int, default=1, help="queries per request (API reference only; see BASELINES.md)")
    r.add_argument("--adapter", default=None, help="LoRA adapter directory (fine-tuned model)")
    r.add_argument("--prompt", default="rules", choices=["rules", "sft"])
    d = sub.add_parser("derive", help="copy a run, enforcing 'bitemporal pair => bitemporal_change' in code")
    d.add_argument("--src", required=True)
    d.add_argument("--name", required=True)
    sub.add_parser("report")
    args = p.parse_args()
    {"run": cmd_run, "report": cmd_report, "derive": cmd_derive}[args.cmd](args)


if __name__ == "__main__":
    main()
