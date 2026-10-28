"""Generate candidate training queries + proposed labels with Groq, for human review.

Refuses to run until the hand-written test set is frozen. The prompt contains only the
labelling rules and the GUIDELINES.md examples: never the test set, never the probes.

Each call asks one model for BATCH queries in one "cell" (target intent x slice x UI mode),
with a randomised persona / region / register so batches differ. Proposals are saved as-is,
with their schema-validation result; review.py is where a human accepts, edits or rejects.

Run from ml/router_ft (the two models have separate rate limits, so run both at once):
  uv run python generate.py --model openai/gpt-oss-120b
  uv run python generate.py --model qwen/qwen3.8-27b
Resumable: re-running skips call indices already in the output file.
"""

import argparse
import json
import random
import re
import time
from collections import Counter
from datetime import datetime, timezone

import httpx
from dotenv import dotenv_values

import schema
from common import GENERATED, GUIDE_EXAMPLES, HINT_CONFIGS, ROOT, append_jsonl, read_jsonl, require_frozen_test

PROMPT_VERSION = "gen-v1"
MODELS = ("openai/gpt-oss-120b", "qwen/qwen3.8-27b")
BATCH = 10
PLAN_SEED = 7
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"  # used for model ids ending in ":free"
PACE_S = 25  # seconds per call per model on the 8k tokens/min free tier

# Raw targets per slice, before review losses (~1060 candidates for ~700 kept).
SLICE_TARGETS = {"clean": 160, "paraphrase": 200, "negation": 130, "typo_hinglish": 160,
                 "compound": 160, "hint_driven": 120, "keyword_trap": 130}
# Relative primary-intent weights for non-hint slices (same shape as the test plan).
INTENT_WEIGHTS = {"optical_vqa": 4, "bitemporal_change": 3, "crossmodal_fusion": 2.5,
                  "visual_grounding": 2.5, "sar_vqa": 2, "scene_captioning": 2}

SLICE_STYLE = {
    "clean": "Plain, well-formed English that uses the obvious vocabulary for the intent.",
    "paraphrase": "Express the intent WITHOUT its usual keywords (e.g. no 'change', 'describe', 'highlight', 'radar', 'cloud'). Use indirect, natural wording.",
    "negation": "Each query negates or excludes something: negated weather ('no clouds', 'sky is clear'), excluded objects ('not the ships, only...'), or 'nothing to compare, just...'. The label must respect the negation.",
    "typo_hinglish": "Half the queries in Hinglish (Hindi words in Latin script mixed with English, as typed in chat), half in English with realistic typos, missing punctuation and shorthand (pls, u, bldgs).",
    "compound": "Each query asks for two or three outputs at once (e.g. compare + outline, describe + mark, see-through-cloud + locate). Apply the precedence and secondary rules.",
    "hint_driven": "The UI is in bitemporal mode, so the label's intent is bitemporal_change. Write queries whose TEXT alone would suggest a different intent: {text_intent}.",
    "keyword_trap": "Each query contains a routing keyword in the WRONG sense ('change the colour', 'cloud storage', 'point cloud', 'draw conclusions', 'describe your method', 'between us', 'mark as done', 'box score'), while the real request is the target intent.",
}

PERSONAS = ["disaster-response officer", "ISRO imagery analyst", "defence intelligence analyst",
            "state agriculture officer", "geography student", "port authority planner",
            "urban planning consultant", "environmental journalist", "forest department ranger",
            "insurance claims assessor", "civil aviation inspector", "hydrologist"]
REGIONS = ["Sriharikota", "Mumbai port", "Kochi", "the Brahmaputra floodplain", "Bengaluru outskirts",
           "the Rann of Kutch", "Visakhapatnam", "Ladakh", "the Sundarbans", "Chennai", "Delhi NCR",
           "Assam tea estates", "the Western Ghats", "Ahmedabad", "Kolkata docks", "no named place"]
REGISTERS = ["terse commands", "polite full-sentence questions", "chat-style, lower case",
             "detailed multi-clause requests", "a mix of short and long"]

