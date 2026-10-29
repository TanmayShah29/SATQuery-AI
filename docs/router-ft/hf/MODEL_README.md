---
# DRAFT: Hugging Face model card. Not published. Review the TODOs before uploading.
license: apache-2.0
base_model: mlx-community/Qwen2.5-1.5B-Instruct-4bit
library_name: mlx
pipeline_tag: text-generation
language:
  - en
tags:
  - lora
  - mlx
  - query-routing
  - remote-sensing
  - satellite-imagery
---

# satquery-router-qwen2.5-1.5b-lora

A LoRA adapter that turns a satellite-imagery question into a structured routing decision for the
SatQuery assistant: primary intent, secondary intents, object categories, time span, and whether
cloud-piercing (SAR fusion) is needed. It replaces a regex router and doubles its exact-match accuracy
when used with the regex router as a fallback (on a silver-labelled test set, see below).

## Use (MLX)

```bash
pip install mlx-lm
mlx_lm.server --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --adapter-path <this repo> --port 8090 --temp 0
```

```python
from mlx_lm import load, generate
model, tok = load("mlx-community/Qwen2.5-1.5B-Instruct-4bit", adapter_path="<this repo>")
messages = [
    {"role": "system", "content": "You route queries for a satellite-imagery assistant. Reply with only the JSON routing decision."},
    {"role": "user", "content": 'Hints: {"has_bitemporal_pair": false, "has_sar_pair": true}\nQuery: describe the port and box every tanker\nReturn only the JSON label.'},
]
print(generate(model, tok, prompt=tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False), max_tokens=200))
```

Validate the reply against the schema and fall back to rules when it's invalid (about 10% of test outputs
were invalid). Use the 4-bit MLX base above with the adapter unmerged; that is the only setup that was
evaluated.

## Results (189-query silver-labelled test set, run once)

| Router | exact match [95% CI] |
|---|---|
| this adapter + regex fallback | 65.1 [58.2, 72.0] |
| this adapter alone | 59.8 [52.4, 66.7] |
| Qwen2.5-3B, prompted, 12-shot | 47.1 [40.2, 54.0] |
| regex router | 31.7 [24.9, 38.1] |
| same base, prompted, 12-shot | 16.9 [12.2, 22.8] |

"Silver": test labels are the queries where two different LLM labellers agreed on every field; no human
checked them, and the filter makes the set easier than real traffic. Full write-up, error analysis and
limitations: TODO link to the repository's `docs/router-ft/RESULTS.md`.

## Training

677 synthetic chat examples (LLM-generated, kept only when an independent checker model agreed), LoRA rank 8
on the last 16 layers, Adam 5e-5, about 4.7 epochs, on an 8 GB Apple M1 with mlx-lm 0.32.2.

## Limitations

English/Hinglish (Latin script) only; over-predicts entities; misses implied cloud cover; schema-specific
(SatQuery v1.0). Not evaluated on real user traffic.

<!-- TODO before publishing: repo name; link to the GitHub repo; confirm you're happy to share the adapter. -->
