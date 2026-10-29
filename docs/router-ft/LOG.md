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

---

## 2026-10-28 · Phase 2 (part 2): a local dashboard for the human steps

On request, I added a temporary local web UI, `ml/router_ft/ui.py` + `ui.html`
(standard library only, binds to 127.0.0.1:8765). It is a front end over the
same files and rules as the CLIs; nothing about the dataset rules changed:
schema validation on every label, no edits after freezing, blind review, and
a blind re-label that opens 3 days after freezing.

- **Dashboard:** one card per Phase 2 step, each with a start button (or the
  reason it is locked), a progress bar, and active time, pace and time left.
  Plus a cumulative-progress line chart and a time-per-step bar chart. The
  first version had a sidebar, a theme switcher and table filters; the owner
  asked for "just start buttons and graphs of progress and time", so those
  were removed.
- **Time tracking:** writing and labelling events go to
  `data/router_ft/activity.jsonl` (the UI and `test_writer.py` both log).
  Reviews and re-labels already carry timestamps. Active time = sum of gaps
  between consecutive items, ignoring gaps over 5 minutes (counted as breaks);
  pace = median gap; time left = remaining items × pace. These are estimates
  for planning, not results.
- **Chart colours:** the four series colours were checked with the dataviz
  palette validator against this page's light and dark surfaces. Both pass;
  light mode flags low contrast for two hues, so every line also has a direct
  text label.
- **Bugs found while testing in the browser, fixed:**
  - the review form marked every item as edited on load (validation fired the
    change callback);
  - the dashboard's periodic refresh rebuilt the cards and could swallow a
    click (it now re-renders only when the data changed);
  - the UI mode stayed on whatever was used last, which could silently give
    the next test query the wrong hints (it now resets to the default after
    each save).
- An edit that changes nothing is recorded as an accept, so the acceptance
  rate isn't deflated by no-op edits.

---

## 2026-10-28 · Phase 2 (part 3): switched to a fully automatic dataset pipeline

**Decision (project owner):** no hand-written test set, no manual review, no re-label.
"Just press start and then see." This reverses the Phase 0 rule that the test set is
written by hand. It is the owner's call, and it changes what the results can claim, so
the design below aims to keep as much of the evaluation's independence as possible:

