# SATQUERY AI (SIH26167) — Forensic Verification Audit

**Date:** 17 Sep 2026 · **Verdict: CONDITIONAL / NOT SHIP-READY (integrity defects disqualify until remediated)**
**Deadline for submission:** 30 Sep 2026 · **Live backend health at audit time:** `degraded` (Ollama `unreachable`, STAC `ok`)

---

## 1. Executive Summary

SatQuery AI is a genuinely engineered application — a real FastAPI + React architecture, real classical-DSP raster engines (Otsu/NDWI/connected-components/SAR Lee filter), a real RemoteCLIP-ViT-B/32 inference path with a 605 MB checkpoint on disk, real training (with metrics) of an 84-sample BigEarthNet adapter, sanitized upload handling, security headers, CORS lockdown, API-key auth, and honest disclosure flags carried in telemetry and several UI components.

However, the claims the app makes to its own users are **not what it computes**. When Ollama is unreachable (which is the current live state), the system does not answer from the image it was asked about: it substitutes a keyword-triggered template that **fabricates measured results** (Sentinel-1 DInSAR, interferometric displacement and subsidence claims, cloud-penetration percentages), stamps **hardcoded confidence values** (0.72–0.95), **mislabels the origin** as "RemoteCLIP-ViT Neural VLM (Apple Silicon MPS / Local Neural)", overwrites the genuine RemoteCLIP output with this text, and only then relabels the engine as `remoteclip_vlm`. The same fabricated answer is returned regardless of the image or even the geography of the sector (a Himalayan subsidence analysis was served verbatim for the Malacca Strait maritime corridor).

Verdict taxonomy used throughout: `REAL` · `REAL-BUT-WEAK` · `HARDCODED` · `FABRICATED` · `STUB/NOT-IMPLEMENTED` · `UI-ONLY-NO-BACKEND` · `MISLABELED` · `UNVERIFIED`.
Severity: **P0-DISQUALIFYING** · **P1-CREDIBILITY** · **P2-POLISH**.

### Headline findings (all verified by execution, not just reading)

| ID | Finding | Taxonomy | Severity |
|---|---|---|---|
| D1 | VLM answer fabricated from keyword templates; real model output overwritten; model mislabeled | FABRICATED / MISLABELED | **P0** |
| D2 | Answers assert Sentinel-1 DInSAR / interferometric displacement / subsidence — no DInSAR code exists anywhere | FABRICATED | **P0** |
| D3 | Non-georeferenced `.jpg` sector rasters return "georeferenced" EPSG:4326 GeoJSON + "CRS: EPSG:4326 / GSD 10m" DAG claims | FABRICATED | **P0** |
| D4 | Three distinct tactical sectors (custom-aoi, isro-sac, joshimath-subsidence) share byte-identical optical imagery (md5 city hash) yet answer as their own geology | FABRICATED | **P0** |
| D5 | "Live" UI claims sourced from hardcoded `online` statuses; `live_satellite_stream` is never populated (`fetch_live_satellite_scene` has zero callers) | UI-ONLY-NO-BACKEND / HARDCODED | **P0** |
| D6 | Sector registry defaults: 11/12 sectors `is_simulated=True`; frontend counters with literal "100% REAL SCENES" | MISLABELED | **P0** |
| D7 | 4-byte garbage `.tif` accepted by `/api/upload` as a valid 512×512 raster ("success") | HARDCODED/PARSER GAP | P1 |

Positives that survive the audit and should be presented as the real story: genuine RemoteCLIP inferencing, genuine classical DSP (change, SAR, spectral), genuine adapter training with honest metrics, honest telemetry provenance flags (`evidence_builder.py:427-429`), honest `is_simulated` badges (TemporalScrubber, MapCanvas, HeaderHUD), and an Intentional honesty fix comment in `HeaderHUD.tsx:100-104`.

---

## 2. PS26167 Compliance Table

