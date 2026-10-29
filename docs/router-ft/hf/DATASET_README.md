---
# DRAFT: Hugging Face dataset card. Not published. Review the TODOs before uploading.
license: other  # TODO: choose; first check the output terms of every model that wrote or labelled rows (below)
language:
  - en
task_categories:
  - text-classification
tags:
  - query-routing
  - remote-sensing
  - synthetic
size_categories:
  - n<1K
configs:
  - config_name: default
    data_files:
      - {split: train, path: train.jsonl}
      - {split: validation, path: val.jsonl}
      - {split: test, path: test.jsonl}
---

# satquery-router-routing-decisions

Synthetic satellite-imagery questions, each with the two UI hints SatQuery sends and a routing decision
in schema v1.0: `intent`, `secondary_intents`, `entities`, `temporal`, `cloud_piercing_required`.

| split | rows | queries written by | labels |
|---|---|---|---|
| train | 564 | `openai/gpt-oss-120b` | generator's label, kept only if `nvidia/nemotron-3-ultra-550b-a55b` produced the identical label blind |
| validation | 93 | same pool as train | same |
| test | 189 | `qwen/qwen3.8-27b` (own personas and regions, no examples), before any training data existed | kept only if `qwen/qwen3.8-27b` and `openai/gpt-oss-20b` labelled it identically, blind |

All labels are **silver**: no human wrote or checked them. The test filter keeps queries two models found
unambiguous, so it is easier than real traffic; only 35% of bitemporal-mode test candidates survived it.
Near-duplicates between splits were removed (character 3–5-gram TF-IDF cosine ≥ 0.85; none found).

Each row: `id`, `query`, `hints` (`has_bitemporal_pair`, `has_sar_pair`), `label`, `slices` (clean,
paraphrase, negation, typo_hinglish, compound, hint_driven, keyword_trap) and provenance.

Labelling rules: TODO link to `docs/router-ft/GUIDELINES.md`. Data card with agreement statistics and
known biases: TODO link to `docs/router-ft/DATASET.md`.

## Limitations

Machine-written English and Hinglish (Latin script); Indian place names dominate; hint distribution set by
hand to match the app's default mode; one generator and one checker for the training pool.

<!-- TODO before publishing: licence; whether to publish the test split (publishing it lets others
     evaluate, but it can then leak into other models' training data); repo name and links. -->