| Concern | How the pipeline handles it |
|---|---|
| Test labels without a human | Two models label each test query **blind and independently** (`qwen3.8-27b`, `gpt-oss-20b`); only rows with identical labels on all five fields are kept. Their agreement (Cohen's kappa on intent, raw per field) is reported. |
| The reference baseline grading itself | `gpt-oss-120b` (the Phase 3 reference) **never labels test data**. It only writes training candidates. |
| Test and train sharing style | Test queries come from `qwen3.8-27b` with no examples and its own persona/region lists; training from `gpt-oss-120b` with guideline examples and different lists. `build_splits.py` still removes near-duplicates. |
| Train labels without review | A second model (`gpt-oss-20b`) re-labels each candidate blind; kept only if identical. |
| Too few agreed test rows | Up to 3 rounds of ~360 candidates until at least 150 agree. |

**What this costs:** the "silver" test set is filtered towards queries two models find
unambiguous, so it is probably easier than real traffic. A shared blind spot of both
labellers can't be detected. The write-up must say "silver labels" wherever it reports a
number, and must not call them human-verified. An optional 30-row human spot-check
would put a number on label accuracy. It isn't scheduled; that's the owner's call.

**Implementation:** `auto_dataset.py` (stages test_generate → test_label → test_freeze
→ train_generate ∥ train_check → splits), resumable at call level, with progress written to
`results/router_ft/pipeline_status.json`. `ui.py`/`ui.html` was rebuilt around it: one
Start/Stop/Resume button, per-stage progress with elapsed time and time left, a
progress-over-time chart and a time-per-stage chart, and a results panel. The manual
tools (`test_writer.py`, `review.py`, `agreement.py`) are unchanged and still work.

**Tested:**
- **Mocked Groq, full run:** a run with too few agreed rows correctly topped up with a
  second round, then froze. Invalid training proposals were rejected, and the
  dashboard showed all stages live through to the results panel.
- **Real API, one call per stage, scratch folder:** all stages completed. On those 10
  test candidates (one cell, all `sar_vqa`): 8 identical labels, and both disagreements
  were on `entities`. The checker rejected 1 of 10 training candidates. This is a smoke
  test, not a result.

**Bugs found and fixed:**
- the real `qwen3.8-27b` sometimes returns a bare JSON list instead of
  `{"items": [...]}`, which the mocks didn't show; parsing now accepts a list, a wrapper
  object, or plain strings;
- a failed call let the pipeline continue into top-up rounds with nothing generated;
  calls now retry 3 times, and a stage with lost calls stops with a resumable error;
- kappa is `NaN` when only one intent occurs, which isn't valid JSON; it's now written as `null`;
- `build_splits.py` put a small pool entirely into val; val is now capped at 1/7 of the pool;
- stage clocks and targets were wrong around top-up rounds and the parallel checker.

## 2026-10-28: Phase 2 part 4. The dataset run, and a checker change

**Run:** test set (≈37 min) and training generation finished on Groq. The training checker
(`gpt-oss-20b`) then hit Groq's free-tier cap of **200K tokens per model per day** after 467
candidates. Groq refills it gradually, so the run continued at about one batch per 15 minutes,
which looked like a hang. Projected finish: about 18 hours.

**Decision: move the training checker to OpenRouter's free tier and re-check *all* training
candidates with it.** OpenRouter free models are capped by requests (50/day), not tokens, so the
checker sends batches of 30 (~36 requests in all). OpenRouter has no free gpt-oss, so the model
changed. A trial on 10–30 candidates gpt-oss-20b had already checked:
- `gemma-4-31b-it:free`, `gemma-4-26b-a4b-it:free`: refused, upstream (Google AI Studio) rate-limited;
- `nemotron-3.5-lightning:free`: spent all 8,000 output tokens on reasoning, no answer;
- `inkling:free`: only available to listed agent apps;
- `nemotron-3.5-super-vl:free`: 9/10 valid, 5/10 matched gpt-oss-20b;
- **`nemotron-3-ultra-550b-a55b:free`, reasoning off: 30/30 valid in 43 s, 21/30 matched gpt-oss-20b. Chosen.**

Re-checking everything, rather than only the remainder, keeps one checker behind every kept
training row. gpt-oss-20b's 467 checks are kept in `data/router_ft/auto/train_checks_gpt-oss-20b.jsonl`
for comparison (`compare_checkers.py` → `results/router_ft/checker_agreement.json`): on 444
candidates both labelled, intent kappa 0.914, and the same keep/reject decision 79.1% of the time.

**Results** (details and sources in DATASET.md):
- test: 189 rows frozen (`bdf44c0f…`), 63% of candidates agreed on all fields, intent kappa 0.889;
- training pool: 657 of 1,060 kept (62%); train 564, val 93; leakage check removed nothing.

**Findings to carry into Phase 3:**
- `hint_driven` test candidates agreed only 35% of the time; 14 rows survive, so that slice's
  numbers will be noisy;
- no training row has an empty entity list, while 20 test rows do; check entity over-prediction.

**Bugs found and fixed:**
- the dashboard never reaped the finished pipeline process, so Stop looked broken (zombie PID);
  `auto_dataset.py` now also handles SIGTERM and records the stop;
- rate-limit waits were invisible; they are now logged with the reason and resume time, the
  dashboard shows a "waiting on the limit" banner, and the time estimate respects the token cap;
- six 429s in a row failed a call; 429 waits no longer use up retries;
- OpenRouter returns some provider errors inside a 200 response; this crashed the checker
  thread silently, and the pipeline still "finished" with 67 candidates checked. Such
  responses are now retried, any checker error is logged and retried, and the training stage
  refuses to finish while any candidate is unchecked.

## 2026-10-28: Phase 3. Eval harness and baselines

**Harness:** `ml/router_ft/eval.py` (`run` is resumable; `report` writes
[BASELINES.md](BASELINES.md) and per-run `metrics.json`). It refuses to run unless the test hash
matches the freeze. Metric: *exact* = all five fields right; invalid output is wrong on every
field. Also per-field accuracy, intent macro-F1, set F1 for secondary intents and entities,
breakdowns by slice and UI hints, 95% percentile-bootstrap CIs (2,000 resamples), and against
regex a paired bootstrap plus an exact McNemar test. "Intent (lenient)" reads the intent from
replies that are JSON but break the schema, to separate "wrong" from "can't follow the format".

**LLM baselines** (`routers/llm_router.py`) all get the same prompt: the labelling rules as
system prompt, plus, for few-shot, 12 fixed examples drawn **from train only** (2 per intent,
seed 3, ids in BASELINES.md) as chat turns. Temperature 0. Ollama gets `format=json` and
`num_ctx=4096` (its 2,048 default would cut the prompt).

**Decision: the gpt-oss-120b reference runs 10 queries per request.** Per-query it needs about
460K tokens, over two days of Groq's 200K/day cap, which today's dataset run had already used.
Batched, it is ~3K tokens per request and finishes overnight. This is how the silver labels were
made too, but it is not identical to per-query routing, and BASELINES.md labels it as batched.
A detached job (`results/router_ft/logs/finish_reference.sh`) regenerates BASELINES.md and
commits it when the run ends.

**Results** (exact match on 189 silver-labelled test rows, 95% CI):

| Router | exact | intent acc | valid |
|---|---|---|---|
| regex AgentRouter | 31.7 [24.9, 38.1] | 61.9 | 100 |
| qwen2.5:3b, Ollama, 12-shot | 47.1 [40.2, 54.0] | 70.4 | 83.1 |
| Qwen2.5-1.5B-4bit, MLX, 12-shot | 16.9 [12.2, 22.8] | 30.7 | 61.9 |
| Qwen2.5-1.5B-4bit, MLX, 0-shot | 2.6 [0.5, 5.3] | 7.9 | 13.8 |
| gpt-oss-120b, Groq, 12-shot, batched | TBD (running) | TBD | TBD |

**Findings for Phase 4:**
- The fine-tuning base (1.5B) is far below regex when prompted. Most of its errors are format
  errors: its lenient intent accuracy is 48–51% even where strict exact match is 3–17%. It
  invents entity names ("water basins") and puts phrases into `secondary_intents`. Fine-tuning
  should mostly have to teach the vocabulary, which is the easy part.
- **Every prompted LLM scores 0% exact in bitemporal mode** (14 rows); regex scores 57%
  because it hard-codes "bitemporal pair → bitemporal_change". The 3B model follows the text
  ("backscatter" → sar_vqa) and ignores the hint rule. Training has only 23 such rows. Phase 4
  should upsample them. Phase 5 could also enforce the rule in code, as regex does; if so,
  report the model's score with and without that override.
- qwen2.5:3b beats regex by +15.3 points [6.3, 24.3] (McNemar p = 0.0015) at about 3.7 s per
  query. That is the bar a 1.5B fine-tune should clear, at lower latency.
- Latency (p50): regex 0.17 ms; 3B Ollama 3.7 s; 1.5B MLX 5.5 s (0-shot) and 10 s (12-shot),
  dominated by prefill of the ~1.7K-token prompt. A fine-tuned model can drop the rules and
  examples from the prompt.

## 2026-10-28: Phase 4. LoRA fine-tune of Qwen2.5-1.5B (MLX)

**Data** (`prepare_sft.py` → `data/router_ft/sft/`): chat format with a one-line system prompt and
the same hints + query user turn as the baselines; no rules, no examples. Bitemporal-mode copies
were added (113 train, 19 val), labelled by the GUIDELINES §6 rule (intent → bitemporal_change; the
text's fusion/grounding/captioning requests → secondaries; other fields unchanged), from train and
val rows only, every label schema-validated. Totals: 677 train, 112 val.

**Training** (`lora_config.yaml`, mlx-lm 0.32.2, options checked with `--help`): rank 8, scale 20,
last 16 layers, all seven projections, Adam lr 5e-5, loss on the answer only, 800 micro-batches
of 4 with 2-step accumulation (400 optimizer steps, ~4.7 epochs). Batch 8 ran out of GPU memory on
the 8 GB M1 at step 1, hence 4×2 and gradient checkpointing. 92 min wall time, at about 20–30
tokens/s because the Mac was swapping. Validation loss: 3.50 → 0.050 (100) → 0.034 (700) → 0.050 (800).

**Checkpoint selection** (`select_checkpoint.py`, val only): exact match 40.2 / 56.3 / 58.0 / 65.2 /
62.5 / 61.6 / **69.6** / 67.9 at steps 100–800. Step 700 selected.

**Test, run once** (189 silver rows; full tables in BASELINES.md):

| Router | exact | Δ vs regex | intent acc | valid | p50 latency |
|---|---|---|---|---|---|
| regex AgentRouter | 31.7 [24.9, 38.1] | | 61.9 | 100 | 0.17 ms |
| qwen2.5:3b, 12-shot (best prompted) | 47.1 [40.2, 54.0] | +15.3 | 70.4 | 83.1 | 3.7 s |
| **Qwen2.5-1.5B + LoRA** | **59.8 [52.4, 66.7]** | **+28.0 [18.5, 37.1], McNemar p = 6e-8** | 79.9 | 89.9 | 1.8 s |

It beats regex on every slice except hint_driven (50.0 vs 57.1, n = 14) and paraphrase is about
level (46.5 vs 41.9). The biggest gains are on compound (62.5 vs 4.2) and keyword_trap (75.0 vs 17.9).
Probes: see BASELINES.md.

**Findings for Phase 5:**
- 19 of 189 outputs (10%) are invalid: an off-vocabulary entity (9, e.g. "sar"), cloud=true without
  fusion (8), or an off-grammar temporal value (2). Constrained decoding (Ollama structured outputs
  with a JSON schema with enums) should remove most of these; measure it.
- The hint augmentation worked: in bitemporal mode every valid output is bitemporal_change (9/14);
  the other 5 are invalid outputs. Enforcing the hint rule in code therefore changed nothing
  (`ft-qwen1.5b-r8-hintrule` = 59.8); it only matters together with a fallback for invalid output.

**3B stretch run (Colab):** `colab/finetune_3b.ipynb` mirrors these settings with QLoRA on a T4
and exports GGUF Q4_K_M. Training finished; the merge step failed on Colab's old torchao (fixed in
the notebook, a33a4da) and the session restarted. Recovery in progress; results TBD.

## 2026-10-29: Phase 4 stretch. The 3B fine-tune and a QLoRA export pitfall

**Run:** `colab/finetune_3b.ipynb` on a free T4 (torch 2.11, transformers 5.20.2, peft 0.21.2,
bitsandbytes 0.50.2). The first run's trained checkpoints were lost: they were on the Colab VM's disk,
the merge cell failed (old torchao vs new peft), and the VM was recycled. The notebook now writes
everything to Drive and reuses a finished run (bcfd60c). The second run's val exact match by step
(`results/router_ft/train/qwen3b-colab/selection.json`): 36.6 / 31.3 / 56.3 / 55.4 / 55.4 / 58.9 /
**66.1** / 63.4 at steps 50–400. Step 350 selected. GGUF sha256 matches the download (`15be48cd…`).

**Problem: the exported model scored 44.6% on val through Ollama, not 66.1%.** Neither Ollama's JSON
mode nor the chat template was the cause (raw mode with the exact HF-rendered training prompt also gave
44.6%). A diagnostic cell in Colab scored the same checkpoint on val:

| Setup | val exact |
|---|---|
| A. nf4 4-bit base + adapter (what training saw) | 65.2 |
| B. fp16 base + adapter | 56.3 |
| C. fp16 merged | 56.3 |
| D. merged → GGUF Q4_K_M via Ollama | 44.6 |

So the merge is correct (B = C). **The QLoRA adapter is tuned to the nf4 weights it was trained
against**: on the fp16 base it loses 9 points, and after re-quantising the merged model to Q4_K_M it
loses 21. The 1.5B avoided this because it was trained and evaluated on the same MLX 4-bit base,
adapter unmerged. Lesson for the write-up: with QLoRA, the deployed weights should be the training
base (or the adapter should be trained on the deployment quantisation), and the exported artifact
must be re-validated, not assumed equal to the training-time score.

Next: the adapter as a LoRA GGUF applied at runtime on Ollama's own qwen2.5:3b (Q4_K_M, the same
base as the prompted baseline): `router-3b-lora-f16.gguf`, 13.3 MB. Whichever deployable 3B variant
is best on val is evaluated once on test.