| PS Requirement | Implementing code | Verdict | Evidence | Gap / Risk | Disqualify risk |
|---|---|---|---|---|---|
| §7 Remote-sensing adaptation (fine-tune/adapt, BigEarthNet) — generic VLM without it auto-disqualifies | `models/remote_clip.py::BigEarthNetDomainAdapter`; `scripts/train_remote_clip_adapter.py`; `data/weights/bigearthnet_adapter.pt` + `training_metrics.json` | **REAL-BUT-WEAK** | Training log: 58 train / 26 eval samples, 25 epochs, heldout top-1 26.92% (baseline 0%), top-3 69.23%, loss plateau ~1.04 | Only 84 samples; heldout top-1 ≈ 2× random for 7 classes; train top-1 (12.07%) **below** eval (26.92%) — tiny and statistically suspect | LOW-MED (hard requirement met, weakly) |
| §3 Single-image **VQA** (mandatory) | `remote_clip.py` real open_clip cos-sim + softmax `calibrated_confidence`; `generate_vlm_answer` | **REAL but undermined** | Live probe returned fabricated template answers for optical queries even though MPS inference exists | Default answer text, confidence and model label come from `_synthesize_local_neural_reasoning`, not the model, whenever Ollama is down | **HIGH** |
| §3 Single-image captioning OR text-guided grounding | `router.py` `SCENE_CAPTIONING` / `VISUAL_GROUNDING` intents; registry claims "scene_captioner"; SearchModal claims "RemoteCLIP + MobileSAM Ingestion" | **STUB/NOT-IMPLEMENTED** | No MobileSAM/GroundingDINO/SAM code anywhere in `backend/`; grounding = connected-component polygons; caption = same template | Bonus capability marketed as a model that does not exist | LOW (not a hard requirement once VQA counts) |
| §4 Multi-image bi-temporal change | `engine/change_detector.py` (Otsu + drift + Shapely) | **REAL** | Bitemporal samples + change engine; honest DSP | Confidence is Otsu-separability-based formula, not neural (acceptable for DSP) | LOW |
| §4 Cross-modal optical + SAR | `engine/sar_fusion.py` (Lee filter + threshold + polygonize) | **REAL** | SAR sample + fusion engine; `sar.png` assets per sector | `sar_backscatter_db` approximation from optical brightness (geotiff_parser:310) | LOW |
| §5 Agentic orchestration w/ auditable DAG execution trace (DAG graded, not cosmetic) | `router.py::plan_execution`; `evidence_builder.py:367-408` dagNodes | **FABRICATED** | DAG is a fixed 4-node structure where every node is `status:"completed"` with hardcoded latencies (40ms/10ms), claims CRS/GSD not derived from the raster, and no real tool-chaining occurs | DAG claims performance it didn't produce | **HIGH** |
| §6 GeoTIFF/TIFF primary; PNG/JPEG only for benchmarks | `routes_upload.py`, `engine/geotiff_parser.py` | **REAL with gaps** | Real rasterio parse, CRS/GSD/bounds extraction; upload enforces size + sanitization | 4-byte garbage `.tif` accepted as "success"; unknown-CRS fallback hardcodes GSD 10 m (geotiff_parser:101); sector imagery is `.jpg`/`.png` | MED |
| §7 Deliverables: working GUI, source, trained weights, test suite, live demo script | `frontend/`, `backend/`, `data/weights/RemoteCLIP-ViT-B-32.pt`, `backend/tests/` (48 pass), `scripts/run_*.sh` | **REAL** | All artifacts present; app boots; tests run | Test suite endorses the hardcoded confidence range & 4-byte tiffs (see C-T1) | LOW |

**Bottom line:** The mandatory capability stack *exists* (adaptation, VQA backbone, real DSP for change/SAR, GUI, weights, tests). What will be disqualifying on judging day is the **integrity layer**: answers assert measurements the system cannot make, the DAG is cosmetic-but-labeled-live, "live" feeds are hardcoded, and 100% REAL SCENES is displayed while 11/12 sectors are simulated.

---

## 3. Findings (evidence-backed)

### 3A — VLM / Answer pipeline (P0)