RULES = """You label queries for a satellite-imagery assistant's query router.
Output for each query, exactly this JSON label (no other keys):
{"intent": str, "secondary_intents": [str], "entities": [str], "temporal": str|null, "cloud_piercing_required": bool}

INTENTS (what output the user wants):
- bitemporal_change: compare the same place at two times (change, growth, new vs earlier, more/fewer than before). Needs two times; "new"/"damaged" alone or "than usual" is NOT change.
- crossmodal_fusion: see through cloud/haze/smoke/fog, or an explicit optical+SAR fusion.
- sar_vqa: a question about radar data/properties (backscatter, polarisation, VV/VH, roughness, radar targets).
- visual_grounding: locate specific things on the image (highlight, outline, box, mark, "show me where"). "Show me X" alone is not grounding.
- scene_captioning: describe/summarise the WHOLE scene or a land-cover breakdown. Describing one object's condition is optical_vqa.
- optical_vqa: a specific question about one optical image (count, presence, yes/no, attribute). The default.
A word is not an intent: "change the colours", "draw conclusions", "cloud storage" don't count.

COMPOUND: primary = first match in bitemporal_change > crossmodal_fusion > sar_vqa > visual_grounding > scene_captioning > optical_vqa.
secondary_intents = other requested outputs, ONLY from [crossmodal_fusion, visual_grounding, scene_captioning], never repeating the primary. Other extra requests are dropped.

cloud_piercing_required: true only if the query says/implies the optical view IS blocked by cloud, haze, smoke, fog or monsoon cover. Negated weather or non-weather "cloud" -> false. Fusion with no obstruction -> false. If true and primary != crossmodal_fusion, crossmodal_fusion MUST be in secondary_intents.

HINTS: has_bitemporal_pair=true -> intent is ALWAYS bitemporal_change; what the text asks for becomes secondaries. has_sar_pair NEVER changes the label.

ENTITIES: every category mentioned as a physical feature in the scene (target or landmark), not negated/excluded ones. Order: runway, launchpad, building, maritime, flood, excavation, vegetation.
runway=runway/tarmac/airstrip/taxiway/hangar/apron/airfield/aircraft; launchpad=launch pad/complex/propellant tank/umbilical tower/rocket; building=buildings/facility/structures/campus/houses/villages/construction; maritime=ship/vessel/tanker/boat/port/harbour/jetty/anchorage; flood=flood/inundation and ANY inland water (river, lake, reservoir, canal); excavation=trench/shaft/spoil pile/perimeter fence/earthworks; vegetation=forest/trees/crops/paddy/fields/canopy/clearing. Generic "the area" -> [].

TEMPORAL: null, or "<start> -> <end>" with endpoints from: Pre-Event, Post-Event, Epoch T1, Epoch T2, Now, Monsoon, a year (2024), a full capitalised month optionally with year (March, March 2024), an ISO date (2024-03-15), or relative "1 Day/Week/Month/Year Ago" / "N Days/Weeks/Months/Years Ago".
"since March" -> "March -> Now"; "past two years" -> "2 Years Ago -> Now"; "before and after" -> "Pre-Event -> Post-Event"; "previous image vs this one" -> "Epoch T1 -> Epoch T2"; "pre-monsoon vs post-monsoon" -> "Pre-Event -> Post-Event". A single time point with no comparison -> null. No stated time -> null. Hints never create a temporal value."""


def _client_headers(env_key="GROQ_API_KEY"):
    key = (dotenv_values(ROOT / "backend" / ".env").get(env_key) or "").strip()
    if not key:
        raise SystemExit(f"{env_key} not found in backend/.env")
    return {"Authorization": f"Bearer {key}"}


def build_plan(slice_targets=SLICE_TARGETS, intent_weights=INTENT_WEIGHTS, seed=PLAN_SEED,
               personas=PERSONAS, regions=REGIONS, batch=BATCH):
    """Deterministic list of cells (one per API call). The defaults are the training plan."""
    rng = random.Random(seed)
    intents = list(intent_weights)
    text_intents = [i for i in intents if i != "bitemporal_change"]
    cells = []
    for slice_name, target in slice_targets.items():
        n = max(1, round(target / batch))
        if slice_name == "hint_driven":
            cells += [{"slice": slice_name, "intent": "bitemporal_change", "mode": "bitemporal",
                       "text_intent": text_intents[k % len(text_intents)]} for k in range(n)]
        else:
            cells += [{"slice": slice_name} for _ in range(n)]

    # Proportional (largest-remainder) intent allocation over the non-hint cells, then shuffled,
    # so the intent mix follows INTENT_WEIGHTS instead of the luck of random draws.
    open_cells = [c for c in cells if "intent" not in c]
    total = sum(intent_weights.values())
    quotas = {i: len(open_cells) * w / total for i, w in intent_weights.items()}
    counts = {i: int(q) for i, q in quotas.items()}
    for i in sorted(quotas, key=lambda i: quotas[i] - counts[i], reverse=True)[: len(open_cells) - sum(counts.values())]:
        counts[i] += 1
    pool = [i for i, k in counts.items() for _ in range(k)]
    rng.shuffle(pool)
    for c, intent in zip(open_cells, pool):
        c["intent"] = intent
        c["mode"] = "single_image" if rng.random() < 0.15 else "cross_modal"
    rng.shuffle(cells)
    for i, c in enumerate(cells):
        c["call"] = i
        c["persona"] = rng.choice(personas)
        c["region"] = rng.choice(regions)
        c["register"] = rng.choice(REGISTERS)
    return cells


