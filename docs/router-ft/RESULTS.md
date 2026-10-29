# Results: replacing the regex query router with a fine-tuned 1.5B model

**Question.** SatQuery's `AgentRouter` turns a user's satellite-imagery question plus two UI hints into a
routing decision (primary intent, secondary intents, entities, time span, cloud piercing) with regular
expressions. Can a small fine-tuned language model do this better, fast enough to run on a laptop?

**Answer, on a silver-labelled test set:** yes. The fine-tuned Qwen2.5-1.5B, deployed behind
`ROUTER_BACKEND=llm` with the regex router as fallback, gets **65.1%** of test queries fully right versus
**31.7%** for regex: **+33.3 points, 95% CI [24.9, 41.8], McNemar p = 3e-12**. It costs about 3.4 s per
query on an 8 GB M1 instead of 0.17 ms. Regex stays the default.

![Exact match by router](figures/exact_match.png)

Every number here comes from `ml/router_ft/eval.py` (tables: [BASELINES.md](BASELINES.md); raw predictions:
`results/router_ft/eval/`). How each step was decided and what went wrong is in [LOG.md](LOG.md).

## Read this first: what the numbers mean

- **Labels are silver, not human.** Each test query was labelled independently by two different models
  (`qwen3.8-27b` and `gpt-oss-20b`); only the 189 queries where both agreed on all five fields were kept
  (63% of candidates, intent kappa 0.889). "Accuracy" below means agreement with those labels.
- **The test set is probably easier than real traffic.** Agreement filtering drops ambiguous queries, and
  all queries are machine-written. The hardest slice, bitemporal-mode (`hint_driven`) queries, kept only 35%
  of its candidates (14 rows), so its numbers are noisy.
- **The test set was frozen before any training data existed**, never used for prompts, training or model
  selection, and each reported model was run on it once. Checkpoints were chosen on val.
- **Exact match** = all five fields right. Invalid output counts as wrong on every field.

## Main results (test, 189 rows)

| Router | exact [95% CI] | Δ vs regex | intent acc | intent macro-F1 | valid | p50 latency |
|---|---|---|---|---|---|---|
| Regex `AgentRouter` (current default) | 31.7 [24.9, 38.1] | | 61.9 | 0.617 | 100 | 0.17 ms |
| Qwen2.5-1.5B, prompted, 12-shot | 16.9 [12.2, 22.8] | −14.8 | 30.7 | 0.368 | 61.9 | 10.0 s |
| Qwen2.5-3B (Ollama), prompted, 12-shot | 47.1 [40.2, 54.0] | +15.3 | 70.4 | 0.780 | 83.1 | 3.7 s |
| Fine-tuned 3B, best deployable export | 37.6 [30.7, 45.0] | +5.8 (p = 0.25) | 53.4 | 0.604 | 75.1 | 3.8 s |
| **Fine-tuned Qwen2.5-1.5B (model alone)** | **59.8 [52.4, 66.7]** | **+28.0** | 79.9 | 0.825 | 89.9 | 1.8 s |
| **Deployed: fine-tuned 1.5B + regex fallback** | **65.1 [58.2, 72.0]** | **+33.3** | 87.3 | 0.872 | 100 | 3.4 s |
| *gpt-oss-120b, 12-shot (reference)* | *78.8 [73.0, 84.1]* | *+47.1* | *93.7* | *0.933* | *99.5* | *–* |

Δ intervals and McNemar tests are paired against regex (BASELINES.md). The reference wrote the training
data and shares a model family with one of the two test labellers, so it is an upper bound under these
labels, not a competitor; it also ran 10 queries per request on a rate-limited API, so it has no comparable
latency.

**What fine-tuning bought.** The same 1.5B model goes from 16.9% prompted (with the full rules and 12
examples) to 59.8% fine-tuned, with a one-line prompt. Prompted, most of its answers broke the label format
(lenient intent accuracy was about 50%, so it often "knew" the intent). Fine-tuning mostly taught the label
vocabulary and conventions. It also beats a prompted model twice its size (3B: 47.1%) at half the latency.

**What the fallback bought.** 19 of 189 model outputs (10%) were invalid (off-vocabulary entities, cloud
piercing without the fusion step, off-grammar time spans). The deployed system routes those through regex,
which got 10 of them right: 59.8% → 65.1%, and every served decision is valid.

## Where it wins and where it doesn't

Exact match by slice (test):

| Slice (n) | Regex | Fine-tuned alone | Deployed |
|---|---|---|---|
| clean (35) | 34.3 | 62.9 | 62.9 |
| paraphrase (43) | 41.9 | 46.5 | 51.2 |
| negation (23) | 43.5 | 69.6 | 78.3 |
| typo / Hinglish (22) | 27.3 | 54.5 | 59.1 |
| compound (24) | 4.2 | 62.5 | 62.5 |
| keyword trap (28) | 17.9 | 75.0 | 78.6 |
| bitemporal mode (14) | 57.1 | 50.0 | 78.6 |