**A-1 `D1` — Answer is a fabricated template; genuine model output is discarded.**
`backend/app/agent/evidence_builder.py:342-346`:
```python
if vlm_ans:
    answer = vlm_ans
    specialist_model_name = model_name
    confidence = vlm_conf
    engine_active = ai_engine
```
This runs inside the `except` path of Step-2 of `realtime_vlm_agent.py::generate_vlm_answer` (lines 172-184). Because Ollama is unreachable (live health `ollama:"unreachable"`), **every** query exercises this path and the genuine RemoteCLIP softmax answer/confidence are replaced by the template.

**A-2 `D1` — Confidence values are hardcoded constants, not model posteriors.**
`realtime_vlm_agent.py:322` (formula clamp `0.72…0.95`), and literals at lines 338/350/361/372/386 (`0.91/0.89/0.89/0.86/0.87`). The Ollama-success path itself returns hardcoded `0.93` (line ~158). **Probe:** two different sectors answered with identical `confidence: 0.86`.

**A-3 `D1` — Model is mislabeled.**
`realtime_vlm_agent.py:389` returns `"RemoteCLIP-ViT Neural VLM (Apple Silicon MPS / Local Neural)"` for a rule-based template. This string then appears in `telemetry.models_executed` (`evidence_builder.py:432`, taken from `dag_nodes`) and the UI's "PRIMARY_MODEL" export (`RightOperationalPanel.tsx:211`).

**A-4 `D2` — Sensor-processor claims with no implementation.**
Template answers assert `"analyzed via Sentinel-1 DInSAR"`, `"Interferometric displacement tracking identifies localized surface subsidence anomalies"` (`realtime_vlm_agent.py:314-325`). Grep across `backend/` for DInSAR/InSAR/interferometric finds **zero** implementation. A single-frame optical JPEG cannot produce an interferogram.

**A-5 `D2` — Live probe: same answer regardless of geography.**
Query `"Has there been surface subsidence in this area?"`:
- `sector_id=joshimath-subsidence` → *"Interferometric displacement tracking identifies localized surface subsidence anomalies … align with the Sunil Ward Slope"*, conf `0.86`.
- `sector_id=malacca-chokepoint` (open-sea shipping lane) → *"Geotechnical terrain and slope stability assessment across Malacca Strait Maritime Corridor … subsidence anomalies … Groundwork features align with the VLCC Supertankers, indicating active geological displacement"*, conf `0.86`.
- Identical `ai_engine_active:"remoteclip_vlm"`, identical `benchmarkSource:"BigEarthNet.txt (arXiv:2603.29630) & VRSBench"`, `live_satellite_stream: null` in both.

**A-6 `D1` — Timing contradicts telemetry.** Malacca query returned in **144 ms** total, yet telemetry claims RemoteCLIP-ViT + connected-component vectorizer + spectral engine all executed. ViT-B/32 inference alone exceeds this on MPS/CPU.

### 3B — Raster / Geometry layer (P0)

**B-1 `D3` — Non-georeferenced JPEGs produce "georeferenced" EPSG:4326 output.**
`get_sector_rasters` (`sector_assets.py:267-307`) loads `sectors/<id>/optical_t1.jpg` (a JPEG). Those images have no geotransform (upload probe on an identical-style 512×512 jpg returned `is_geotiff:false, crs:"Unprojected / Non-georeferenced"`). Yet the live response contained features with coordinates like `[79.55943, 30.55568]` (WGS84 in the Joshimath bbox) and DAG node-2 asserts `"outputPayload": "CRS: EPSG:4326 | Raster Resolution: GSD 10m"` (`evidence_builder.py:386`). Pixel polygons are projected onto profile bounds — i.e., synthetic georeferencing.

**B-2 `D4` — Identical imagery across distinct sectors.** md5 (verified):
```
optical_t1.jpg  f3c01ba51a2f73837af2362d5b27cc12  == custom-aoi == isro-sac == joshimath-subsidence
optical_t2.jpg  8f6e971bc2f2444cf8c8fd350ff568ba  == custom-aoi == isro-sac == joshimath-subsidence
```
Joshimath (Himalayan subsidence zone) is analyzed from the same pixels as ISRO SAC Ahmedabad, yet every answer cites Joshimath-specific features (`sector_assets.py` key_features, e.g. "Main Central Thrust", "Cracked Masonry Zones").

