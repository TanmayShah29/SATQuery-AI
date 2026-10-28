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
