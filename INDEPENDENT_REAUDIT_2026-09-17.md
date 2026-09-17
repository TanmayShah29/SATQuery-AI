# SatQuery AI — Independent Re-Audit vs. Remediation Ledger

**Date:** 2026-09-17 · **Method:** Forensic re-test of every finding in `AUDIT_REPORT.md` §3
against the current codebase, treating `REMEDIATION_LEDGER.md` claims as falsifiable,
not as evidence. No source files were modified; no commits were created; all probe
artifacts in `data/sample/uploads` were removed after testing.

---

## 1. Commands & Probes Run

**Static (all passed prior verification of code paths):**
- 22 literal/claim greps across `backend/app` and `frontend/src`
  (0.86, 0.91, 0.89, 0.87, 0.93, 0.72, 0.95, 800k, VRSBench, GSD 10m,
  InSAR, DInSAR, SBAS, interferomet, activeAlertsCount, 100% REAL, 4 ORBITERS)
- Full read of 9 backend modules + 4 test files
- `md5` sweep of all rasters in `data/sample/` (sectors, optical, sar, geotiffs, uploads)

**Dynamic:**
- `GET /api/health` → `{"status":"degraded","checks":{"upload_dir":"ok","ollama":"unreachable","stac_element84":"ok"},"live_stac_streaming":"online","integrations":{"bhuvan_wms":{"configured":false,"status":"not_configured",...},"mosdac":{...not_configured...}},"version":"1.0.0"}`
- `GET /api/settings/ai-status` → `ollama_qwen2.5_3b: offline`, `remoteclip_vit_b32_domain_adapter: weights_loaded`,
  live_data_sources with mixed `online` / `not_configured`; no "100%" any string; local inference only.
- `POST /api/query` × 4 (see §3 for full responses): joshimath bitemporal, malacca bitemporal, isro-sac bitemporal, malacca cross_modal
- `POST /api/query` with `context_hints:{"live_stream":true}` → real STAC scene returned
- `POST /api/upload` garbage 4-byte `.tif` → **HTTP 400**
- `POST /api/upload` malformed `.geojson` → **HTTP 400**
- Frontend: `npm run lint` (tsc --noEmit) → pass; `npm run build` (vite) → pass
- `pytest backend/tests -q` → **56 passed, 86 warnings in 34.33s**

---

## 2. Verdict Table

