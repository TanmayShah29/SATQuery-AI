# Test set plan

> **Superseded on 2026-10-28.** The project owner chose a fully automatic pipeline
> (`ml/router_ft/auto_dataset.py`) instead of hand-writing the test set. This plan is kept
> because its targets still shape the automatic test generator (`TEST_SLICE_TARGETS`,
> `TEST_INTENT_WEIGHTS`), and because the manual tools (`test_writer.py`, `review.py`) still work
> if a hand-written set is ever added. See LOG.md.

The test set is the measurement. Everything else in this project can be redone; this cannot.

## Rules

1. **You write every query yourself.** Don't ask an LLM to brainstorm, rephrase or check
   them, and don't look at the regex router's output. Write how a real analyst would type:
   sometimes terse, sometimes sloppy.
2. **Written before any synthetic data exists.** The generator refuses to run until the
   test set is frozen (`test_writer.py freeze`).
3. **Don't reuse or lightly paraphrase** the examples in [GUIDELINES.md](GUIDELINES.md) or
   [PROBES.md](PROBES.md). Covering the same *idea* in new words is fine; it is the near-copies
   that leak.
4. **Write first, label later.** Write all the queries in one or two sessions (`add`), then
   label them in a separate session (`label`). Labelling while you write tempts you to write
   queries that fit the label.
5. **Include queries you expect every router to get wrong.** A test set that only contains
   what you know works measures nothing.
6. Once frozen, the file is never edited. If you find a labelling mistake later, record it in
   LOG.md with the row id. Don't silently fix it.

## Target mix (~160 rows)

`test_writer.py stats` shows your progress against these numbers.

**Primary intent** (at least 20 per class, so each class has a usable precision/recall):

| Intent | Target |
|---|---|
| optical_vqa | 40 |
| bitemporal_change | 30 |
| crossmodal_fusion | 25 |
| visual_grounding | 25 |
| sar_vqa | 20 |
| scene_captioning | 20 |

**Slices** (one row can carry several tags; these are minimums):

| Slice | Min | Notes |
|---|---|---|
| clean | 30 | The "easy" baseline. |
| paraphrase | 30 | The intent without its usual keyword. |
| negation | 20 | Negated weather, excluded objects ("not the ships"), "no change expected". |
| typo_hinglish | 25 | At least 10 Hinglish, at least 10 typo/shorthand. |
| compound | 25 | Two or more outputs. Include some with three. |
| hint_driven | 20 | `bitemporal` mode, where the text alone would give a different intent. |
| keyword_trap | 20 | "change", "cloud", "draw", "describe", "between" etc. in the wrong sense. |

**Hint configurations:**

| UI mode | hints | Target |
|---|---|---|
| cross_modal (default) | bitemporal=false, sar=true | ~110 |
| bitemporal | bitemporal=true, sar=false | ~25 (most of them hint_driven) |
| single_image | both false | ~20 |
| both pairs | both true | ~5 |

**Field coverage:**

- `temporal` not null: at least 35 rows, with each endpoint form (named, year, month,
  month+year, ISO date, relative) at least 3 times.
- `cloud_piercing_required` true: at least 20 rows, at least 8 of them with a non-fusion primary.
- `secondary_intents` non-empty: at least 25 rows.
- Every entity category in at least 10 rows; at least 20 rows with no entities.

## Time

| Step | Time |
|---|---|
| Write ~160 queries (`add`), in 1–2 sittings | 3–4 h |
| Label them in a separate sitting (`label`) | 2–2.5 h (~50 s each) |
| `freeze` | 1 min |
| **At least 3 days later:** blind re-label of a random 50 (`relabel`) | ~40 min |
