# Serving the fine-tuned router

The backend routes queries with the regex `AgentRouter` by default. Setting `ROUTER_BACKEND=llm`
switches to the fine-tuned Qwen2.5-1.5B router, with regex as the fallback. Unsetting it switches back;
nothing else changes.

## 1. Start the model server

From `ml/router_ft` (the adapter is in `adapters/qwen1.5b-r8-best/`, git-ignored, about 21 MB):

```bash
uv run mlx_lm.server --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --adapter-path adapters/qwen1.5b-r8-best --port 8090 --temp 0
```

This is the same 4-bit base and the same unmerged adapter that were evaluated, so the served model is
the measured one. Merging or re-quantising for another runtime changes the model: the 3B lost 9–21
points that way (LOG.md, 2026-10-29). Re-validate on val before switching runtimes.

## 2. Point the backend at it

In `backend/.env`:

```
ROUTER_BACKEND=llm
# defaults, shown for reference
ROUTER_LLM_URL=http://127.0.0.1:8090/v1/chat/completions
ROUTER_LLM_MODEL=default_model     # mlx_lm.server's name for the model it was started with
ROUTER_LLM_TIMEOUT_S=8.0
```

Any OpenAI-compatible server works (Ollama `/v1/chat/completions`, `llama-server`): change the URL and set
`ROUTER_LLM_MODEL` to its model name.

## What happens per query

`AgentRouter.decide` (`backend/app/agent/router.py`) sends the trained prompt to the server
(`backend/app/agent/llm_router.py`) and checks the reply against schema v1.0. On a timeout, a connection
error, or a reply that isn't a valid decision, it uses the regex decision instead. Successful decisions are
cached per (query, hints) because one request classifies the same query twice.

- The plan carries `routing_source`: `regex`, `llm` or `regex_fallback`.
- The DAG's first node shows which router decided (`modelUsed`) and the fallback reason.
- `GET /api/health` reports `router.backend` and, in LLM mode, calls, successes, cache hits, fallbacks by
  reason, and p50/p95 latency. It also probes the server (`checks.router_llm`).

## Measured (silver test labels, see BASELINES.md)

| | regex (default) | `ROUTER_BACKEND=llm` |
|---|---|---|
| exact match, test (189 rows) | 31.7% [24.9, 38.1] | **65.1% [58.2, 72.0]** (+33.3, McNemar p = 3e-12) |
| valid decisions | 100% | 100% (19 of 189 from the regex fallback, after invalid model output) |
| routing latency p50 / p95 | 0.17 ms | 3.4 s / 5.6 s on an 8 GB M1 (test run); 2.4 s / 3.5 s on val |

The model alone scores 59.8%; the fallback adds 10 correct decisions out of the 19 it handles.

## Known limits

- **Memory on 8 GB machines.** The router (about 1 GB) and the app's Ollama VLM (`qwen2.5:3b`, about 2.2 GB)
  slow each other down when both are loaded: new-query latency went from about 1.5 s to over 8 s, so
  requests timed out and fell back to regex. Either give the machine more memory, raise the timeout, or keep
  `ROUTER_BACKEND=regex` where the VLM runs on the same small machine.
- **No constrained decoding.** `mlx_lm.server` cannot force the JSON schema, so some replies are invalid; they
  fall back to regex. Ollama and llama.cpp can constrain output to a schema, but need a GGUF export of the
  model, which must be re-validated first (above).
- **Labels are silver.** The quality numbers come from a model-labelled test set, not human labels.