def _examples_for(cell, guide_rows, rng):
    same = [r for r in guide_rows if r["label"]["intent"] == cell["intent"] or cell["slice"] in r["slices"]]
    pick = rng.sample(same, min(4, len(same))) + rng.sample(guide_rows, 2)
    seen, out = set(), []
    for r in pick:
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append({"query": r["query"], "hints": r["hints"], "label": r["label"]})
    return out


def build_messages(cell, guide_rows):
    rng = random.Random(1000 + cell["call"])
    hints = HINT_CONFIGS[cell["mode"]]
    style = SLICE_STYLE[cell["slice"]].format(text_intent=cell.get("text_intent", ""))
    examples = "\n".join(json.dumps(e, ensure_ascii=False) for e in _examples_for(cell, guide_rows, rng))
    user = (
        f"Write {BATCH} NEW, varied user queries.\n"
        f"- Hints for every query: {json.dumps(hints)}\n"
        f"- Correct primary intent for every query: {cell['intent']}\n"
        f"- Style: {style}\n"
        f"- Written by a {cell['persona']}; place context: {cell['region']}; register: {cell['register']}.\n"
        f"- Vary length (3 to 30 words), sentence shape and entity categories. Do not copy the examples.\n"
        f"- Label each query by the rules (a query may legitimately need a different intent than asked "
        f"if you could not avoid it; label it truthfully).\n\n"
        f"Labelled examples of the format:\n{examples}\n\n"
        'Return only JSON: {"items": [{"query": "...", "label": {...}}, ...]}'
    )
    return [{"role": "system", "content": RULES}, {"role": "user", "content": user}]


WAIT_LOG = None  # callable(model, wait_s, msg) for rate-limit waits; auto_dataset points it at the dashboard


def call_groq(model, messages, headers, max_retries=6, temperature=0.9, max_tokens=4000):
    """One chat completion. Groq by default; OpenRouter free models (ids ending in ":free") go there."""
    body = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens,
            "response_format": {"type": "json_object"}}
    url = GROQ_URL
    if model.endswith(":free"):
        url, headers = OPENROUTER_URL, _client_headers("OPENROUTER_API_KEY")
        body.pop("response_format")  # not every free model accepts it; parse_items copes with plain JSON
        body["reasoning"] = {"enabled": False}  # otherwise reasoning models spend max_tokens before answering
    elif model.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"
    attempt = 0
    while attempt < max_retries:
        r = httpx.post(url, headers=headers, json=body, timeout=300)
        if r.status_code != 429:
            attempt += 1  # rate-limit waits don't use up retries: the daily token cap can mean many of them
        if r.status_code == 429 or r.status_code >= 500:
            wait = float(r.headers.get("retry-after", 2 ** attempt * 5))
            if r.status_code == 429 and "retry-after" not in r.headers:
                reset = r.headers.get("x-ratelimit-reset")  # OpenRouter: epoch ms when the limit resets
                wait = max(60.0, float(reset) / 1000 - time.time() + 5) if reset else 60.0
            try:
                why = r.json()["error"]["message"].split(". Please")[0]
            except Exception:
                why = r.text[:160]
            resume = time.strftime("%H:%M", time.localtime(time.time() + wait))
            msg = f"{model} {r.status_code}: waiting {f'{wait / 60:.0f} min' if wait >= 90 else f'{wait:.0f}s'}, resumes ~{resume} ({why})"
            WAIT_LOG(model, wait, msg) if WAIT_LOG else print(msg)
            time.sleep(wait)
            continue
        r.raise_for_status()
        d = r.json()
        if "choices" not in d:  # OpenRouter can return an upstream provider error inside a 200
            msg = f"{model} provider error: {str(d.get('error', d))[:200]}; retrying in 30s"
            WAIT_LOG(model, 30, msg) if WAIT_LOG else print(msg)
            time.sleep(30)
            continue
        return d["choices"][0]["message"]["content"], d.get("usage", {})
    raise RuntimeError("too many retries")