**B-3 `D3` — Sector provenance.** `SectorProfile` defaults `is_real_image=False, is_simulated=True` (`sector_assets.py:37-38`); only `isro-sac` sets real flags (`:58-59`). Telemetry honestly reports `is_real_image:false / is_simulated:true / "Simulated Sector Demo Raster"` (`evidence_builder.py:427-429`) — but the **answer narrative and DAG do not** carry the disclosure.

### 3C — "Live" data claims (P0/P2)

**C-1 `D5` — Live satellite stream never populated.** `fetch_live_satellite_scene` (`realtime_vlm_agent.py:44`) has **zero callers** across the repo; `QueryResponse.live_satellite_stream` is always `None` (probe-confirmed). Frontend gates the stream card on `queryResponse?.live_satellite_stream &&` (`RightOperationalPanel.tsx:503`) — dead UI — while a static green `label="ONLINE"` pill (`:799`) renders nearby.

**C-2 `D5` — Model status "100% ONLINE" is hardcoded.**
`realtime_vlm_agent.py::get_ai_status` (391-431) hardcodes `status:"online"` for AWS Sentinel-2 STAC, Planetary Computer Sentinel-1, ESRI World Imagery with no probe. `ModelStatusModal.tsx:82-86` mirrors identical hardcoded `'online'` values; `:321` renders literal **"100% REAL SCENES"**. `SituationalFeedDrawer.tsx:88-92` hardcodes an ACTIVE/ONLINE sensor feed including `INSAT-3DR (MOSDAC) … ONLINE` — while health reports MOSDAC `not_configured`.

**C-3 (P2)** `activeAlertsCount={4}` (`App.tsx:767`) is UI-static with no backend feed.

### 3D — Registry / Adapter / Provenance (P1/P2)

**D-1 (P1)** `MODEL_REGISTRY` optical_vqa provenance "800k+ Remote Sensing Image-Caption Pairs" (`registry.py`) — no offline verification possible; paired with **84** actual training samples, it reads aspirational.

**D-2 (P1)** Training-metrics anomalies: heldout top-1 26.92% vs **train** top-1 12.07% (train lower than eval is statistically improbable for 25 fixed-seed epochs); `adapter_architecture` documented as `512 -> 256 -> 512` in `training_metrics.json` but implemented as `512 -> 256` in `remote_clip.py`.

**D-3 (P2)** Per-feature "confidence" is hand-crafted, not neural: `remote_clip.py:419` `min(0.98, confidence_threshold + 0.05*(rank==0))`, and fallback class `"institutional_facility", 0.85` when tokenizer missing (`:526`).

**D-4 (P2)** Hardcoded metric stand-ins for the VLM across engines: spectral fallbacks `{0.42,0.38}`/`{0.35,0.45}` (`evidence_builder.py:188,272`), `piercedCloudPercent 94.2` / `mean_db -14.2` (`:224,226`), `temporalInterval "T1: March 2024 -> T2: May 2024"` (`:159`), `"benchmarkSource"` same literal every response (`:419`), `specialist_latency_ms 40.0` / `vectorizer_latency_ms 10.0` defaults (`:127-128`).

**D-5 (P2)** `sar_fusion.py:217` fixed `0.82` when no features; `geotiff_parser.py:100-101` unknown-CRS → hardcoded `gsd_meters=10.0`; `geotiff_parser.py:310` fake `sar_db = 10*log10(albedo²) − 14`; sector timeline "deterministic" uses Python `hash()` which is **re-randomized per process** (`sector_assets.py:406`).

### 3E — API / Upload (P1)

**E-1 (P1) `D7` — Garbage raster acceptance.** Live probe: a **4-byte** file (PNG magic in a `.tif` name) was accepted by `POST /api/upload` as `status:"success"`, reported as a valid 512×512/3-band optical raster, and persisted to `data/sample/uploads/`. `routes_upload.py:29,113-140` falls through to PIL-based parsing for any `.png/.jpg/.tif`. This also explains the pre-existing attack-shaped `file_00.php_*.tif` files found in uploads. (My audit probe added one such file; recommend cleanup.)

