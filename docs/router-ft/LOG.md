# Router fine-tune: decision log

Dated entries for what was decided and why, including mistakes and dead ends.
Every number here comes from a command that was run; anything not yet run is TBD.

---

## 2026-10-28 · Phase 0: setup

### What the current router actually does (verified by reading the code)

Read `backend/app/agent/router.py`, `ui_action_planner.py`, `config.py` and the
callers (`api/routes_query.py`, `services/query_service.py`,
`agent/evidence_builder.py`). The project brief described the router mostly
correctly. These corrections matter for the Phase 1 schema:

1. **`secondary_intents` is not part of the router's output.** `plan_execution()`
   computes it, but `AgentDispatchPlan` has no field for it. It only appears in
   `rationale` text and DAG details, and it decides whether the grounding DAG
   node is added. It can only ever hold 3 of the 6 intents: `visual_grounding`,
   `scene_captioning`, `crossmodal_fusion`.
2. **The two context hints are asymmetric.** `has_bitemporal_pair` always
   overrides the text. `has_sar_pair` only applies when the query already
   matches a cross-modal pattern, and the next rule gives the same answer
   anyway, so in `classify_intent` it has no effect today. Both hints are
   mostly derived from `req.modality` (`bitemporal` / `cross_modal`).
3. **Intent is classified twice per request.** The route calls
   `classify_intent`. Then `EvidenceBuilder.build_evidence` calls
   `plan_execution`, which classifies again and extracts entities, temporal and
   the cloud flag. They agree only because they receive the same hints. An LLM
   backend needs a single hook point, or we pay for two model calls.
4. **`cloud_piercing_required` is true whenever any cross-modal pattern
   matches**, including "fusion", "smoke", "fog", "haze". Checked:
   "no clouds today, just describe the scene" gives `crossmodal_fusion` with
   cloud piercing set to `True`.
5. **`temporal` is not normalised.** It is one of three free-text forms. The
   "between X and Y" regex is greedy and title-cases its match. Checked:
   "show changes between march and june near the runway please" gives
   `'Between March And June Near The Runway Please'`. Phase 1 must define a
   canonical format.
6. **Bug noticed, out of scope:** `get_execution_plan(intent)` passes
   `context_data={"intent": intent}`, which `classify_intent` never reads, so
   it always returns the `optical_vqa` plan. Not fixed here; the router-ft
   work should not change existing behaviour.

`config.py` loads `backend/.env`, not a root `.env`, so `GROQ_API_KEY` goes in
`backend/.env` (gitignored).

Backend baseline before any change: `pytest` in `backend/` gives
**79 passed** (96 warnings).

### Environment

- Machine: Apple M1, 8 GB unified memory, about 32 GiB free disk at the start.
- A separate uv project in `ml/router_ft/` (its own `.venv`), so training
  dependencies never touch the backend's environment. Python 3.11.4 (system),
  because mlx-lm 0.32.2 requires 3.11 or newer.
- Installed: mlx-lm 0.32.2, scikit-learn, pandas, matplotlib, httpx,
  python-dotenv. `.venv` is 565 MB. mlx reports `Device(gpu, 0)`.
- Checked `mlx_lm.generate --help` before using it. Available subcommands
  include `lora`, `fuse`, `convert`, `evaluate`, `server`. Each one's
  `--help` will be checked again before its phase.
- Downloaded `mlx-community/Qwen2.5-1.5B-Instruct-4bit` (868 MB safetensors)
  into `~/.cache/huggingface`. Ollama 0.35.1 already had `qwen2.5:3b`.
- `.gitignore`: added `ml/router_ft/adapters/`, `fused/`, `models/` and
  `*.gguf`. Data (`data/router_ft/`) and predictions (`results/router_ft/`)
  stay tracked so every metric can be traced to examples.

### Smoke test (`ml/router_ft/smoke_test.py`)

Prompt: classify "did the runway get longer since March?" as change / sar /
optical.

| Model | Output | Wall time |
|---|---|---|
| Qwen2.5-1.5B-Instruct-4bit (MLX, chat template applied) | `'sar'` | 2253 ms |
| qwen2.5:3b (Ollama) | `'change'` | 426 ms |

Both pipelines work. **These are not results:** n=1, and the timings include
model load and warm-up, which differ between the two runtimes (MLX loads
inside the script; Ollama already had the model in memory from an earlier
call that took 5294 ms total, 4373 ms of it loading). Real latency is measured
in Phase 3 with warm-up excluded.

### Plan notes recorded for later phases