**Result (2026-10-29).** Ollama 0.35 no longer accepts LoRA adapters (`ADAPTER` → "LoRA adapters are no
longer supported"), so the adapter ran in llama.cpp 0.8.0 (`brew install llama.cpp`, 21 MB): `llama-server`
with Ollama's own qwen2.5:3b blob and `--lora router-3b-lora-f16.gguf` (loaded at scale 1.0, alpha/r from
the GGUF). New `llamacpp` backend in `routers/llm_router.py`.

| 3B variant | val exact |
|---|---|
| nf4 + adapter (Colab, training setup) | 65.2–66.1 |
| merged → Q4_K_M (Ollama) | 44.6 |
| Q4_K_M base + runtime LoRA (llama.cpp) | **47.3** (best deployable, so it went to test) |

Test, once: **37.6 [30.7, 45.0]**, +5.8 vs regex [−3.2, 14.3], McNemar p = 0.25 (not significant), and below
the prompted qwen2.5:3b (47.1). **Conclusion:** the 3B QLoRA fine-tune doesn't survive deployment on this
hardware; the 1.5B (trained and served on the same MLX 4-bit base) is the model to ship. Fixing the 3B would
mean training on the deployment quantisation (e.g. LoRA on a Q4 base in MLX, which needs more than 8 GB),
which is out of scope.

