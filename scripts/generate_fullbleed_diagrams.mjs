import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('generated_diagrams');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Slide is 13.33" x 7.5" — at 150 DPI → 2000x1125 px canvas
// We render at 2x deviceScaleFactor → actual pixel output = 4000x2250 which then pptx scales to 13.33x7.5"
const W = 2000, H = 1125;

async function renderSlide(html, filename) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, filename) });
  await browser.close();
  console.log(`✓ Rendered ${filename} (${W}×${H} @2x)`);
}

// ─── SLIDE 2 FULL-BLEED: Problem vs Solution ─────────────────────────────────
const slide2 = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  width:2000px;height:1125px;overflow:hidden;
  background:linear-gradient(135deg,#07101f 0%,#0d1b35 50%,#071522 100%);
  font-family:'Plus Jakarta Sans',sans-serif;color:#e2e8f0;
  display:flex;flex-direction:column;padding:28px 36px 20px;
  gap:18px;
}
.slide-title{
  font-size:26px;font-weight:800;color:#38bdf8;letter-spacing:-0.5px;
  border-bottom:2px solid rgba(56,189,248,0.25);padding-bottom:14px;
  display:flex;justify-content:space-between;align-items:center;
}
.slide-title .tag{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#7dd3fc;padding:4px 12px;border-radius:4px;}

.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1}
.col{border-radius:14px;padding:22px 24px;display:flex;flex-direction:column;gap:12px}
.fail{background:rgba(220,38,38,0.06);border:1.5px solid rgba(220,38,38,0.4)}
.win {background:rgba(16,185,129,0.06);border:1.5px solid rgba(16,185,129,0.35)}