- **Biggest gains:** compound requests ("describe the port and box every tanker": 4.2 → 62.5) and keyword
  traps ("change the basemap", "cloud storage": 17.9 → 78.6), exactly the cases regex keyword matching gets
  wrong.
- **Paraphrase is the smallest gain** (41.9 → 51.2): intents expressed without their usual words are still
  hard for a 1.5B model.
- **Bitemporal mode needed help.** Every prompted LLM scored 0% there: they read the text and ignored the
  rule "bitemporal pair loaded ⇒ intent is change". Adding rule-derived copies of training rows with that
  hint (GUIDELINES §6, from train/val only) fixed the intent on every valid output; the 5 remaining misses
  were invalid outputs, which the fallback now handles.

## Error analysis (deployed system, 66 wrong of 189)

| What's wrong | rows |
|---|---|
| entities only | 37 |
| intent + cloud piercing | 8 |
| intent only | 7 |
| intent + entities (± cloud) | 6 |
| secondary intents only | 3 |
| other combinations | 5 |

- **Entities are the main remaining error.** Most often an extra `vegetation` (19 times, for instance on
  wetlands or "water basins", which the guidelines put under `flood`) or `building`. Some of these are arguably
  label conventions rather than model mistakes, but the silver labels can't settle that.
- **It over-predicts entities when there are none.** Only 8 of the 20 test queries with no entities got an
  empty list. Phase 2 predicted this: no training row has an empty entity list.
- **Implicit cloud cover is missed.** The most common intent error is `crossmodal_fusion → optical_vqa` (9),
  usually with cloud piercing missed too: queries that imply the optical view is blocked without saying
  "cloud" (for example "…when the cameras fail").
- **Probes.** On the 20 hand-picked regex failure cases from Phase 1 (a diagnostic, not a measurement), the
  deployed system gets 8/20 fully right and 14/20 intents, against regex's 7/20 and 12/20. Most remaining probe
  misses are guideline conventions: "Fusion of optical and radar" without any obstruction should not set cloud
  piercing, and "pre-monsoon vs post-monsoon" maps to `Pre-Event -> Post-Event`. The test-set gain is much
  larger than the probe gain, which is another reason to treat the test set as easier than real use.

## The 3B stretch run, and a QLoRA export pitfall

A 3B version trained on Colab (QLoRA, 4-bit nf4 base) reached 65–66% exact on val **in its training setup**,
roughly level with the 1.5B (69.6% val). Every form of it that runs on the Mac was worse:

| 3B variant | val exact |
|---|---|
| nf4 base + adapter (training setup, Colab) | 65.2–66.1 |
| fp16 base + adapter / fp16 merged | 56.3 |
| merged → GGUF Q4_K_M (Ollama) | 44.6 |
| Q4_K_M base + runtime LoRA (llama.cpp) | 47.3 → **37.6 on test** |

The adapter had adapted to the exact quantised weights it was trained against. The 1.5B never had this
problem because it was trained and served on the same MLX 4-bit base with the adapter unmerged. **Lesson:**
with QLoRA, serve the base you trained on (or train on the deployment quantisation), and re-validate any
exported artifact before trusting the training-time score.

## Cost and deployment

- **Training:** 677 chat examples, LoRA rank 8 on the last 16 layers, 400 optimizer steps, about 92 minutes on
  an 8 GB M1 (memory-bound). Data generation and labelling used free API tiers only (Groq, OpenRouter).
- **Serving:** `mlx_lm.server` with the 4-bit base and the unmerged adapter, about 1 GB. Backend switch,
  fallback, telemetry and tests: [SERVING.md](SERVING.md). Regex mode is byte-for-byte unchanged (2,708 plans
  compared); 92 backend tests pass.
- **On an 8 GB machine, the router competes with the app's own Ollama VLM** for memory; with both loaded,
  new-query latency went past the 8 s timeout and requests fell back to regex. This is a real deployment cost.

## Limitations

- Silver labels, machine-written queries, agreement-filtered test set (see the top of this page). No human
  checked any label; a 30-row human spot-check would put a number on label accuracy.
- 189 test rows: confidence intervals are about ±7 points; per-slice numbers (14–43 rows) are rough.
- Training data comes from one generator (`gpt-oss-120b`) filtered by one checker (Nemotron Ultra); the two
  checkers made different keep/reject calls on about one candidate in five.
- English and Hinglish in Latin script only; Indian place names dominate.
- Latency was measured on one 8 GB M1 under varying memory pressure.

## Reproduce

From `ml/router_ft` (see LOG.md for the full history and DATASET.md for the data card):

```bash
uv run python eval.py run --name regex --router regex
uv run python prepare_sft.py && uv run mlx_lm.lora -c lora_config.yaml
uv run python select_checkpoint.py adapters/qwen1.5b-r8
uv run python eval.py run --name ft-qwen1.5b-r8 --router mlx --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --adapter adapters/qwen1.5b-r8-best --prompt sft
uv run python eval.py report
```