| Finding | Ledger claim | Independent result | Raw evidence | Verdict |
|---|---|---|---|---|
| A-1 Scripted VLM answers on Ollama-down | Removed; VLM returns empty on failure | `generate_vlm_answer()` returns `(None,None,None,None)` on Ollama failure; live answers built from real pixel statistics by DSP | `realtime_vlm_agent.py:170`; live joshimath answer "Radiometric differencing (Otsu threshold: 0.133) isolated 1 … cluster(s) covering … 0.3631 km²", `ai_engine_active: bitemporal_change_dsp` | **CONFIRMED FIXED** |
| A-2 Hardcoded confidence (0.86/0.91/0.89/0.87/0.93) | Replaced by measured values | No literals match; only clamp **bounds** in formula built from real stats (`clip(0.72 + separability*0.24, 0.75, 0.97)`; `clip(1-e^(-scr/2.5), 0.72, 0.98)`); live confidences vary (0.828/0.852/0.945/0.98) | grep zero hits for literals; `change_detector.py:73,202`; `sar_fusion.py:140,223`; live responses §3 | **CONFIRMED FIXED** |
| A-3 Fixed confidence template 0.95 on VLM fail | Removed | No 0.95 / 0.94 template anywhere; confidence flow: `None` → ROI mean → measured clamp | grep; VLM `None` path | **CONFIRMED FIXED** |
| A-4 InSAR/DInSAR/SBAS/interferometry claims | Removed from all responses | No occurrence in any backend query output; VLM prompt affirmatively forbids; `test_no_insar_claim_on_bitemporal` asserts full-response absence | grep; `realtime_vlm_agent.py:260-261`; live blob self-check (insar/dinsar/sbas/interferomet all False) | **CONFIRMED FIXED** *(frontend static labels residual, §4.r)* |
| A-5 Distinct audit hash per input | joshimath ≠ malacca | Live: joshimath `SHA256-2D4ECBFE…` ≠ malacca `SHA256-CC5510A9…` ≠ isro-sac `SHA256-2EE845D0…`; `test_distinct_inputs_yield_distinct_audit_hash` passes | §3 responses; `test_api.py:418` | **CONFIRMED FIXED** |
| A-6 Real DAG latencies; null when stage unrun | Latencies measured; vectorizer None where untimed | `time.perf_counter()` measured parser/dispatcher/specialist; `vectorizer_latency_ms=None` unset in PATH1/PATH2; live **all four** runs show `node-4-vectorizer lat: None` | `evidence_builder.py:146,242`; `dagNodes` in §3 | **CONFIRMED FIXED** |
| B-1 False EPSG:4326 / GSD 10m on non-georeferenced | Honest CRS/GSD | Non-georeferenced default: `crs "Unprojected / Non-georeferenced"`, `gsd=null`, `bounds=null`; `raster_is_georeferenced: False` surfaced in DAG | `geotiff_parser.py:36-57`; live `node-2-dispatcher … Georeferenced:` | **CONFIRMED FIXED** *(no-CRS GeoTIFF residual §4.d)* |
| B-2 Sector rasters byte-identical / shared claimed distinct | Provenance honest; shared bytes disclosed | **md5 sweep**: joshimath & custom-aoi share exact optical bytes (`f3c01ba…`/`8f6e971…`), all other sectors unique. Runtime discloses: `imagery_origin: "shared_demo_raster[custom-aoi,joshimath-subsidence]"`, `imagery_distinct: false`, answer prefixed `SIMULATED DEMO RASTER` | md5 sweep; live joshimath vs malacca (`imagery_distinct: false` vs `true`) | **CONFIRMED FIXED** |
| B-3 Real-acquisition sector mislabeled | isro-sac not simulated | Live isro-sac: `is_real_image: True, is_simulated: False, imagery_origin: isro-sac_real_acquisitions, imagery_distinct: True, data_provenance: "Verified Sentinel-2 / Sentinel-1 Real Satellite Acquisition"`, **no** `SIMULATED DEMO RASTER` prefix | §3 isro-sac; `test_real_acquisition_sector_is_not_labelled_simulated` | **CONFIRMED FIXED** |
| C-1 live_satellite_stream default null; real opt-in scene | Off by default; honest opt-in | Default: `live_satellite_stream: null`, `live_stream_status: not_requested`; opt-in returns real STAC scene (S2A_44RLU_20240619, `acquisition_date` set, **no `pil_image`**); `test_live_stream_opt_in_and_honest_default` passes | §3; live opt-in response | **CONFIRMED FIXED** |
| C-2 ai-status real probes, not "100%/all online" | Probed statuses | Ollama real timeout probe → `offline/unreachable`; Bhuvan/MOSDAC honestly `not_configured` (no key) while AWS/PC/ESRI `online`; `test_ai_status_is_probed_not_hardcoded` asserts | `/api/health`, `/api/settings/ai-status` | **CONFIRMED FIXED** |
| C-3 activeAlertsCount removed / alerts labelled | Removed | Grep: no `activeAlertsCount` anywhere; alerts are `is_simulated: true` demo entries | grep | **CONFIRMED FIXED** |
| D-1 No "800k+" / VRSBench fine-tune claim | Honest provenance | No "800k"; registry states "fine-tuned on 84 real samples (58 train / 26 eval)"; VRSBench appears only as a **benchmark route** + a code **comment** | `models/registry.py`; grep; `routes_benchmark.py` | **CONFIRMED FIXED** *(comment residual §4.g)* |
| D-2 training metrics honesty | Caveat present | `training_metrics.json` contains explicit `small_sample_caveat`: "NOT evidence of generalization; metrics are indicative only… Eval top-1 (26.92%) exceeding train top-1 (12.07%) is within small-sample variance" | `training_metrics.json:10` | **CONFIRMED FIXED** |
| D-3 remote_clip confidence = real posterior; tokenizer raises | Confidence honest; errors loud | `conf = round(min(0.98, softmax_posterior),3)`, `confidence_basis: image_class_posterior`; missing tokenizer → `raise RuntimeError`; cap only | `models/remote_clip.py:425,530-537` | **CONFIRMED FIXED** |
| D-4 Stable timeline seed | Deterministic | `zlib.crc32(f"{profile.id}_{tr}") % 100000` → reproducible; every pass tagged `is_simulated: true, acquisition_type: "Simulated Constellation Orbital Schedule"`; `test_reproducible_audit_hash` + `test_sector_timeline_authentic_revisit` pass | `sector_assets.py:501-531` | **CONFIRMED FIXED** |
| D-5b Unknown-CRS GSD null | GSD unknown for non-4326/UTM | Non-4326/UTM CRS → `gsd_meters: None` + note "ground sample distance left unknown" | `geotiff_parser.py:98-100` | **CONFIRMED FIXED** *(no-CRS branch residual §4.d)* |
| D-5c No-feature SAR confidence → 0.82 | Confidence null | `calibrated_overall_conf = None` when no features, comment referencing old fabricated 0.82 | `sar_fusion.py:227` | **CONFIRMED FIXED** |
| E-1 Garbage `.tif` accepted | Rejected | Live: 4-byte `\x00\x01\x02\x03.tif` → **HTTP 400** "does not match TIFF magic bytes"; test asserts 400 | live probe; `test_uploaded_garbage_tif_rejected` | **CONFIRMED FIXED** |
| E-2 Malformed GeoJSON / missing bbox | Rejected; bbox required | Live: truncated GeoJSON → **HTTP 400** "Invalid GeoJSON/JSON file"; `inspect-pixel` without bbox → **HTTP 400** "A bbox is required for pixel inspection" | live probe; `routes_upload.py:205-206` | **CONFIRMED FIXED** *(orphan-file residual §4.g)* |
| 3F Tests pass + assert truth | Suite green & meaningful | **56 passed**; tests assert anti-fabrication properties (distinct hash, no-InSAR, honest live-stream default, probed ai-status, shared-raster disclosure, real-sector not simulated, garbage-tif 400, reproducible hash, no artificial benchmark floor, ≤100MB, traversal/extension/null-byte, non-wildcard CORS, auth-when-key) | pytest output; `test_api.py` guards | **CONFIRMED FIXED** |
| 3G Frontend statuses real; no fabricated geology | Statuses probed; feeds labelled | `ModelStatusModal` shows "STATUS PROBED LIVE (NO ASSUMED ONLINE)"; `RightOperationalPanel` ONLINE derived from live STAC probe (IDLE/NO SCENES/UNREACHABLE otherwise); SituationalFeedDrawer disclaims "no InSAR/DInSAR processing"; Landing case studies header "TACTICAL SECTOR CASE STUDIES (DEMO SCENARIOS)" + "figures below are scripted… not claims of a validated evaluation run"; frontend lint+build both pass | `Landing.tsx:371,387,413`; `SituationalFeedDrawer.tsx:62`; `RightOperationalPanel.tsx:806-821`; lint/build output | **CONFIRMED FIXED** *(static DInSAR labels residual §4.r)* |