**E-2 (P2)** GeoJSON branch silently swallows parse errors (`routes_upload.py:110-111`) and falls through to raster handling; `inspect_pixel_point` uses a default bbox `[72.5,23.015,72.54,23.035]` when none supplied (`routes_upload.py:172`).

### 3F — Tests (P1)

`48 passed in 32.5s`. The suite passes because it asserts **presence and shapes, not truth**:
- `test_api.py:68` `confidence >= 0.70` and `test_api.py:91` `0.72 <= confidence <= 0.95` — fixtures that enshrine the hardcoded clamp as correct.
- `test_api.py:66-70` claims "Real RemoteCLIP model execution assertions" but only checks `telemetry[...]>0` and `pipeline_status=="operational"` — it endorses the mislabeled telemetry.
- `test_integration.py::test_upload_minimal_tiff_then_inspect` — explicitly blesses minimal (essentially empty) TIFFs as valid.
- `test_security.py` path-traversal/size tests are real and pass; the 4-byte-content bypass is untested.

### 3G — Frontend truth-rating

| Component | Claim | Reality | Rating |
|---|---|---|---|
| `ModelStatusModal.tsx:82-86,321` | "100% REAL SCENES", feeds `online` | Hardcoded values; 11/12 sectors simulated | **FABRICATED (P0)** |
| `SituationalFeedDrawer.tsx:88-92` | ACTIVE/ONLINE sensor passes incl. MOSDAC | Hardcoded array; MOSDAC `not_configured` | **FABRICATED (P1)** |
| `RightOperationalPanel.tsx:767,799` | SAR "100% (All-Weather)", pill "ONLINE" | Static labels; stream card never renders | **HARDCODED (P2)** |
| `RightOperationalPanel.tsx:194-211,581` | "Verified via …" + PRIMARY_MODEL | Re-prints mislabeled telemetry + hardcoded benchmarkSource | **MISLABELED (P1)** |
| `TemporalScrubber.tsx:177` | `is_simulated` badge on passes | Pass data honestly labeled simulated | **honest (positive)** |
| `HeaderHUD.tsx:100-104` | Model badge mirrors `/api/settings/ai-status` | Explicit honesty fix; comment present | **honest (positive)** |
| `timelineConstellation.ts:61,125` | Constellation passes | `"ALL PASSES ARE SIMULATED by construction — not live STAC acquisitions"` in source | **honest (positive)** |
| `AuditStudio.tsx:228-231` | Data provenance panel | "LABELED SAMPLE / SIMULATED DATA (Fallback Only)" note incl. "procedural baselines" | **honest (positive)** |
| `MapCanvas.tsx:1332,1485` | Simulated-pin badges | Pins carry `is_simulated`; tacticalData.ts marks 2 pins real — both isro-sac flavored (`:23`, `:302`, effectively a duplicate of the single real sector) — rest simulated | **honest (positive; duplicate pin = P2)** |
| `App.tsx:767` | `activeAlertsCount={4}` | Static value, no feed (default 3 in HeaderHUD) | **HARDCODED (P2)** |

### 3H — What is REAL and defensible (present these)
Classical DSP engines (`change_detector.py`, `sar_fusion.py`, `geotiff_parser.py`) — genuine pixel math with honest confidence from Otsu separability. RemoteCLIP cos-sim + softmax VQA backbone. The 605 MB annotated weights + training log (weak but real). Upload sanitization + size cap + path-traversal guards, CORS/security headers/API-key auth. Honest telemetry provenance flags (`evidence_builder.py:427-429`) and honest ISO simulated badges in the UI.

---

## 4. Phased Remediation (before the 30 Sep deadline)

