# SatQuery AI (SIH26167) — Post-Fix Audit Report

**Date:** 17 Sep 2026 · **Scope:** re-audit of every finding in `AUDIT_REPORT.md` after the
Phase A/B/C remediation and the Agent 9 frontend truth-pass.

**Method:** the original audit's findings were re-tested against the current code and the
live system. An **independent subagent** re-ran the probes while treating
`REMEDIATION_LEDGER.md` as a *falsifiable claim*, not as evidence. Its full report is
`INDEPENDENT_REAUDIT_2026-09-17.md`.

## Bottom line

| Metric | Result |
|---|---|
| Findings re-tested | 20 (A-1…A-6, B-1…B-3, C-1…C-3, D-1…D-5, E-1/E-2, 3F, 3G) |
| CONFIRMED FIXED | **20** |
| STILL BROKEN | **0** |
| Ledger OVERCLAIMED | **0** |
| New residuals found & fixed | 2 (rows 28, 29) |
| Test suite | **58 passed** (was 54 at Agent 8) |
| Frontend | `tsc --noEmit` clean · `vite build` clean |

## How each class of finding was closed

**3A — fabricated VLM output (P0).** `generate_vlm_answer` now returns
`(None, None, None, None)` when Ollama is unreachable; the answer is then synthesized from
real pixel statistics by the DSP engine. No `0.86/0.91/0.89/0.87/0.93` literals remain;
confidence is a measured function of Otsu separability / backscatter contrast, clamped only
as bounds. InSAR/DInSAR/SBAS/interferometry never appear in any response (verified by
sweep over joshimath, malacca, galwan, pokhran, brahmaputra), and the VLM prompt forbids
them. joshimath vs malacca yield different answer text, confidence, and audit hash.

**3B — false georeferencing.** Non-georeferenced rasters report
`CRS "Unprojected / Non-georeferenced"`, `gsd=null`, `bounds=null`, with
`raster_is_georeferenced: false` surfaced in the DAG. Unknown CRS leaves GSD `null`.
The shared demo raster is now disclosed: `imagery_origin: "shared_demo_raster[custom-aoi,joshimath-subsidence]"`,
`imagery_distinct: false`, and the answer begins with a visible
`SIMULATED DEMO RASTER — not a satellite acquisition` notice. The one real sector
(`isro-sac`) keeps honest real-acquisition provenance and no simulation notice.

**3C — live-data claims.** `live_satellite_stream` is `null` with
`live_stream_status: "not_requested"` by default; only `context_hints.live_stream=true`
fetches a real STAC scene (real `scene_id`, `acquisition_date`, `spectral_metrics`), with
`pil_image` stripped. `/api/settings/ai-status` statuses come from real probes — Ollama
honestly `offline`, Bhuvan/MOSDAC `not_configured`, AWS/PC/ESRI `online`. The frontend shows
"STATUS PROBED LIVE (NO ASSUMED ONLINE)".

**3D — registry / model provenance.** The "800k+ / VRSBench fine-tune" claim is gone; the
adapter is described honestly as fine-tuned on **84 real samples (58 train / 26 eval)** with
a `small_sample_caveat` in `training_metrics.json`. Per-feature confidence is a real image
posterior with `confidence_basis`; a missing tokenizer `raise`s instead of returning a fake
class; no-feature SAR confidence is `null`; the orbital timeline seed is deterministic
(`zlib.crc32`, not per-process `hash()`).

**3E — API/upload hygiene.** Garbage `.tif` → HTTP 400 (magic-byte check); malformed GeoJSON
→ HTTP 400; `inspect-pixel` requires an explicit bbox. Two additional residuals were found
by the re-audit and fixed: client `uploaded_file` traversal is now confined to `uploads/`,
and GeoJSON is validated **before** persisting (no orphan files on 400).

**3F — tests.** The suite moved from asserting clamps to asserting truth: distinct hashes,
no-InSAR absence, honest live-stream default, probed ai-status, shared-raster disclosure,
real-sector-not-simulated, garbage-tif rejection, reproducible hashes, no artificial
benchmark floor, size/extension/null-byte guards, non-wildcard CORS, auth-when-key.
**58 passed.**

**3G — frontend.** Statuses derive from real data (`stacStatus` → ONLINE / NO SCENES /
UNREACHABLE / IDLE); pass lists are prefixed `SIM ·`; the report/telemetry fields are
null-safe; the `isro-sac` pin is single-sourced; dead `activeAlertsCount` removed; Landing's
"4 ORBITERS ONLINE" and cloud claims are honest; the LIVE STAC toggle is wired to
`context_hints.live_stream`. Typecheck and production build are clean.

## Honesty invariants now enforced

1. If a number is shown, it is computed from the actual input (or `null`).
2. If imagery is simulated or shared, the answer says so in its first sentence.
3. If a stage did not run, its latency is `null` — not a placeholder.
4. If the local LLM is down, the response is DSP-only and says so via `ai_engine_active`.
5. Live data is fetched only on explicit opt-in; the default is `not_requested`.

## Residual risks (documented, not hidden)

See `KNOWN_LIMITATIONS.md`. None is a truthfulness defect; they are scope/robustness limits
(no InSAR product, demo-scale model training, LLM path unexercised in the audit
environment, static DInSAR labels on demo cards, no browser end-to-end run).
