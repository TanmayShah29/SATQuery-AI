# Drafts: LinkedIn post and resume bullets

Drafts only; nothing is posted. Every number is from [RESULTS.md](RESULTS.md). Keep the "silver labels"
caveat if you shorten them: it's the honest part, and reviewers notice when it's missing.

## LinkedIn post

> I replaced a regex query router with a fine-tuned 1.5B model, on an 8 GB MacBook, for free.
>
> SatQuery (our SIH 2026 satellite-imagery assistant) routes every question to a specialist pipeline:
> change detection, SAR/optical fusion, grounding, captioning. The router was hand-written regex, and it
> broke on paraphrases, Hinglish, negations ("no clouds today") and compound asks.
>
> What I built:
> • A labelling spec and a fully automatic dataset pipeline on free API tiers. Test queries were labelled
>   blind by two different models, keeping only full agreements, and the test set was frozen before any
>   training data existed.
> • An eval harness with bootstrap confidence intervals and paired tests, plus four baselines (regex, prompted
>   1.5B and 3B models, and a 120B reference).
> • A LoRA fine-tune of Qwen2.5-1.5B with MLX on an M1 (about 90 minutes), served behind a feature flag, with
>   the regex router as fallback and telemetry.
>
> Results on 189 held-out queries (exact match, all five routing fields right):
> • regex: 31.7%
> • prompted Qwen2.5-3B, 12 examples: 47.1%
> • fine-tuned 1.5B + regex fallback: 65.1% (+33 points, p < 1e-11), at about 3 s per query on the laptop
>
> Two lessons:
> 1. A 1.5B model went from 16.9% when prompted to 59.8% when fine-tuned. It mostly needed to learn the label
>    vocabulary, not the task.
> 2. My 3B QLoRA run scored 66% on validation in Colab and 38% on test after export. The adapter had learned the
>    exact quantised weights it was trained on. Always re-validate the artifact you actually ship.
>
> Caveat: the labels are "silver" (model agreement, not human), so the test set is probably easier than real
> traffic. The write-up has the error analysis and limitations.
>
> [link to repo / RESULTS.md]

## Resume bullets

- Fine-tuned Qwen2.5-1.5B (LoRA, MLX, 8 GB M1) to replace a regex intent router in a satellite-imagery
  assistant; doubled exact-match routing accuracy from 31.7% to 65.1% on a held-out test set (+33.3 pts,
  95% CI 24.9–41.8), beating a prompted model twice its size.
- Built a fully automatic synthetic-data pipeline on free API tiers: two-model blind labelling with an
  agreement filter, leakage checks, and a test set frozen by hash before training data existed.
- Wrote an evaluation harness (bootstrap CIs, McNemar tests, slice and error analysis) and benchmarked
  regex, prompted 1.5B/3B and 120B-reference baselines.
- Shipped it behind a feature flag (`ROUTER_BACKEND=llm`) with schema validation, regex fallback, caching and
  health telemetry; proved the default path unchanged across 2,708 routing plans; 92 backend tests pass.
- Diagnosed a QLoRA export failure (66% → 38%) as adapter–quantisation coupling and documented the fix.

## Short version (one line)

Fine-tuned a 1.5B LLM on a laptop to replace a regex router: 31.7% → 65.1% exact-match routing on held-out
(silver-labelled) queries, shipped behind a feature flag with regex fallback.