### Phase A — Remove disqualifying fabrications (do FIRST, ~1-2 days)
1. **Kill the template VLM.** `realtime_vlm_agent.py`: delete `_synthesize_local_neural_reasoning` output from the fallback path; surface ONLY genuine outputs (Ollama *or* RemoteCLIP `calibrated_confidence`), and when neither runs, return `answer=null / confidence=null / status:"degraded"` + a real error message — never a fake measurement.
2. **Remove DInSAR/InSAR/subsidence language** from all templates and sector key_features-driven claims; state actual capabilities (optical NDWI/NDVI, SAR backscatter, spatio-temporal change).
3. **Bound the DAG to reality.** dagNodes must reflect the actual executed pipeline (status from a real execution map, latencies from timers, latencies of nodes that did not run = `null`). Drop the "CRS: EPSG:4326 / GSD 10m" outputPayload for non-georeferenced rasters; stop labeling image-derived polygons "georeferenced".
4. **Honest provenance in the answer + DAG**, not only telemetry: prefix answers for simulated sectors with "SIMULATED SECTOR DATA — not satellite-acquired" and propagate `is_simulated` into the UI's visible claims; replace "100% REAL SCENES".
5. **Populate or disable the live stream.** Wire `fetch_live_satellite_scene` to the STAC search results (or delete the feature) so `live_satellite_stream` is either real or absent; stop rendering static ONLINE pills and the hardcoded SituationalFeedDrawer values against a `not_configured` backend.
6. **Unique imagery per sector** or drop sector-specific claims: either correct the sector assets, or collapse all non-real sectors to a single honestly-labeled "Demo AOI" with no geography-specific assertions.

### Phase B — Credibility (next 2-3 days)
7. Probe `get_ai_status` live sources; report real reachability, not `online` constants; surface `degraded` in the UI.
8. Fix `benchmarkSource` to reflect the datasets actually used by the executed path; if none used, omit it.
9. Validate uploads by raster magic bytes (`rasterio.open` only on real TIFF/GeoTIFF or PIL-verified images); reject <~1 KB garbage; review existing `file_00.php_*` files; add content-magic tests.
10. Re-tune or recompute adapter metrics honestly (report the 84-sample caveat + CI in the App's own disclosure via `AccuracyDisclosure.tsx`); reconcile `512->256 (->512)` doc vs code; drop or refute the "800k+ pairs" provenance string.
11. Fix confidence paths: real model posterior when the model runs; `null` otherwise (replace the `0.72-0.95` clamp test with "confidence present only when a model executed").
12. Sector timeline: replace per-process-random `hash()` with a stable seed (e.g. `zlib.crc32`), or mark the schedule "demo".

### Phase C — Polish (if time remains)
13. Remove hardcoded spectral/cloud/dB fallbacks from VLM inputs or label them as "no-data defaults"; correct `geotiff_parser` UTM GSD bug; expose `sar_db` as optical-proxy, not SAR; align `activeAlertsCount`; add the honest provenance badge next to the DAG panel; document limitations in the live-demo script.
14. Re-run the full suite after A; extend `test_api.py` to assert "synthesis never leaks into real answers" and "upload rejects ≤512-Byte non-raster files".

---

## 5. What Could Not Be Verified

- **Ollama LLM path** — `ollama` process unreachable during audit; the genuine `qwen2.5:3b` response (and its hardcoded `0.93`) could not be observed live.
- **Checkpoint provenance** — `RemoteCLIP-ViT-B-32.pt` opens and runs on MPS, but its origin (which pretrained open_clip release) was not verified against a hash registry.
- **"800k+ Remote Sensing Image-Caption Pairs"** claim in `MODEL_REGISTRY` — no offline evidence; network/STAC backends aside, this specific dataset claim is unverifiable offline.
- **Visual content of sector images** — this model cannot view images; cross-sector identity was proven via byte hashes only. Verify visually that `galwan-sar`, `diego-garcia`, `pokhran`, etc. depict their named geographies.
- **True ground truth for "Simulated Sector Demo Raster"** rasters — whether any sector file is a real satellite acquisition of its named location remains unknown without georeferenced metadata (all load as unprojected JPEG/PNG).
- **STAC + Planetary Computer pipelines** — `stac_element84` returned `ok` at health time, but full search/download flows were not exercised live.
- **Frontend end-to-end flow** — components inspected statically; no browser run was performed.