**Result: all 20 findings CONFIRMED FIXED; 0 STILL BROKEN; 0 OVERCLAIMED in the ledger.**

---

## 3. Live Query Evidence (abridged)

**joshimath-subsidence · bitemporal (audit probe)**
```json
audit_hash: SHA256-2D4ECBFEDEDB71B8   confidence: 0.945   latency_ms: 35.6
live_satellite_stream: null           ai_engine_active: bitemporal_change_dsp
answer: "SIMULATED DEMO RASTER — not a satellite acquisition of this location; …
         Radiometric differencing (Otsu threshold: 0.133) isolated 1 statistically
         significant surface transition cluster(s) … 0.3631 km²."
telemetry: imagery_origin: "shared_demo_raster[custom-aoi,joshimath-subsidence]"
           imagery_distinct: false   data_provenance: "SIMULATED DEMO RASTER (not satellite-acquired) …"
dagNodes: node-1 lat:0.2 | node-2 lat:8.1 (Georeferenced disclosed) | node-3 lat:20.6 | node-4 lat:None
```

**malacca-chokepoint · bitemporal**
```json
audit_hash: SHA256-CC5510A956DD8BB5   confidence: 0.852   latency_ms: 42.1
telemetry: imagery_origin: "sector_files:malacca-chokepoint"   imagery_distinct: true
dagNodes: node-4 lat:None   (vectorizer untimed → null)
```

**isro-sac · bitemporal**
```json
audit_hash: SHA256-2EE845D0C1108E4D   confidence: 0.828
telemetry: is_real_image: true | is_simulated: false | imagery_origin: "isro-sac_real_acquisitions"
           imagery_distinct: true | raster_is_georeferenced: false
           data_provenance: "Verified Sentinel-2 / Sentinel-1 Real Satellite Acquisition"
answer: (no SIMULATED prefix)   dagNodes: node-4 lat:None
```

**malacca-chokepoint · cross_modal (SAR sweep)**
```json
audit_hash: SHA256-AAC7B32C9F2085D6   confidence: 0.98   intent: crossmodal_fusion
answer: "SIMULATED DEMO RASTER — … Cross-modal Sentinel-1 C-SAR microwave polarimetry
         (5.405 GHz) penetrated 4.0% atmospheric obscuration … isolated 6 high-dielectric
         structural scatterers (mean backscatter: -13.1 dB)."
self-check: insar=False dinsar=False sbas=False interferomet=False   node-4 lat:None
```

**live-stream opt-in**
```json
live_satellite_stream: { source: "AWS Open Data (Sentinel-2 L2A COG)", scene_id: "S2A_44RLU_20240619_0_L2A",
  acquisition_date: "2024-06-19T05:30:37.631000Z", cloud_cover_pct: 28.1, thumbnail_url …, visual_cog_url … }
telemetry.live_stream_status: online      (no pil_image)
```