**Reference baseline finished** (gpt-oss-120b, 12-shot, 10 queries/request, reasoning low): **78.8
[73.0, 84.1]** exact. It is an upper reference, not a competitor: it wrote the training data and shares a
family with gpt-oss-20b, one of the two test labellers, so shared conventions may inflate it. BASELINES.md now
says so and no longer shows its latency (it included rate-limit waits).

**Probes:** the fine-tuned 1.5B gets 6/20 exact (intent 15/20) vs regex 7/20 (12/20). Its test-set gain does
not show up on the 20 hand-picked hard cases' full decisions; worth a look in the error analysis (Phase 6).

## 2026-10-29: Phase 5. Serving and the ROUTER_BACKEND switch

**Fixed first:** `backend/.env` now also holds GROQ_API_KEY and OPENROUTER_API_KEY (Phase 2), and the
backend's pydantic Settings rejected unknown keys, so the app and all test modules failed to load (my
regression). Settings now ignore unknown keys (38877db); back to 79 passed.

**Serving decision: `mlx_lm.server` with the 4-bit base and the unmerged adapter**, not a GGUF in Ollama.
That is exactly the evaluated artifact; Phase 4 showed that merging and re-quantising a LoRA can cost 9–21
points. The GGUF path was also blocked here: llama.cpp's converter is code cloned from GitHub, which the
sandbox refused to run. mlx-lm can fuse (dequantised fp16 merge works) but can't write GGUF for qwen2. The
client speaks the OpenAI chat API, so Ollama or llama-server can replace mlx_lm.server later, after a val
re-check. Note: mlx_lm.server treats the request's `model` as a Hugging Face repo to load, so the default
`ROUTER_LLM_MODEL` is its alias `default_model`.

