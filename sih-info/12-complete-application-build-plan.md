# SatQuery AI: End-to-End Application Build Plan
**Target Problem Statement:** SIH26167 (ISRO / Space Applications Centre)  
**Project Title:** SatQuery AI — Interactive Vision-Language Assistant for Multimodal Remote Sensing  
**Team Identity:** Divya Drishti  
**File Location:** [`sih-info/12-complete-application-build-plan.md`](file:///Users/tanmay/SIH-2026/sih-info/12-complete-application-build-plan.md)  
**Target Completion:** Prior to National Submission & Hackathon Finale  

---

## 1. Executive Overview & System Architecture

SatQuery AI is an **agentic Earth Observation intelligence studio** designed to replace fragmented, single-task GIS tools with a unified natural-language interface. Instead of a generic LLM wrapper, SatQuery AI implements an **agentic dispatcher** that routes user queries to specialized computer vision and geospatial models, validates spatial coordinate reference systems (CRS), streams Cloud-Optimized GeoTIFFs (COGs), and outputs evidence-backed answers with vector bounding boxes and change masks.

```
                                  [USER QUERY]
                                       │
                                       ▼
                       [FastAPI Agentic Query Router]
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
       [Single-Image VQA]     [Cross-Modal Pair]     [Bi-Temporal Change]
         (Optical or SAR)       (Optical + SAR)       (T1 vs T2 Images)
                │                      │                      │
                ▼                      ▼                      ▼
        [RemoteCLIP / VLM]     [SAR Fusion Head]      [ChangeFormer / BIT]
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       │
                                       ▼
                      [MobileSAM / Grounding Engine]
                           (Pixel Polygon Masks)
                                       │
                                       ▼
                       [Evidence Synthesis Engine]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [MapLibre GL Canvas]                           [Inspector Drawer]
 - 60 FPS WebGL Rendering                       - Natural Language Answer
 - Split Swipe Comparison Slider                 - Confidence Score & Latency
 - Glowing Cyan GeoJSON Overlays                - Downloadable GeoJSON / PDF
```

---

## 2. Complete Technology Stack

| Layer | Technologies | Rationale |
|---|---|---|
| **Backend Framework** | **FastAPI (Python 3.12)** | Asynchronous, native Pydantic validation, WebSocket streaming for inference telemetry. |
| **Geospatial Processing** | **`rasterio`, `shapely`, `pyproj`, `geopandas`** | High-performance C++ GDAL bindings for windowed COG streaming and coordinate math. |
| **Cloud Satellite Data** | **AWS Open Data (Element84 STAC) & Planetary Computer** | Real-time on-demand streaming of Sentinel-2 (MSI) and Sentinel-1 (C-SAR) without local disk bloat. |
| **Vision-Language Model** | **RemoteCLIP / Qwen2-VL-7B (4-bit)** | Pre-trained on 800k+ remote-sensing pairs for accurate satellite terminology and VQA. |
| **Region Grounding** | **MobileSAM / FastSAM** | 40ms zero-shot segmentation prompted by bounding boxes to generate GeoJSON polygons. |
| **Change Detection** | **ChangeFormer-v2 / Siamese Difference Head** | Bitemporal transformer identifying construction, deforestation, or flood washouts between $t_1$ and $t_2$. |
| **SAR Fusion** | **Cross-Attention Dual-Encoder** | Fuses Sentinel-1 radar backscatter (VV/VH) into optical channels to pierce cloud cover. |
| **Frontend Framework** | **React 18 + Vite + TypeScript** | Type-safe, sub-second HMR development speed, production bundling. |
| **Map Rendering Engine** | **MapLibre GL JS + `maplibre-gl-compare`** | Hardware-accelerated 60 FPS WebGL map with draggable swipe curtain (zero API keys needed). |
| **Design System** | **Tailwind CSS + Lucide Icons** | Tactical dark theme (`#0B0F19`), Electric Cyan (`#00E5FF`), and anti-AI-slop visual craft. |

---

## 3. Project Directory Architecture

```
SIH-2026/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI server entry point & CORS
│   │   ├── config.py                   # Environment configuration & model paths
│   │   ├── api/
│   │   │   ├── routes_query.py         # Main /api/query endpoint (VQA & Grounding)
│   │   │   ├── routes_stac.py          # Live satellite search & COG URL resolver
│   │   │   ├── routes_tiles.py         # Dynamic XYZ raster tile server for MapLibre
│   │   │   └── routes_export.py        # GeoJSON and PDF report export
│   │   ├── agent/
│   │   │   ├── router.py               # Intent classifier (single vs bitemporal vs SAR)
│   │   │   ├── tool_registry.py        # Dynamic tool execution registry
│   │   │   └── evidence_builder.py     # Synthesizes model outputs into structured JSON
│   │   ├── engine/
│   │   │   ├── raster_loader.py        # Rasterio windowed reads and CRS transforms
│   │   │   ├── stac_client.py          # AWS & Planetary Computer STAC querying
│   │   │   └── tile_generator.py       # Converts GeoTIFF bounds to XYZ slippy tiles
│   │   └── models/
│   │       ├── vqa_remoteclip.py       # RemoteCLIP vision-language inference
│   │       ├── grounding_sam.py        # MobileSAM prompt-guided segmentation
│   │       ├── change_detector.py      # Bitemporal change detection engine
│   │       └── sar_fusion.py           # Optical-SAR cross-modal fusion
│   ├── requirements.txt                # Python backend dependencies
│   └── Dockerfile                      # Production container spec
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # Main application layout (Split View)
│   │   ├── components/
│   │   │   ├── MapCanvas.tsx           # MapLibre GL dual-canvas with swipe slider
│   │   │   ├── QueryBar.tsx            # Floating command query input with presets
│   │   │   ├── TelemetryDrawer.tsx     # Right-hand audit inspector & confidence trace
│   │   │   ├── LayerControl.tsx        # Toggle True Color, False Color (NIR), SAR Radar
│   │   │   └── ExportModal.tsx         # Download GeoJSON & mission PDF report
│   │   ├── hooks/
│   │   │   ├── useSatQuery.ts          # Query submission and WebSocket status stream
│   │   │   └── useMapLayers.ts         # Vector & raster layer state management
│   │   ├── styles/
│   │   │   └── globals.css             # Tactical dark styling and glowing cyan tokens
│   │   └── types/
│   │       └── geojson.d.ts            # Typed evidence and GeoJSON response interfaces
│   ├── package.json                    # Frontend npm dependencies
│   └── vite.config.ts                  # Vite bundler configuration
│
├── data/                               # Isolated data store (git-ignored)
│   ├── sample/                         # Immediate dev starter pack (already downloaded)
│   ├── benchmarks/                     # VRSBench, CDVQA, BigEarthNet evaluation files
│   └── cache/                          # Cached COG blocks
│
├── scripts/
│   ├── data_manager.py                 # Multi-source dataset downloader & STAC validator
│   └── run_dev.sh                      # One-click startup script for backend & frontend
└── sih-info/                           # Official SIH documentation, presentation & compliance
```

---

## 4. Step-by-Step Implementation Roadmap

### Phase 1: Geospatial Backend & Streaming Engine (Days 1–3)
1. **Initialize FastAPI Service:**
   - Setup async server in `backend/app/main.py`.
   - Implement health check and CORS headers for localhost React frontend.
2. **Implement STAC Query Engine (`backend/app/engine/stac_client.py`):**
   - Query AWS Element84 STAC for Sentinel-2 L2A Cloud-Optimized GeoTIFFs (`TCI.tif`, `B04.tif`, `B08.tif`).
   - Query Microsoft Planetary Computer for Sentinel-1 C-SAR GRD (VV/VH dual-pol).
3. **Build XYZ Tile Server (`backend/app/engine/tile_generator.py`):**
   - Use `rasterio` with windowed reads to serve slippy map tiles (`/api/tiles/{z}/{x}/{y}`) on-the-fly directly to MapLibre GL.

### Phase 2: AI Vision-Language & Segmentation Pipeline (Days 4–7)
1. **Implement VQA Engine (`backend/app/models/vqa_remoteclip.py`):**
   - Load pre-trained `RemoteCLIP` weights or quantized remote sensing VLM.
   - Accepts image tensor + text question, outputs natural language answer with confidence score.
2. **Implement Grounding & Segmentation (`backend/app/models/grounding_sam.py`):**
   - Wire `MobileSAM` (or FastSAM) to convert text-grounded bounding boxes into pixel polygon masks.
   - Transform image pixel coordinates back into real-world geographic coordinates (EPSG:4326 GeoJSON).
3. **Implement Bi-temporal Change Detection (`backend/app/models/change_detector.py`):**
   - Ingest $t_1$ and $t_2$ co-registered images.
   - Run pixel-difference and feature-difference siamese network.
   - Generate binary change mask (e.g. newly built structures, flooded land).
4. **Implement Optical-SAR Cross-Modal Fusion (`backend/app/models/sar_fusion.py`):**
   - Overlay Sentinel-1 SAR backscatter onto Sentinel-2 optical bands for cloud-covered areas.

### Phase 3: Agentic Query Router & Evidence Synthesis (Days 8–10)
1. **Query Intent Classification (`backend/app/agent/router.py`):**
   - Classify user query into one of three execution paths:
     - `PATH_SINGLE`: Single-image VQA / Counting / Grounding.
     - `PATH_BITEMPORAL`: Before-and-after comparison / Change explanation.
     - `PATH_CROSSMODAL`: Cloud penetration / Optical + Radar joint reasoning.
2. **Evidence Packaging (`backend/app/agent/evidence_builder.py`):**
   - Produce a unified JSON payload containing:
     - `answer`: Clear, concise human explanation.
     - `geojson`: Polygons of identified objects or changed areas.
     - `telemetry`: Models executed, latency in milliseconds, confidence percentages, acquisition dates.

### Phase 4: Modern Tactical Frontend UI (Days 11–14)
1. **Scaffold React + Vite + Tailwind App:**
   - Implement dark tactical aesthetic (`#0B0F19` background, `#111827` cards, `#00E5FF` electric cyan accents).
2. **Interactive Map Viewport (`frontend/src/components/MapCanvas.tsx`):**
   - Integrate `MapLibre GL JS`.
   - Add `maplibre-gl-compare` draggable swipe curtain to visually inspect $t_1$ vs $t_2$ side-by-side.
   - Add dynamic GeoJSON layer that highlights detected areas with cyan glowing borders.
3. **Command & Query Floating Bar (`frontend/src/components/QueryBar.tsx`):**
   - Modern floating search bar with keyboard shortcut (`Cmd+K`).
   - Quick preset query chips:
     - *"Identify new construction between T1 and T2"*
     - *"Highlight water bodies and flood inundation"*
     - *"Analyze cloud-covered industrial area using SAR radar"*
     - *"Count storage tanks in selected bounding box"*
4. **Telemetry & Evidence Inspector Drawer (`frontend/src/components/TelemetryDrawer.tsx`):**
   - Displays AI chain-of-thought, model cards, latency breakdown, and coordinate bounds.
   - One-click buttons to download GeoJSON or generate a PDF summary report.

### Phase 5: Testing, Hardening & Offline Fail-Safe (Days 15–17)
1. **Benchmark Validation:**
   - Run evaluation against local `data/sample/` and downloaded `data/benchmarks/` (VRSBench, CDVQA).
2. **Offline Fallback Guarantee (Crucial for Hackathon Demos):**
   - If venue Wi-Fi is slow or blocked, the app automatically falls back to local cached scenes in `data/sample/` with zero latency.
3. **One-Click Startup Script (`scripts/run_dev.sh`):**
   - Single command to boot both backend (port 8000) and frontend (port 5173).

---

## 5. Team Role Assignments (Team Divya Drishti)

| Team Member | Role | Assigned Core Responsibilities |
|---|---|---|
| **Tanmay Shah** *(Leader)* | **Lead System Architect & Agentic Engine** | FastAPI core orchestration, agentic query router (`backend/app/agent/`), system integration, and presentation pitch. |
| **Krish Shah** | **Deep Learning & VQA Specialist** | RemoteCLIP vision-language inference (`vqa_remoteclip.py`), MobileSAM segmentation head, and model quantization. |
| **Pushti Doshi** | **Frontend UI/UX Lead** | MapLibre GL dual-canvas integration, swipe slider (`MapCanvas.tsx`), tactical design tokens, and user interactions. |
| **Karan Vaghela** | **Geospatial & Tile Engine Engineer** | Rasterio windowed COG streaming, coordinate conversions (`raster_loader.py`), and XYZ dynamic tile server. |
| **Dhrumil Vadodaria** | **Change Detection & SAR Radar Specialist** | Bi-temporal change detection pipeline (`change_detector.py`) and Sentinel-1 SAR dual-pol fusion. |
| **Kunj Vachharajani** | **Benchmarking, QA & Export Pipeline** | VRSBench / CDVQA benchmark evaluation, GeoJSON/PDF export generation (`routes_export.py`), and test automation. |

---

## 6. Hackathon Winning Demo Script (3-Minute Flow)

1. **Minute 0:00 – 0:45: The Problem & The Multi-Sensor Solution**
   - Show judges a satellite image of Ahmedabad / Assam with heavy cloud cover.
   - Demonstrate how standard GPT wrappers fail because optical imagery cannot see through clouds.
2. **Minute 0:45 – 1:45: Live Query & Cross-Modal Radar Fusion**
   - Type query: *"Analyze industrial storage facilities beneath cloud cover."*
   - Watch SatQuery AI automatically engage the Sentinel-1 SAR radar fusion head, piercing clouds to reveal underlying structures.
3. **Minute 1:45 – 2:30: Bi-Temporal Change Detection & Interactive Swipe Slider**
   - Type query: *"What infrastructure changed between March 2024 and May 2024?"*
   - SatQuery AI loads the bitemporal pair, detects newly completed road/building sections, highlights them in glowing cyan, and allows judges to drag the interactive swipe slider.
4. **Minute 2:30 – 3:00: Evidence Audit Trail & One-Click GeoJSON Export**
   - Open the Evidence Inspector Drawer showing latency (320ms), model confidence (94.6%), and click **Export GeoJSON** to prove the system is production-ready for ISRO disaster management teams.