- The planned label re-check is **intra-annotator** agreement (one person
  re-labels their own examples). Report it as that, not as inter-annotator
  agreement.
- Few-shot examples for the Llama 3.3 70B baseline must come from train,
  never test. Llama 70B also generates the training data, so its phrasing
  style is built into train; the hand-written test set is the guard against
  that.
- With about 150 test examples, small slices (e.g. Hinglish) will have wide
  confidence intervals. Set a minimum count per slice when planning the
  test set.

---

## 2026-10-28 · Phase 1: spec, guidelines, probes

### Two more findings from reading the code

- **Only `intent` reaches the API response.** `EvidenceBuilder.build_evidence`
  reads `plan.intent` and `plan.modality` and nothing else; it builds its own
  DAG. Entities, temporal, cloud flag and secondary intents are computed by
  `plan_execution()` and discarded. Consequence: intent is the headline metric,
  and the other four fields are "plan quality". The write-up must not claim
  that better entity extraction improves the product today.
- **`has_sar_pair` is true by default.** `QueryRequest.modality` defaults to
  `"cross_modal"` and so does the frontend (`services/api.ts`), and
  `cross_modal` sets `has_sar_pair=True`. Most real traffic carries it.

### Schema decisions (v1.0, pinned in `ml/router_ft/schema.py`)

| Decision | Why |
|---|---|
| `secondary_intents` ⊆ {crossmodal_fusion, visual_grounding, scene_captioning} | Those are the only secondaries `plan_execution()` can consume. |
| Primary precedence: change > fusion > SAR > grounding > captioning > optical | The most data-hungry analysis decides which inputs load. **Differs from the regex**, which puts fusion before change: "what changed under the clouds" is a change question with an obstacle. |
| `cloud_piercing_required` = obstruction stated or implied, independent of intent | The regex ties it to the fusion intent and to any weather word. A fusion request with no obstruction is `false`. Coupling rule: if the flag is true and the primary isn't fusion, fusion must be a secondary. |
| `has_bitemporal_pair` ⇒ intent = bitemporal_change; the text's requests become secondaries | Keeps the existing contract: change mode runs the change pipeline. |
| `has_sar_pair` never changes the label | It is the production default, so treating it as "wants SAR" would route nearly everything to fusion. It has no effect in `classify_intent` today either. |
| Entities = categories *mentioned* as physical features, excluding negated ones | Easier to label consistently than "is it the target?". |
| Temporal: `null` or `"<start> -> <end>"`, endpoints from a closed grammar (named, year, month [year], ISO date, "N Units Ago") | Exact match needs one canonical form. A single time point with no comparison is `null`. |
| New slice tag `keyword_trap` | Routing keywords used in the wrong sense are the regex's most predictable failure and deserve their own breakdown. |

Guideline examples live in `data/router_ft/guideline_examples.jsonl` (39 rows,
all valid under `schema.validate`) and are rendered into GUIDELINES.md by
`render_guidelines.py`.

**Mistake, caught:** the first version of `render_guidelines.py` used a regex
that, with empty marker blocks, matched from one section's BEGIN marker to the
*next* section's END, and silently deleted §5 and §6 of the guidelines. It was
caught because the rendered table count (19) didn't match the example count
(39). Fixed by forbidding a match from crossing a BEGIN marker, plus asserts
that every block is filled and every example appears. Rendering twice now
gives identical output.

### Regex adapter (`ml/router_ft/routers/regex_router.py`)

It calls the real `AgentRouter.plan_execution` and only maps *formatting*:
secondaries are read back from the plan's DAG text (they are not a plan field),
and "Between March And June" becomes "March -> June". A greedy capture like
"Between March And June Near The Runway Please" stays wrong, because that is a
real extraction error. Phase 3 will report the regex's valid-JSON rate as N/A,
since it never produces JSON.

### Probe results (`run_probes.py` → `PROBES.md`)

20 hand-picked probes, gold labels from the guidelines, run through the regex:

- Fully correct (all 5 fields): **7 / 20**
- intent 12/20 · secondary 16/20 · entities 14/20 · temporal 15/20 · cloud 17/20

Failure patterns seen:
- **Paraphrases without a keyword fall to `optical_vqa`**: "did the airstrip get
  longer", "tree cover thinned out", "boats that weren't there in the earlier pass".
- **Any weather word or "cloud" forces fusion + cloud piercing**, even when
  negated ("no clouds today") or non-weather ("cloud bucket").
- **Keyword traps:** "Change the basemap" → change detection; "new construction"
  → change even when the ask is to mark it.
