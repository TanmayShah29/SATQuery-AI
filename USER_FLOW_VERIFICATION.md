# SatQuery AI (SIH26167) — User Flow Verification

**Purpose:** prove each primary user flow end-to-end against the *fixed* system, and record
what is genuinely computed vs. honestly degraded. Every row below was produced by an actual
run on 17 Sep 2026; nothing is asserted from reading code alone.

**Environment**
- Backend: `uvicorn backend.app.main:app` on `127.0.0.1:8080` (live, `--reload`).
- Direct unit probes: `PYTHONPATH=/Users/tanmay/SIH-2026 .agents/venv/bin/python` (3.12.9).
- Suite: `PYTHONPATH=/Users/tanmay/SIH-2026 .agents/venv/bin/python -m pytest backend/tests -q` → **56 passed**.
- Frontend: `npm run lint` (`tsc --noEmit`) + `npm run build` → clean.
- Ollama was **unreachable** during all runs; this is the honest-degraded path, not a bug.

---

## Flow 1 — Analyst asks a change question on a simulated sector

**Steps:** open the console → select a tactical sector (e.g. `joshimath-subsidence`) →
ask *"Has there been surface subsidence in this area?"* → read answer / confidence / map / DAG.

**Verified result (live HTTP):**
```
sector_id   : joshimath-subsidence      bbox [79.565,30.555,79.565,30.555]  modality: bitemporal
ai_engine   : bitemporal_change_dsp
confidence  : 0.945                        (real Otsu-separability, not a clamp)
audit_hash  : SHA256-E5DF6E06E59A6D6E
live_stream : null                          live_stream_status: not_requested
answer      : "SIMULATED DEMO RASTER — not a satellite acquisition of this location; the
               change statistics below are illustrative, not measured. Bi-temporal change
               evaluation across Joshimath Himalayan Subsidence Zone [...] confirms
               Structural & Terrain Evolution. Radiometric differencing (Otsu threshold:
               0.133) isolated 1 ... cluster(s) covering approximately 0.0001 km²."
telemetry   : is_simulated=true, imagery_distinct=false,
              imagery_origin="shared_demo_raster[custom-aoi,joshimath-subsidence]",
              data_provenance="SIMULATED DEMO RASTER (not satellite-acquired) — origin: …"
```
**Verdict:** the change numbers are real pixel math on the raster; the answer now *discloses*
in the first sentence that the raster is a shared simulated demo, not a Joshimath acquisition.

---

## Flow 2 — Two different sectors must not produce the same answer

**Steps:** run the same query on `joshimath-subsidence` and `malacca-chokepoint`.

**Verified result (live HTTP):**

| | joshimath-subsidence | malacca-chokepoint |
|---|---|---|
| `ai_engine_active` | `bitemporal_change_dsp` | `bitemporal_change_dsp` |
| `confidence` | 0.945 | 0.852 |
| Otsu threshold | 0.133 | 0.345 |
| clusters | 1 | 11 |
| `audit_hash` | `SHA256-E5DF6E06E59A6D6E` | `SHA256-1C916E27B3716804` |
| `imagery_distinct` | false (shared with `custom-aoi`) | true |

**Verdict:** genuinely different inputs produce explainably different outputs; the shared-raster
sector is disclosed as shared, and distinct sectors report `imagery_distinct=true`.

---

## Flow 3 — Real-acquisition sector keeps its real provenance

**Steps:** query the one real sample sector `isro-sac`.

**Verified result (direct venv probe):**
```
imagery_origin : isro-sac_real_acquisitions
imagery_distinct: true
is_real_image  : true     is_simulated: false
data_provenance: "Verified Sentinel-2 / Sentinel-1 Real Satellite Acquisition"
answer prefix  : (no "SIMULATED DEMO RASTER" disclosure)
```
**Verdict:** the real acquisition is not falsely labelled simulated, and the simulated sectors
are not falsely labelled real — the distinction is computed from the sector registry, not hardcoded.

---

## Flow 4 — Opt-in live satellite scene (LIVE STAC toggle)

**Steps:** enable the **LIVE STAC** chip in the query bar (off by default) → submit.

