# Data card: SatQuery router dataset

Status: **in progress.** Every number below is TBD until a script produces it; each
filled value names its source file.

## Purpose

Training and evaluating a router that maps a satellite-imagery query plus two UI
context hints to a routing decision (schema v1.0, [GUIDELINES.md](GUIDELINES.md)).

## Splits and sources

| Split | Rows | Source | Labels |
|---|---|---|---|
| test | TBD | Hand-written by one person (the project author), before any synthetic data existed. Frozen: `data/router_ft/test.sha256`. | Hand-labelled from the guidelines. |
| train | TBD | LLM-generated (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b` on Groq), human-reviewed. | Proposed by the generator, accepted/edited/rejected by a human. |
| val | TBD | Same pool as train, stratified by intent. | Same as train. |
| probes | 20 | Hand-picked to expose regex failures. Not used for training or testing. | Hand-labelled. |

## Review (train/val pool)

Source: `review.py stats`.

| | gpt-oss-120b | qwen3.8-27b | all |
|---|---|---|---|
| candidates reviewed | TBD | TBD | TBD |
| accepted unchanged | TBD | TBD | TBD |
| edited | TBD | TBD | TBD |
| rejected | TBD | TBD | TBD |

## Leakage removal

Source: `results/router_ft/split_report.json`. Near-duplicate = character 3–5-gram TF-IDF
cosine ≥ 0.85 against test, probes or guideline examples; ≥ 0.90 within the pool.

| Removed | Count |
|---|---|
| exact duplicates in pool | TBD |
| near-duplicates of test | TBD |
| near-duplicates of probes / guideline examples | TBD |
| near-duplicates within pool | TBD |

## Label consistency

Source: `results/router_ft/agreement.json`. One annotator re-labelled a random 50 test
rows, blind, at least 3 days after freezing. This is **intra-annotator** agreement.

| Metric | Value |
|---|---|
| Cohen's kappa (intent) | TBD |
| raw agreement per field | TBD |

## Class and slice counts

TBD (per split, from `test_writer.py stats` and `split_report.json`).

## Known biases and limitations

- **One annotator wrote and labelled the test set.** Its phrasing reflects one person's
  idea of how analysts type; the agreement figure above is self-consistency, not
  agreement between people.
- **Training queries are machine-written.** Even after review, their style differs from
  real user traffic, which this project does not have.
- **Hint distribution is set by hand** (mostly `cross_modal`, matching the API default), not
  measured from production.
- **English and Hinglish only**, Latin script. Devanagari input is not covered.
- **Indian place names dominate**, by design of the generator prompt.