- **Exact-token entity matching:** "paddies", "tree cover", "boats", "fields"
  are missed; "ignore the ships" still adds `maritime`.
- **Temporal extraction misses most forms:** "since March", "past two years",
  "since 2022", "pre-monsoon and post-monsoon".
- What works: queries with the English keyword, even inside Hinglish ("kya
  runway pe kuch change hua"), radar vocabulary, and explicit before/after.

**These are not a measurement.** The probes were picked to expose failures, so
the rates are biased low by design. The hand-written test set is the
measurement.

### Leakage rules added

The guideline examples and the probes are seen by the generator and in prompt
design. They must not be reused or lightly paraphrased in the test set, and the
Phase 2 near-duplicate check will compare test against both.

---

## 2026-10-28 · Phase 2 (part 1): tooling, before the test set exists

### Guidelines accepted without an external review

The project owner delegated decisions to me ("make the best possible decisions").
Guidelines v1.0 are accepted unchanged. **Risk:** no second person checked the
rules before labelling started. The blind re-label (kappa) is now the only check
on whether the rules are learnable, so a low kappa means fix the guidelines
before training.

### The large-model reference changes: Llama 3.3 70B is no longer on Groq

`GET /openai/v1/models` with this key lists `openai/gpt-oss-120b`,
`openai/gpt-oss-20b`, `qwen/qwen3.8-27b` and `allam-2-7b`.
`llama-3.3-70b-versatile` returns `404 model_not_found`. The free tier gives
**1,000 requests/day and 8,000 tokens/minute** per model (from response headers).

- **Reference baseline (Phase 3): `openai/gpt-oss-120b`**, the largest model
  available. It is a reasoning model: with `max_tokens=5` it returned an empty
  string (all tokens went to hidden reasoning). With `reasoning_effort="low"`
  it answered correctly. The effort setting will be reported with its results.
- **Generator: both `gpt-oss-120b` and `qwen3.8-27b`**, half the calls each.
  Two generators give more varied phrasing, and the per-generator acceptance
  rate becomes a reportable comparison. Overlap with the reference baseline
  is acceptable because the test set is hand-written, and the labels are
  human-reviewed against the guidelines rather than copied from the generator.

### Rule kept despite the delegation

The test set is still written by the project owner, by hand, before generation.
That is the core of the project's honesty claim, so "make the decisions"
doesn't extend to writing the measurement. `generate.py` and `build_splits.py`
call `require_frozen_test`, which checks `test.jsonl` against the sha256
recorded by `test_writer.py freeze`; they refuse to run otherwise.

### Tools written (`ml/router_ft/`)

| Script | Does |
|---|---|
| `test_writer.py` | `add` queries, `label` them later, `stats` against TEST_SET_PLAN.md, `freeze` (sha256), blind `relabel` of a fixed random 50 (seed 2026), blocked for 3 days after freezing. Never shows model or regex output. |
| `generate.py` | 106 planned calls × 10 queries over slice × intent × UI-mode cells, proportional intent allocation, randomised persona/region/register. Prompt = compact rules + 6 guideline examples. Saves proposals with their validation result; resumable; paced for 8k TPM. |
| `review.py` | a/e/r/s/u/q over a fixed shuffled order, generator hidden. `stats` gives accept/edit/reject per generator, which fields edits changed, and reject reasons. |
| `build_splits.py` | Exact dedup, char 3–5-gram TF-IDF near-dup removal vs test/probes/guideline examples (≥ 0.85, with a sensitivity table from 0.70 to 0.95) and within the pool (≥ 0.90), stratified 100-row val. |
| `agreement.py` | Cohen's kappa for intent, raw agreement per field, the list of disagreements. |

First version of the plan drew intents at random per cell and came out lopsided
(31 change calls vs 10 SAR). Replaced with largest-remainder allocation.

**Tested end to end on scratch data** (`ROUTER_FT_DATA` override, Groq call
mocked, keystrokes piped): the duplicate check, the temporal grammar re-prompt,
the cloud/fusion coupling redo, the freeze lock, the generator's refusal
before freezing, resumption, invalid-proposal flagging, the review undo and
the invalid-accept guard, the 3-day relabel block, and kappa (0.5 on a toy
case, checked by hand). A planted near-copy of a test query in the generated
pool was removed by `build_splits.py` at similarity 1.0. No real data was
generated.

**Known edge:** with a tiny pool, the stratified split can put every row in val
(seen in the toy test). It is harmless at the planned pool size of about 700,
and `split_report.json` reports the actual counts.