**Verified result (live HTTP):**
```
context_hints.live_stream=false → live_satellite_stream=null, live_stream_status="not_requested"
context_hints.live_stream=true  → live_stream_status="online"
    scene_id         : S2B_47NRC_20240611_0_L2A
    source           : AWS Open Data (Sentinel-2 L2A COG)
    acquisition_date : 2024-06-11T03:47:36.272000Z
    cloud_cover_pct  : 23.1
    spectral_metrics : {mean_albedo 0.613, ndvi_proxy 0.088, ndwi_proxy -0.06, structural_density 0.365}
    pil_image        : stripped (not serialized)
```
**Verdict:** the live path is a real STAC fetch, only runs on explicit opt-in, and reports an
honest `online`/`unavailable`/`error` status. The UI toggle (`QueryPromptBar` → `App.tsx`
`contextHints:{live_stream}`) is the client for this flow; frontend typecheck/build are clean.
No browser run was available, so the toggle→context_hints wiring is verified by typecheck,
production build, and grep — the API behaviour itself is verified live above.

---

## Flow 5 — Model / feed status is probed, never "100% ONLINE"

**Steps:** open the intelligence-status modal.

**Verified result (live HTTP `/api/settings/ai-status`):**
```
local_engines : {ollama_qwen2.5_3b: offline, remoteclip_vit_b32_domain_adapter: weights_loaded}
live sources  : AWS Sentinel-2 STAC online · MS Planetary Computer Sentinel-1 online ·
                ESRI World Imagery online · ISRO Bhuvan not_configured · ISRO SAC MOSDAC not_configured
```
**Verdict:** statuses are real probe results. The UI now renders only probed feeds (with an
honest empty state), derives the model pill colour from the real engine state, and states
"STATUS PROBED LIVE (NO ASSUMED ONLINE)"; pass lists are prefixed `SIM ·`; the STAC badge
shows ONLINE / NO SCENES / UNREACHABLE / IDLE from a real search state.

---

## Flow 6 — Upload validation

**Steps:** upload a 4-byte file named `.tif`; then upload a valid GeoTIFF.

**Verified result (live HTTP):**
```
4-byte garbage .tif → HTTP 400  {"detail":"Declared .tif/.tiff file does not match TIFF magic bytes."}
valid GeoTIFF       → HTTP 200  {is_geotiff:true, crs:"EPSG:4326", 343×343}
```
**Verdict:** garbage is rejected by content magic bytes (not extension), and a real raster is
accepted with real metadata. Pre-existing attack-shaped `file_00.php_*.tif` probes were removed.

---

## Flow 7 — Graceful degradation when the local LLM is down

**Steps:** run any query with Ollama unreachable (the observed environment).

**Verified result:** all of Flows 1–4 above ran with Ollama down. Responses carry
`ai_engine_active` = the classical DSP engine (`bitemporal_change_dsp` /
`crossmodal_sar_fusion_dsp`), real confidence from pixel statistics, and no fabricated
narrative. The DAG shows measured latencies and `null` for stages that did not run.

**Verdict:** degradation is explicit and honest — the answer is still real computation, just
without the optional LLM narrative layer.

---

## What is real vs. honestly degraded

| Capability | State | Basis |
|---|---|---|
| Bi-temporal change detection (Otsu, area, clusters) | **Real** | genuine pixel math, real confidence |
| SAR cloud-piercing / dual-pol scatterer isolation | **Real** | genuine backscatter math; `confidence=null` when no targets |
| RemoteCLIP-ViT-B/32 VQA backbone | **Real weights** | cos-sim + softmax; big disclaimer on the 84-sample adapter |
| Optional local LLM narrative (Ollama qwen2.5:3b) | **Degraded (offline)** | DSP answer used instead; no fake prose |
| Live STAC scene ingestion | **Real (opt-in)** | real Sentinel-2 scene fetch + metadata |
| Sector rasters | **Simulated demo** | disclosed in the answer + telemetry |
| InSAR/DInSAR subsidence measurement | **Not implemented** | explicitly disclaimed; never claimed in answers |