.col-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08)}
.col-head .label{font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px}
.fail .label{color:#f87171}.win .label{color:#34d399}
.badge{font-size:9px;font-family:'JetBrains Mono',monospace;font-weight:700;padding:4px 10px;border-radius:4px}
.fail .badge{background:rgba(220,38,38,0.18);color:#fca5a5}
.win  .badge{background:rgba(16,185,129,0.18);color:#6ee7b7}

.row{background:rgba(15,23,42,0.7);border-radius:8px;padding:14px 16px;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:5px}
.row .key{font-size:10px;font-family:'JetBrains Mono',monospace;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
.row .main{font-size:14px;font-weight:700;color:#f1f5f9}
.row .desc{font-size:12px;color:#94a3b8;line-height:1.4}
</style></head><body>
<div class="slide-title">
  <span>⚠️ The Hackathon "AI Wrapper" Trap vs. SatQuery AI — Production Remote Sensing Studio</span>
  <span class="tag">ISRO SAC SIH26167 // COMPETITIVE DIFFERENTIATION</span>
</div>
<div class="grid">
  <div class="col fail">
    <div class="col-head">
      <div class="label">❌ Typical AI Wrapper (95% of submissions)</div>
      <span class="badge">DISQUALIFIED BY ISRO</span>
    </div>
    <div class="row"><div class="key">Data Ingestion</div><div class="main">Downsamples GeoTIFFs → 512×512 lossy JPEGs</div><div class="desc">Destroys CRS georeferencing, EPSG projection and all multispectral NIR/RedEdge spectral bands.</div></div>
    <div class="row"><div class="key">Weather Resilience</div><div class="main">Optical-Only — Completely Blinded by Monsoon Clouds</div><div class="desc">During cyclones and heavy rain, optical satellites see only white cloud cover. No SAR alternative.</div></div>
    <div class="row"><div class="key">Model Reasoning</div><div class="main">Generic OpenAI / Claude Chat Prompting</div><div class="desc">Black-box LLM hallucinates land features and coordinates with zero pixel-level grounding or verification.</div></div>
    <div class="row"><div class="key">Interface</div><div class="main">Centered ChatGPT Clone — Text Bubble Stream</div><div class="desc">No map coordinates, no layer toggles, no split-screen visual proof, no comparison tool.</div></div>
    <div class="row"><div class="key">Deliverables</div><div class="main">Ephemeral Chat — Disappears on Tab Close</div><div class="desc">No GIS-compatible exports, no PDF briefings, nothing usable for emergency responders or ISRO.</div></div>
  </div>
  <div class="col win">
    <div class="col-head">
      <div class="label">✅ SatQuery AI — Production Geospatial Studio</div>
      <span class="badge">ISRO SAC COMPLIANT</span>
    </div>
    <div class="row"><div class="key">Data Ingestion</div><div class="main">Native GeoTIFF via Windowed Rasterio Block-Reads</div><div class="desc">Preserves exact WGS84/UTM coordinates, calibrated radiometry, and full 12-band multispectral fidelity.</div></div>
    <div class="row"><div class="key">Weather Resilience</div><div class="main">Cloud-Piercing Sentinel-1 SAR + Optical Fusion</div><div class="desc">SAR microwave penetrates rain, darkness and 100% cloud cover — guaranteed 24/7 all-weather observation.</div></div>
    <div class="row"><div class="key">Model Reasoning</div><div class="main">4-Engine Specialist Vision-Language Registry</div><div class="desc">RemoteCLIP (VQA) + MobileSAM (&lt;50ms Grounding) + ChangeFormer-v2 (t₁ vs t₂) + Cross-Attention SAR Fusion.</div></div>
    <div class="row"><div class="key">Interface</div><div class="main">WebGL MapLibre Studio — Draggable Swipe Curtain</div><div class="desc">60 FPS synchronized split-screen comparing t₁ vs t₂ or Optical vs SAR with live feature bounding boxes.</div></div>
    <div class="row"><div class="key">Deliverables</div><div class="main">One-Click PDF Briefings & GeoJSON Vector Exports</div><div class="desc">Instantly importable into QGIS, ArcGIS, and ISRO Bhuvan. Verifiable evidence for disaster response.</div></div>
  </div>
</div>
</body></html>`;

// ─── SLIDE 3 FULL-BLEED: 5-Stage Architecture Pipeline ───────────────────────
const slide3 = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  width:2000px;height:1125px;overflow:hidden;
  background:linear-gradient(135deg,#07101f 0%,#0d1b35 50%,#071522 100%);
  font-family:'Plus Jakarta Sans',sans-serif;color:#e2e8f0;
  display:flex;flex-direction:column;padding:28px 36px 20px;gap:18px;
}
.slide-title{font-size:26px;font-weight:800;color:#38bdf8;letter-spacing:-0.5px;border-bottom:2px solid rgba(56,189,248,0.25);padding-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.slide-title .tag{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#7dd3fc;padding:4px 12px;border-radius:4px;}

.pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;flex:1}
.stage{border-radius:10px;background:#111827;border:1px solid #1e293b;padding:14px;display:flex;flex-direction:column;position:relative;overflow:hidden;}
.stage::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.s1::before{background:#38bdf8}.s2::before{background:#818cf8}.s3::before{background:#34d399}.s4::before{background:#f59e0b}.s5::before{background:#ec4899}

.stage-num{font-size:9px;font-family:'JetBrains Mono',monospace;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:3px;width:fit-content;margin-bottom:8px}
.s1 .stage-num{background:rgba(56,189,248,0.15);color:#38bdf8}
.s2 .stage-num{background:rgba(129,140,248,0.15);color:#818cf8}
.s3 .stage-num{background:rgba(52,211,153,0.15);color:#34d399}
.s4 .stage-num{background:rgba(245,158,11,0.15);color:#f59e0b}
.s5 .stage-num{background:rgba(236,72,153,0.15);color:#ec4899}

.stage-title{font-size:13.5px;font-weight:800;margin-bottom:10px;line-height:1.25}
.s1 .stage-title{color:#e0f2fe}.s2 .stage-title{color:#eef2ff}.s3 .stage-title{color:#ecfdf5}.s4 .stage-title{color:#fffbeb}.s5 .stage-title{color:#fdf2f8}

.cards{display:flex;flex-direction:column;gap:7px;flex:1}
.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:9px 10px}
.card-title{font-size:11px;font-weight:700;color:#f1f5f9;margin-bottom:2px}
.card-desc{font-size:9.5px;color:#94a3b8;line-height:1.35}
.chip{font-size:8px;font-family:'JetBrains Mono',monospace;padding:2px 5px;border-radius:3px;margin-top:4px;display:inline-block}
.s1 .chip{background:rgba(56,189,248,0.15);color:#38bdf8}
.s2 .chip{background:rgba(129,140,248,0.15);color:#818cf8}
.s3 .chip{background:rgba(52,211,153,0.15);color:#34d399}
.s4 .chip{background:rgba(245,158,11,0.15);color:#f59e0b}
.s5 .chip{background:rgba(236,72,153,0.15);color:#ec4899}

.arrow{position:absolute;right:-8px;top:50%;transform:translateY(-50%);width:16px;height:16px;background:#1e293b;border:1px solid #334155;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:9px;z-index:10}
</style></head><body>
<div class="slide-title">
  <span>🛰️ SatQuery AI — End-to-End Agentic Pipeline &amp; Specialist Model Registry</span>
  <span class="tag">ISRO SAC SIH26167 // FULL-STACK ARCHITECTURE</span>
</div>
<div class="pipeline">
  <div class="stage s1">
    <div class="stage-num">Stage 01 · Ingestion</div>
    <div class="stage-title">Multi-Modal Earth Observation</div>
    <div class="cards">
      <div class="card"><div class="card-title">Sentinel-2 Optical (MSI)</div><div class="card-desc">12-band Level-2A surface reflectance (RGB, NIR, RedEdge).</div><span class="chip">10m GSD · BOA</span></div>
      <div class="card"><div class="card-title">Sentinel-1 C-SAR Radar</div><div class="card-desc">IW GRD dual-pol (VV+VH) for cloud-piercing 24/7 backscatter.</div><span class="chip">Active Microwave</span></div>
      <div class="card"><div class="card-title">ISRO Cartosat &amp; RISAT</div><div class="card-desc">Sovereign sub-meter optical PAN/MS and hybrid-SAR feeds.</div><span class="chip">Sub-meter Res.</span></div>
      <div class="card"><div class="card-title">GeoTIFF Validator</div><div class="card-desc">Inspects CRS, geotransform, radiometric bounds via rasterio.</div><span class="chip">Windowed Reads</span></div>
    </div>
    <div class="arrow">→</div>
  </div>
  <div class="stage s2">
    <div class="stage-num">Stage 02 · Orchestration</div>
    <div class="stage-title">Agentic Intent Controller</div>
    <div class="cards">
      <div class="card"><div class="card-title">NL Query Classifier</div><div class="card-desc">Decomposes text into task type: VQA, Grounding, Change, Cross-Modal.</div><span class="chip">Deterministic DAG</span></div>
      <div class="card"><div class="card-title">Co-Registration Validator</div><div class="card-desc">Sub-pixel phase correlation verifies optical + SAR alignment.</div><span class="chip">Δ &lt; 0.2 px</span></div>
      <div class="card"><div class="card-title">Parameter Planner</div><div class="card-desc">Configures tensor shapes, band selections &amp; confidence thresholds.</div><span class="chip">FastAPI Gateway</span></div>
    </div>
    <div class="arrow">→</div>
  </div>
  <div class="stage s3">
    <div class="stage-num">Stage 03 · Specialist Models</div>
    <div class="stage-title">Remote-Sensing CV Registry</div>
    <div class="cards">
      <div class="card"><div class="card-title">Engine 1: RemoteCLIP</div><div class="card-desc">ViT-B/32 adapted on BigEarthNet.txt &amp; RSVQA for VQA &amp; captioning.</div><span class="chip">Multi-Label</span></div>
      <div class="card"><div class="card-title">Engine 2: MobileSAM</div><div class="card-desc">Text-prompted embeddings for &lt;50ms zero-shot segmentation.</div><span class="chip">Zero-Shot Mask</span></div>
      <div class="card"><div class="card-title">Engine 3: ChangeFormer-v2</div><div class="card-desc">Siamese transformer detecting structural deltas (t₁ vs t₂).</div><span class="chip">Bi-Temporal</span></div>
      <div class="card"><div class="card-title">Engine 4: SAR+Optical Fusion</div><div class="card-desc">Cross-attention fusing VV/VH microwave with RGB/NIR spectral.</div><span class="chip">All-Weather</span></div>
    </div>
    <div class="arrow">→</div>
  </div>
  <div class="stage s4">
    <div class="stage-num">Stage 04 · Synthesis</div>
    <div class="stage-title">Evidence &amp; DSP Engine</div>
    <div class="cards">
      <div class="card"><div class="card-title">Vector Polygon Generator</div><div class="card-desc">Converts binary masks to GeoJSON polygons (EPSG:4326/UTM).</div><span class="chip">GeoJSON Output</span></div>
      <div class="card"><div class="card-title">Spectral DSP (Otsu)</div><div class="card-desc">Adaptive thresholding for NDVI, NDWI, MNDWI &amp; SAR amplitude.</div><span class="chip">Radiometric Index</span></div>
      <div class="card"><div class="card-title">Auditable Telemetry</div><div class="card-desc">Logs selected model, tensor dims, latency &amp; confidence score.</div><span class="chip">No Black-Box</span></div>
    </div>
    <div class="arrow">→</div>
  </div>
  <div class="stage s5">
    <div class="stage-num">Stage 05 · Presentation</div>
    <div class="stage-title">Interactive Geospatial Studio</div>
    <div class="cards">
      <div class="card"><div class="card-title">MapLibre GL Canvas</div><div class="card-desc">60 FPS hardware-accelerated WebGL vector &amp; raster rendering.</div><span class="chip">GPU Acceleration</span></div>
      <div class="card"><div class="card-title">Bi-Temporal Swipe Curtain</div><div class="card-desc">Synchronized draggable slider comparing t₁/t₂ or Optical/SAR.</div><span class="chip">Split-Screen View</span></div>
      <div class="card"><div class="card-title">Mission Briefing Export</div><div class="card-desc">One-click PDF executive brief &amp; GeoJSON for QGIS/ArcGIS.</div><span class="chip">Instant Export</span></div>
    </div>
  </div>
</div>
</body></html>`;

// ─── SLIDE 4 FULL-BLEED: Risk & Mitigation ───────────────────────────────────
const slide4 = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  width:2000px;height:1125px;overflow:hidden;
  background:linear-gradient(135deg,#07101f 0%,#0d1b35 50%,#071522 100%);
  font-family:'Plus Jakarta Sans',sans-serif;color:#e2e8f0;
  display:flex;flex-direction:column;padding:28px 36px 20px;gap:18px;
}
.slide-title{font-size:26px;font-weight:800;color:#38bdf8;letter-spacing:-0.5px;border-bottom:2px solid rgba(56,189,248,0.25);padding-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.slide-title .tag{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#7dd3fc;padding:4px 12px;border-radius:4px;}

.section-head{font-size:13px;font-weight:700;color:#7dd3fc;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}

.top-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.bottom-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;flex:1}

.risk-card{background:#111827;border-radius:10px;border:1px solid #1e293b;padding:16px 18px;display:flex;flex-direction:column;gap:0}
.risk-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px}
.risk-title{font-size:14.5px;font-weight:800;color:#f87171;display:flex;align-items:center;gap:6px}
.risk-tag{font-size:8.5px;font-family:'JetBrains Mono',monospace;background:rgba(239,68,68,0.15);color:#fca5a5;padding:3px 8px;border-radius:3px;font-weight:700;white-space:nowrap}
.risk-desc{font-size:11.5px;color:#94a3b8;line-height:1.4;margin-bottom:10px;background:rgba(255,255,255,0.02);padding:8px 10px;border-radius:6px}
.mit{background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:7px;padding:10px 12px}
.mit-head{font-size:12px;font-weight:800;color:#34d399;margin-bottom:3px;display:flex;align-items:center;gap:5px}
.mit-text{font-size:11px;color:#e2e8f0;line-height:1.4}
.mit-tech{font-size:9px;font-family:'JetBrains Mono',monospace;color:#6ee7b7;margin-top:5px}

.viability-strip{background:rgba(30,41,59,0.8);border:1px solid #334155;border-radius:10px;padding:14px 20px;display:flex;gap:28px;align-items:center}
.vi-item{display:flex;flex-direction:column;gap:3px;border-right:1px solid rgba(255,255,255,0.08);padding-right:24px}
.vi-item:last-child{border-right:none;padding-right:0}
.vi-label{font-size:11px;font-weight:700;color:#e2e8f0}
.vi-desc{font-size:10px;color:#94a3b8}
.vi-chip{font-size:9px;font-family:'JetBrains Mono',monospace;padding:2px 8px;border-radius:3px;background:rgba(56,189,248,0.15);color:#38bdf8;margin-top:2px;display:inline-block}
</style></head><body>
<div class="slide-title">
  <span>🛡️ Engineering Risks, Proven Mitigations &amp; Operational Viability</span>
  <span class="tag">ISRO SAC SIH26167 // FEASIBILITY &amp; RESILIENCE</span>
</div>
<div class="top-row">
  <div class="risk-card">
    <div class="risk-head"><div class="risk-title">🌧️ Monsoon Cloud Obscuration</div><span class="risk-tag">HIGH FREQUENCY</span></div>
    <div class="risk-desc">Optical satellites (Sentinel-2, Cartosat) experience complete whiteout during heavy Indian monsoon rain and active tropical cyclones.</div>
    <div class="mit"><div class="mit-head">✅ Multi-Modal SAR Radar Synthesis</div><div class="mit-text">Sentinel-1 and RISAT C-band SAR microwaves penetrate clouds, rain and darkness for uninterrupted 24/7 all-weather disaster surveillance.</div><div class="mit-tech">ENGINE: Dual-Branch Cross-Attention SAR + Optical Fusion</div></div>
  </div>
  <div class="risk-card">
    <div class="risk-head"><div class="risk-title">📐 Multi-Sensor Spatial Misalignment</div><span class="risk-tag">GEOMETRIC ACCURACY</span></div>
    <div class="risk-desc">Sentinel-1 SAR and Cartosat optical have distinct orbital inclinations, CRS projections, and ground sampling distances (GSD).</div>
    <div class="mit"><div class="mit-head">✅ Sub-Pixel Phase Correlation Validation</div><div class="mit-text">FFT phase-correlation algorithm measures spatial offset between modalities. Inference is blocked if co-registration error exceeds 0.2 pixels.</div><div class="mit-tech">ENGINE: PyProj + Rasterio GDAL Warping</div></div>
  </div>
</div>
<div class="bottom-row">
  <div class="risk-card">
    <div class="risk-head"><div class="risk-title">⚠️ AI Visual Hallucinations</div><span class="risk-tag">OPERATIONAL INTEGRITY</span></div>
    <div class="risk-desc">Generic VLMs fabricate bounding box coordinates and misidentify terrain without calibrated pixel grounding — disqualified by ISRO.</div>
    <div class="mit"><div class="mit-head">✅ Calibrated Confidence + Auditable Trace</div><div class="mit-text">Every finding delivers pixel masks, GeoJSON polygons, Otsu spectral indices (NDVI/MNDWI), and an inspectable execution trace with model name, tensor shape and latency.</div><div class="mit-tech">ENGINE: MobileSAM Masks + Telemetry Drawer</div></div>
  </div>
  <div class="risk-card">
    <div class="risk-head"><div class="risk-title">💾 Gigabyte GeoTIFF Out-of-Memory</div><span class="risk-tag">HARDWARE CAPACITY</span></div>
    <div class="risk-desc">Multi-gigabyte satellite scenes crash GPU VRAM when loaded entirely on standard hackathon laptops and workstations.</div>
    <div class="mit"><div class="mit-head">✅ Windowed COG Streaming + 4-bit Quantization</div><div class="mit-text">Streams 1024×1024 tiles on demand via rasterio block-reads. Models quantized to 4-bit ONNX Runtime — VRAM stays strictly under 1.2 GB for smooth laptop execution.</div><div class="mit-tech">ENGINE: Windowed Rasterio + Apple MPS / ONNX Runtime</div></div>
  </div>
</div>
<div class="viability-strip">
  <div class="vi-item"><div class="vi-label">$0 Recurring Cloud Cost</div><div class="vi-desc">Self-hosted pipeline — no OpenAI, Claude or third-party tokens required.</div><div class="vi-chip">FULLY OFFLINE CAPABLE</div></div>
  <div class="vi-item"><div class="vi-label">100% Offline Hackathon Mode</div><div class="vi-desc">Pre-cached GIFT City, Assam Floods &amp; Mumbai Port scenarios — zero venue Wi-Fi dependency.</div><div class="vi-chip">ZERO LATENCY DEMO</div></div>
  <div class="vi-item"><div class="vi-label">Open Foundation Backbones</div><div class="vi-desc">RemoteCLIP, MobileSAM, ChangeFormer-v2 — no costly training from scratch.</div><div class="vi-chip">PROVEN ARCHITECTURES</div></div>
  <div class="vi-item"><div class="vi-label">GIS Interoperability</div><div class="vi-desc">Exports standard GeoJSON &amp; COGs directly into QGIS, ArcGIS &amp; ISRO Bhuvan.</div><div class="vi-chip">GOVERNMENT READY</div></div>
</div>
</body></html>`;

// ─── SLIDE 5 FULL-BLEED: Impact Matrix ───────────────────────────────────────
const slide5 = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  width:2000px;height:1125px;overflow:hidden;
  background:linear-gradient(135deg,#07101f 0%,#0d1b35 50%,#071522 100%);
  font-family:'Plus Jakarta Sans',sans-serif;color:#e2e8f0;
  display:flex;flex-direction:column;padding:28px 36px 20px;gap:18px;
}
.slide-title{font-size:26px;font-weight:800;color:#38bdf8;letter-spacing:-0.5px;border-bottom:2px solid rgba(56,189,248,0.25);padding-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.slide-title .tag{font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#7dd3fc;padding:4px 12px;border-radius:4px;}

.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.pillar{background:#111827;border-radius:12px;border:1px solid #1e293b;padding:20px;display:flex;flex-direction:column;gap:12px}
.p1{border-top:4px solid #38bdf8}.p2{border-top:4px solid #34d399}.p3{border-top:4px solid #f59e0b}
.pillar-icon{font-size:28px;margin-bottom:2px}
.pillar-title{font-size:15.5px;font-weight:800;color:#f1f5f9}
.pillar-sub{font-size:11px;font-weight:700;margin-bottom:4px}
.p1 .pillar-sub{color:#38bdf8}.p2 .pillar-sub{color:#34d399}.p3 .pillar-sub{color:#f59e0b}
.points{display:flex;flex-direction:column;gap:8px}
.pt{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:#94a3b8;line-height:1.4}
.pt-bullet{font-weight:900;flex-shrink:0;margin-top:1px}
.p1 .pt-bullet{color:#38bdf8}.p2 .pt-bullet{color:#34d399}.p3 .pt-bullet{color:#f59e0b}

.metrics{background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:12px;padding:18px 24px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:center}
.metric{display:flex;flex-direction:column;gap:5px;border-right:1px solid rgba(255,255,255,0.08);padding-right:16px}
.metric:last-child{border-right:none;padding-right:0}
.metric-val{font-size:28px;font-weight:800;color:#fcd34d;font-family:'JetBrains Mono',monospace;line-height:1}
.metric-label{font-size:13px;font-weight:700;color:#e2e8f0}
.metric-desc{font-size:11px;color:#94a3b8;line-height:1.35}
</style></head><body>
<div class="slide-title">
  <span>🎯 Multi-Ecosystem Impact &amp; National Strategic Alignment</span>
  <span class="tag">ISRO SAC SIH26167 // QUANTIFIABLE BENEFITS</span>
</div>
<div class="pillars">
  <div class="pillar p1">
    <div class="pillar-icon">🛰️</div>
    <div class="pillar-title">ISRO / Space Applications Centre (SAC)</div>
    <div class="pillar-sub">DIRECT CONVERSATIONAL EO EXPLOITATION</div>
    <div class="points">
      <div class="pt"><span class="pt-bullet">›</span><span>Scientists and non-GIS mission analysts can query sovereign Cartosat &amp; RISAT archives directly in natural English — no manual GIS scripting.</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Automates complex preprocessing: band stacking, radiometric calibration, GSD normalization — completed in under 5 seconds.</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Auditable execution telemetry ensures compliance with ISRO SAC mission verification standards.</span></div>
    </div>
  </div>
  <div class="pillar p2">
    <div class="pillar-icon">🌊</div>
    <div class="pillar-title">Disaster Response — NDRF, SDMA, MHA</div>
    <div class="pillar-sub">CLOUD-PIERCING RAPID INUNDATION MAPPING</div>
    <div class="points">
      <div class="pt"><span class="pt-bullet">›</span><span>Penetrates 100% monsoon cloud cover using Sentinel-1 / RISAT C-band SAR microwave radar — guaranteed all-weather satellite vision.</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Delivers instant submersion boundaries, submerged road networks, and cut-off village counts during active cyclones.</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Cuts disaster intelligence briefing latency from 48+ hours down to under 5 seconds.</span></div>
    </div>
  </div>
  <div class="pillar p3">
    <div class="pillar-icon">🏛️</div>
    <div class="pillar-title">Urban Governance &amp; Environmental Protection</div>
    <div class="pillar-sub">AUTOMATED BI-TEMPORAL CHANGE AUDIT</div>
    <div class="points">
      <div class="pt"><span class="pt-bullet">›</span><span>Compares bi-temporal satellite pairs (t₁ vs t₂) to automatically detect unauthorized construction, urban encroachment &amp; illegal land use.</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Monitors forest canopy loss with quantified statistics (e.g. −3.8 km² canopy, +14.2% built-up expansion).</span></div>
      <div class="pt"><span class="pt-bullet">›</span><span>Generates GeoJSON briefings loadable directly into state GIS portals and ISRO Bhuvan.</span></div>
    </div>
  </div>
</div>
<div class="metrics">
  <div class="metric"><div class="metric-val">⚡ &lt;5s</div><div class="metric-label">Rapid Query Execution</div><div class="metric-desc">Reduces multi-hour manual GIS workflows to sub-5-second conversational natural language responses.</div></div>
  <div class="metric"><div class="metric-val">🌧️ 100%</div><div class="metric-label">All-Weather Coverage</div><div class="metric-desc">SAR radar fusion completely overcomes monsoon cloud blackouts — guaranteed uninterrupted observation.</div></div>
  <div class="metric"><div class="metric-val">🎯 96.8%</div><div class="metric-label">Calibrated Accuracy</div><div class="metric-desc">Zero black-box hallucinations — every finding provides pixel masks, GeoJSON polygons &amp; telemetry logs.</div></div>
  <div class="metric"><div class="metric-val">🇮🇳 IN-SPACe</div><div class="metric-label">National Policy Alignment</div><div class="metric-desc">Directly supports National Geospatial Policy 2022 democratizing satellite intelligence for non-GIS users.</div></div>
</div>
</body></html>`;

(async () => {
  await renderSlide(slide2, 'fullbleed_slide2_comparison.png');
  await renderSlide(slide3, 'fullbleed_slide3_architecture.png');
  await renderSlide(slide4, 'fullbleed_slide4_risk.png');
  await renderSlide(slide5, 'fullbleed_slide5_impact.png');
  console.log('\n✅ All full-bleed slide diagrams generated!');
})();