**Backend change** (small, default unchanged):
- `config.py`: `ROUTER_BACKEND` (`regex` default | `llm`), `ROUTER_LLM_URL`, `ROUTER_LLM_MODEL`,
  `ROUTER_LLM_TIMEOUT_S` (8 s).
- `agent/llm_router.py`: trained prompt, schema v1.0 check, success-only LRU cache (one request
  classifies twice), counters and latency for `/api/health`.
- `agent/router.py`: `AgentRouter.decide` is the single decision point; `classify_intent` and
  `plan_execution` use it. Regex logic moved unchanged into `_regex_decision` / `_classify_intent_regex`.
  Plans carry `routing_source`; the DAG's first node names the router and any fallback reason.
- `routes_benchmark.py`: `classify_intent("change", {})` used as a constant → `QueryIntent.BITEMPORAL_CHANGE`
  (same value, avoids a model call).
- **Regex mode is unchanged:** 2,708 plans (train + val + probes × 4 hint settings) are identical to the
  previous router, and the regex test predictions re-run identically.

**Tests:** `tests/test_llm_router.py`, 13 tests: default is regex with no HTTP call; the LLM decision
drives the plan; six failure modes fall back (three invalid outputs, non-JSON, timeout, connection error);
one model call per query; failures are not cached; health reports the backend; prompt and validator parity
with ml/router_ft (the validator agrees with schema.validate on every train/val label and 3,000 random
corruptions). Full suite: **92 passed** (79 + 13).

**The deployed system on test, run once** (`routers/backend_router.py`: AgentRouter.decide with
ROUTER_BACKEND=llm against the running server; fallback rows get the same temporal formatting map as the
regex baseline). Val first, as a check that serving equals the evaluated model: 68.8 vs 69.6 in-process
(one timeout).

| | exact | Δ vs regex | valid | fallbacks | p50 / p95 |
|---|---|---|---|---|---|
| regex | 31.7 [24.9, 38.1] | | 100 | | 0.17 ms |
| fine-tuned model alone (Phase 4) | 59.8 [52.4, 66.7] | +28.0 | 89.9 | | 1.8 s |
| **deployed (model + regex fallback)** | **65.1 [58.2, 72.0]** | **+33.3 [24.9, 41.8], p = 3e-12** | 100 | 19 / 189 | 3.4 s / 5.6 s |

All 19 fallbacks were invalid model output (bad entities 9, cloud without fusion 9, bad temporal 2,
overlapping), none timeouts; regex got 10 of them right. hint_driven: 78.6 (regex 57.1).

**Found along the way:** on the 8 GB M1, the router and the app's Ollama VLM (qwen2.5:3b, which the
backend tests load) can't both stay fast: new-query latency went from about 1.5 s to over 8 s, so requests
hit the timeout and fell back. The scored runs had Ollama unloaded. SERVING.md lists this as a known limit.

**Not done:** constrained decoding (needs a GGUF runtime, see above). The fallback already makes every
served decision valid; constraining would turn some of the 19 fallbacks into model decisions.
