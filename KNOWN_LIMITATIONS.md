# SatQuery AI (SIH26167) — Known Limitations

These are the things the system **does not** do, or cannot currently prove. They are stated
plainly so no reader mistakes a demo for a validated operational capability. None of these
is a hidden failure — each is surfaced in-product or in telemetry.

## 1. No InSAR / DInSAR / SBAS — subsidence is not measured interferometrically
The platform performs **bi-temporal radiometric change detection** on amplitude imagery. It
does **not** compute phase, interferograms, or millimetre displacement. The word
"subsidence" in a sector name describes the demo scenario, not a measurement modality. The
model prompt explicitly forbids InSAR claims and a regression test asserts their absence.

## 2. Demo-scale model training (84 samples)
The RemoteCLIP VQA adapter was fine-tuned on **84 real samples (58 train / 26 eval)**. Eval
top-1 (26.9%) exceeding train top-1 (12.1%) is within small-sample variance, not evidence of
generalization. `training_metrics.json` carries an explicit `small_sample_caveat`. The
foundation backbone (RS-trained ViT-B/32) is real; the adapter is indicative only.

## 3. The local LLM narrative path was not exercised live
Ollama (`qwen2.5:3b`) was **unreachable** throughout the audit environment, so every
verified response used the honest DSP fallback (`ai_engine_active: bitemporal_change_dsp` /
`crossmodal_sar_fusion_dsp`). The LLM branch is covered by code review and returns
`None`-on-failure, but its live prose path could not be proven here.

## 4. Most sector rasters are simulated; two share the same bytes
`joshimath-subsidence` and `custom-aoi` are byte-identical demo rasters (now detected and
disclosed at runtime). Only `isro-sac` is a real acquisition. Sector-specific answers are
therefore illustrative and labelled `SIMULATED DEMO RASTER`; they are not evidence about
the named real-world geology.

## 5. No-CRS GeoTIFF handling
A GeoTIFF with no CRS no longer gets a fabricated georeference. `crs` is reported as
`Unspecified (no CRS in file)`, and `bounds`/`gsd_meters` are `null` (the affine bounds are in
unknown pixel units, so publishing them as WGS84 would be false). Query telemetry carries
`raster_is_georeferenced: false`, `geographic_extent_verified: false`, and `bounds_evaluated: null`
for such uploads, and the engine runs in image-space mode over the default demo AOI. The
remaining limitation is that such a raster cannot be placed on the map or measured in metres —
there is no ground location to report, only the honest absence of one.

## 6. Static demo labels on frontend cards
Some `tacticalData.ts` DInSAR/sensor display strings on demo cards remain. They are tagged
`is_simulated: true` and disclaimed, and the sector cards are headed "DEMO SCENARIOS", but
they are static copy rather than live values.

## 7. Demo-scale ground truth
The ground truth for the demo change pairs is not an independently surveyed reference;
change statistics are real math on the rasters but not validated against field data.

## 8. Live STAC scope
Live ingestion covers a limited Sentinel-2 L2A COG path over a small AOI. Full multi-sensor
STAC search/order, processing, and archive flows are out of scope for this build.

## 9. Verification environment limits
- [Historical] No browser-automation tool was available in the original remediation pass (17 Sep audit), so the frontend toggles/flows were verified by `tsc --noEmit`, `vite build`, and static tracing — not a scripted click-through.
- [Current] The UI-control feature now has Playwright‑verified browser harnesses (`verify_agent1_map_controls.mjs`, `verify_agent3_action_executor.mjs`) that assert real camera position, MapLibre filters, DOM mounts, and per-action DOM state against the live backend.
- The independent re-audit ran against a local dev server, not production infrastructure.
- No git operations were performed in this environment.
- `open_studio` and `run_benchmark` in `actionExecutor.ts` are intentionally skipped:
    the frontend router has no wire-up for studio navigation, and no real benchmark
    catalog is exposed to the frontend, so returning `skipped` is the honest gap rather
    than a fabricated success.

## 10. Security residuals (now fixed, noted for completeness)
Two Medium issues found during re-audit were fixed: a client-supplied `uploaded_file`
traversal in `evidence_builder.py` (now confined to `uploads/`) and validate-before-persist
in `routes_upload.py`. The latter covers **both** upload branches: GeoJSON is parsed in memory
before any write, and the raster branch removes the just-written file + preview and returns 400
when parsing fails — including a magic-byte-valid but unreadable TIFF (truncated/corrupt IFD),
which previously returned 200 and persisted. No known open security issues remain from this
audit; this is not a guarantee against undiscovered ones.