def parse_items(text, key):
    """Models don't always honour the requested wrapper: accept {key: [...]}, a bare list, or
    any single list value, and turn bare strings into {"query": ...}. Text around the JSON (e.g. a code fence) is ignored."""
    starts = [i for i in (text.find("{"), text.find("[")) if i >= 0]
    obj = json.loads(text[min(starts):max(text.rfind("}"), text.rfind("]")) + 1] if starts else text)
    if isinstance(obj, dict):
        obj = obj.get(key, next((v for v in obj.values() if isinstance(v, list)), []))
    if not isinstance(obj, list):
        return []
    return [{"query": x} if isinstance(x, str) else x for x in obj if isinstance(x, (dict, str))]


def _norm(q):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", q.lower())).strip()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", required=True, choices=MODELS)
    p.add_argument("--max-calls", type=int, default=None, help="stop after this many calls (for a trial run)")
    p.add_argument("--dry-run", action="store_true", help="print the first prompt and exit; no API call")
    args = p.parse_args()

    guide_rows = read_jsonl(GUIDE_EXAMPLES)
    plan = [c for c in build_plan() if MODELS[c["call"] % len(MODELS)] == args.model]
    if args.dry_run:
        for m in build_messages(plan[0], guide_rows):
            print(f"--- {m['role']} ---\n{m['content']}\n")
        print(f"{len(plan)} calls planned for {args.model}")
        return

    require_frozen_test("generate training data")
    out = GENERATED / f"{args.model.split('/')[-1]}.jsonl"
    done_calls = {r["call"] for r in read_jsonl(out)}
    todo = [c for c in plan if c["call"] not in done_calls][: args.max_calls]
    print(f"{args.model}: {len(todo)} calls to make ({len(done_calls)} already done)")
    print(dict(generate_cells(args.model, todo, out, guide_rows, _client_headers())))


def generate_cells(model, cells, out, guide_rows, headers, log=print, on_call=None):
    """Make one API call per cell, append proposals to `out`. Resumable at call granularity."""
    seen = {_norm(r["query"]) for path in GENERATED.glob("*.jsonl") for r in read_jsonl(path)}
    stats = Counter()
    for n, cell in enumerate(cells, 1):
        t0 = time.perf_counter()
        try:
            text, usage = call_groq(model, build_messages(cell, guide_rows), headers)
            items = parse_items(text, "items")
        except (json.JSONDecodeError, AttributeError, RuntimeError, httpx.HTTPError) as exc:
            log(f"  call {cell['call']}: failed ({exc}); will retry on next run")
            stats["failed_calls"] += 1
            continue
        kept = 0
        for k, it in enumerate(items if isinstance(items, list) else []):
            q = str(it.get("query", "")).strip() if isinstance(it, dict) else ""
            if not q or _norm(q) in seen:
                stats["dropped_empty_or_exact_dup"] += 1
                continue
            seen.add(_norm(q))
            ok, errors = schema.validate(it.get("label"))
            append_jsonl(out, {
                "id": f"gen-{model.split('/')[-1]}-{cell['call']:03d}-{k:02d}",
                "call": cell["call"], "model": model, "prompt_version": PROMPT_VERSION,
                "cell": {k2: cell[k2] for k2 in ("slice", "intent", "mode", "persona", "region", "register")
                         if k2 in cell} | ({"text_intent": cell["text_intent"]} if "text_intent" in cell else {}),
                "query": q, "hints": HINT_CONFIGS[cell["mode"]],
                "proposed_label": schema.canonicalize(it["label"]) if ok else it.get("label"),
                "proposal_valid": ok, "proposal_errors": errors,
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })
            kept += 1
            stats["valid" if ok else "invalid_label"] += 1
        if kept == 0:
            # Keep a marker so a call that returned nothing usable is not retried forever.
            append_jsonl(out, {"call": cell["call"], "model": model, "empty": True, "query": ""})
        log(f"  [{n}/{len(cells)}] call {cell['call']} {cell['slice']}/{cell['intent']}/{cell['mode']}: "
            f"{kept} kept, {usage.get('total_tokens', '?')} tok, {time.perf_counter() - t0:.1f}s")
        if on_call:
            on_call()
        time.sleep(max(0.0, PACE_S - (time.perf_counter() - t0)))  # ~2-3 calls/min stays under 8k TPM
    return stats


if __name__ == "__main__":
    main()