---

## 4. Residual Risks / Overclaims (not in ledger, newly surfaced)

| # | Severity | Observation | Evidence |
|---|---|---|---|
| a | **Medium** | `evidence_builder` joins `uploaded_file` into `settings.sample_dir/"uploads"` **without `safe_join`**; an attacker-supplied `uploaded_file` may read an arbitrary local file as a PIL image (or 500 via uncaught exception). Uploads themselves are sanitized on write, but the query path trusts the caller string. | `evidence_builder.py:87` vs `routes_upload.py:44-49` |
| b | Low–Med | PATH2 answer **hardcodes** sensor attribution "Cross-modal Sentinel-1 C-SAR microwave polarimetry (5.405 GHz)" + "pierced X% atmospheric obscuration" regardless of raster provenance; SAR feature properties hardcode `sensor: "Sentinel-1 C-SAR (IW GRD)"`, `polarization: "VV+VH Dual-Pol"`, `imagery_is_simulated: True` even for isro-sac real data. Simulated sectors are disclosed via the `SIMULATED DEMO RASTER` prefix (reduces risk); real sector not affected live today. | `evidence_builder.py:277-282`; `sar_fusion.py:182-184,239` |
| c | Low | Telemetry/ai-status hardcodes device string "PyTorch Apple Silicon Metal (MPS) / Multi-Core CPU" instead of probing `torch.backends`; matches current machine but is not measured. | `evidence_builder.py:512`; `/api/settings/ai-status` `hardware_acceleration` |
| d | Low–Med | GeoTIFF with **no CRS tag** is labeled `"EPSG:4326 (Unspecified GeoTIFF)"` and a GSD is *computed* in meters from degree units — the qualifier "(Unspecified)" is honest, but assuming degrees yields a plausible-but-unverified GSD. | `geotiff_parser.py:74,91-94` |
| e | Low | No-CRS raster rounds still produce `preview_url` under `/api/samples/image/uploads/…` and a thumb is persisted at upload time; harmless but unreferenced by inquiry. | `geotiff_parser.py:55` |
| f | Medium | **Invalid uploads persist before validation**: `routes_upload.py:91-93` writes the file to `data/sample/uploads` *before* GeoJSON `json.loads` at line 98 → malformed uploads leave orphaned files (observed: `bad_bbe3e2f1.geojson` persisted on a 400; removed during probe cleanup). Minor disk-hygiene / bloat vector, not a fabrication. | live 400 probe + `routes_upload.py:91-98` |
| g | Cosmetic | `remote_clip.py:93` comment "BigEarthNet & VRSBench Domain-Adapted Semantic Taxonomy" mentions VRSBench in a docstring though training used only 84 BigEarthNet samples — comment-only, but could mislead a skim reader. | `remote_clip.py:93`; `training_metrics.json:5` |
| h | Low | `md5` sweep shows stale sector-dir copies: `sectors/isro-sac/{optical_t1,t2}.jpg` are byte-identical to joshimath/custom-aoi copies even though the runtime correctly bypasses them (uses `data/sample/optical/*`); and many `data/sample/uploads/test_*.geojson` share one byte-identical payload. Integrity-disclosure logic is unaffected (explicitly skips isro-sac dir), but the stale files could confuse future audits. | md5 sweep; `sector_assets.py:373-374` |
| r | Low | **Frontend static demo labels** still assert DInSAR capability/metrics as display copy: `tacticalData.ts:255` badge `DInSAR // SUBSIDENCE`, `:260` "monitored via Sentinel-1 DInSAR interferometry…", `:264` "-5.4 cm vertical ground displacement detected", `:608` "5.405 GHz C-band radar interferometry"; `Landing.tsx:166` "Coherent InSAR Baseline". All reside in `is_simulated: true` demo config and the Landing deck explicitly disclaims ("DInSAR phase-coherence processing is not implemented in this build"), so not counted as broken — but these strings surface verbatim in the tactical UI and are not API-derived. | `tacticalData.ts`, `Landing.tsx:335-424` |

---

## 5. Conclusion

Every §3 finding tested **CONFIRMED FIXED** against the current tree, verified by
independent code reads, live API probes, an md5 integrity sweep, a 56-test suite whose
guards assert the anti-fabrication properties (not just HTTP codes), and a clean
frontend lint+build. The remediation is genuine and observable at runtime, not
cosmetic. Four residuals worth follow-up before final submission: path traversal on
`uploaded_file` in `evidence_builder` (§4.a), write-before-validate upload hygiene (§4.f),
frontend static DInSAR display strings (§4.r), and the no-CRS GeoTIFF GSD assumption (§4.d).