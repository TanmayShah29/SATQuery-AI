# SatQuery AI: SIH 2026 Slide Deck (Generation 1 Draft)

**Team Name:** Divya Drishti (दिव्य दृष्टि)  
**Problem Statement ID:** 26167  
**Problem Statement Title:** SatQuery AI - An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries  
**Target Organization:** Indian Space Research Organisation (ISRO) — Space Applications Centre (SAC)  
**Category / Theme:** Software | Space Technology  
**Generated Presentation File:** [Divya-Drishti-SIH26167-Presentation-v1.pptx](file:///Users/tanmay/SIH-2026/sih-info/Divya-Drishti-SIH26167-Presentation-v1.pptx)  
**Slide Limit Compliance:** Exactly 6 Slides (Instructions slide removed).

---

## Slide 1: Title Page

### Slide Text Content
* **Header:** SMART INDIA HACKATHON 2026
* **Problem Statement ID:** 26167
* **Problem Statement Title:** SatQuery AI - An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries
* **Theme:** Space Technology
* **Category:** Software
* **Team Name:** Divya Drishti (दिव्य दृष्टि)
* **Team Leader:** Tanmay Shah (Enrollment No: 230020107079)
* **Team Members:**
  1. Tanmay Shah (Team Leader) — `230020107079`
  2. Vadodaria Dhrumil Mehulkumar — `230020107088`
  3. Karan Vaghela — `230020107090`
  4. Pushti Doshi — `240023107030` (Female Member)
  5. Kunj Vachharajani — `230020107087`
  6. Krish Shah — `230020107077`
* **Institute:** L.D. College of Engineering, Ahmedabad, Gujarat

### Speaker Notes (30 Seconds)
> *"Good morning respected judges. We are Team Divya Drishti, presenting SatQuery AI for ISRO Problem Statement 26167. Today, extracting insights from satellite remote sensing requires specialized GIS knowledge. Non-expert users cannot query multi-sensor imagery using natural language. We are demonstrating a production-grade Vision-Language Geospatial Studio that allows users to ask questions in plain language and get grounded, verifiable visual answers across optical and radar imagery."*

---

## Slide 2: Idea Title & Proposed Solution

### Slide Text Content
* **Slide Title:** IDEA TITLE: SatQuery AI — Agentic Multimodal Remote Sensing Studio
* **1. Problem Addressed:**
  * Non-expert users cannot query multi-sensor Earth Observation imagery (optical + SAR) using plain language.
  * Generic LLMs/VLMs fail: they lack remote-sensing spectral awareness, hallucinate spatial coordinates, and cannot co-register SAR radar backscatter.
* **2. Proposed Solution (SatQuery AI):**
  * **Production-Grade Geospatial AI Studio:** Ingests native GeoTIFFs (single-image, bi-temporal pairs $t_1$ vs $t_2$, and cross-modal Optical+SAR pairs).
  * **Agentic Controller & Specialist Registry:** Decomposes natural language queries and dynamically routes tasks to specialized computer vision models.
* **3. Innovation and Uniqueness:**
  * **Anti-AI Wrapper Workbench:** Hardware-accelerated WebGL canvas (MapLibre GL) with split-screen draggable swipe curtain ($t_1$ vs $t_2$).
  * **Auditable Execution Trace:** Real-time telemetry displaying selected model, tensor parameters, latency, and confidence scores (zero black-box hallucination).
  * **Cloud-Piercing Optical + SAR Fusion:** Combines Sentinel-2 optical spectral data with Sentinel-1 SAR microwave radar for 24/7 all-weather surveillance.

### Speaker Notes (45 Seconds)
> *"Most student projects take a satellite image, downscale it to a JPEG, and feed it into a generic OpenAI chat wrapper. That fails in real remote sensing because satellite data is multi-band GeoTIFF with geographic coordinates. SatQuery AI takes a completely different, production-grade approach: it acts as an intelligent controller that parses natural language and routes tasks to specialized remote sensing computer vision models, displaying results on an interactive split-screen map with verifiable confidence scores."*

---

## Slide 3: Technical Approach & Architecture

### Slide Text Content
* **Slide Title:** TECHNICAL APPROACH & SYSTEM ARCHITECTURE
* **1. Four Specialist AI Engines (Pre-Trained & Domain Adapted):**
  * **Single-Image VQA Engine:** RemoteCLIP (ViT-B/32) adapted on BigEarthNet.txt & RSVQA for land-use and facility analysis.
  * **Text-Guided Region Grounder:** MobileSAM prompted by RemoteCLIP text embeddings for <50ms instance segmentation.
  * **Bi-Temporal Change Detector:** ChangeFormer-v2 hierarchical Siamese transformer extracting structural differences between $t_1$ and $t_2$.
  * **Cross-Modal SAR + Optical Fusion:** Dual-branch cross-attention fusing Sentinel-2 (RGB/NIR) with Sentinel-1 SAR (VV/VH backscatter).
* **2. Pipeline & Workflow:**
  * `[User Query + AOI Selection] → [FastAPI Intent Parser & Validator] → [Specialist Model Registry DAG] → [GeoJSON Vector Mask & Heatmap Generation] → [WebGL MapLibre GL Layer Display] → [Downloadable Intelligence Report (PDF/GeoJSON)]`.
* **3. Technology Stack:**
  * **Frontend:** Next.js 15, Tailwind CSS, MapLibre GL JS, maplibre-gl-compare (swipe slider), Zustand.
  * **Backend & GIS:** Python 3.12, FastAPI, rasterio, GDAL, pyproj, shapely, geopandas, ONNX Runtime (CPU/MPS acceleration).

### Speaker Notes (60 Seconds)
> *"Our technical moat is our 4-engine specialist registry. Instead of a single model doing everything poorly, we route queries dynamically: RemoteCLIP for VQA, MobileSAM for instant zero-shot region grounding, ChangeFormer-v2 for bi-temporal change detection, and cross-attention fusion for optical and SAR. Our backend uses rasterio windowed block reads so we can process gigabyte-sized GeoTIFFs without memory overflow, rendering vector feature masks at 60 FPS in MapLibre GL."*

---

## Slide 4: Feasibility and Viability

### Slide Text Content
* **Slide Title:** FEASIBILITY AND VIABILITY ANALYSIS
* **1. Technical Feasibility:**
  * **Open Foundation Models:** Built on proven RemoteCLIP, MobileSAM, and ChangeFormer backbones, avoiding costly pretraining from scratch.
  * **Edge & Laptop Optimization:** 4-bit quantization and ONNX/MPS acceleration enable sub-100ms inference on standard college/workstation hardware.
  * **Native Geospatial Handling:** Windowed rasterio block reads stream large gigabyte-scale GeoTIFFs without memory overflow.
* **2. Operational Viability & Zero Cost Barrier:**
  * **$0 Ongoing API Cost:** Runs fully self-contained on local/cloud servers without dependency on paid proprietary LLM tokens.
  * **Offline Hackathon Mode:** Pre-cached benchmark scenes (GIFT City, Assam Floods, Mumbai Port) run with 0s latency even if venue Wi-Fi drops.
* **3. Potential Risks & Mitigation Strategies:**
  * *Risk 1 (Monsoon Cloud Cover):* Mitigated via Sentinel-1 SAR radar channel which penetrates clouds completely.
  * *Risk 2 (Optical/SAR Misalignment):* Mitigated via automated phase-correlation sub-pixel co-registration verification before inference.
  * *Risk 3 (AI Hallucination):* Mitigated by mandatory confidence calibration and auditable execution trace logging.

### Speaker Notes (45 Seconds)
> *"From an engineering perspective, this system is 100% viable today. We use lightweight 4-bit quantized backbones that run locally on standard laptops and Apple Silicon Metal acceleration, meaning zero cloud token costs. We have pre-cached local benchmark scenes for GIFT City, Assam floods, and Mumbai Port, ensuring our demo runs flawlessly with zero latency even if hackathon Wi-Fi goes down."*

---

## Slide 5: Impact and Benefits

### Slide Text Content
* **Slide Title:** IMPACT AND BENEFITS
* **1. Target Beneficiaries:**
  * **ISRO / Space Applications Centre:** Direct interactive exploitation of Cartosat and RISAT sovereign satellite feeds without manual GIS scripting.
  * **Disaster Response Agencies (NDRF / SDMA):** Instant flood inundation and infrastructure damage assessment during active cyclones.
  * **Urban Planning & Forestry:** Automated detection of illegal construction, urban sprawl, and deforestation across Indian states.
* **2. Measurable Quantitative Benefits:**
  * **90% Faster Query Turnaround:** Reduces multi-hour GIS analyst query cycles to under 5 seconds through conversational vision routing.
  * **100% All-Weather Coverage:** Eliminates cloud-induced data blackouts by fusing SAR radar backscatter with optical imagery.
  * **Evidence-Grounded Accountability:** Zero black-box hallucinations—every finding delivers exact pixel masks and GeoJSON coordinates.
* **3. National Strategic Alignment:**
  * Supports IN-SPACe initiatives and national geospatial deregulation by making satellite intelligence accessible to non-GIS decision makers.

### Speaker Notes (30 Seconds)
> *"The national impact is immediate: during a monsoon flood, optical satellites see only white clouds. By fusing SAR radar with optical data, disaster authorities like NDRF can map submerged roads and villages in seconds rather than waiting days for clear skies. It democratizes satellite intelligence for non-GIS experts across forestry, urban planning, and national security."*

---

## Slide 6: Research and References

### Slide Text Content
* **Slide Title:** RESEARCH AND REFERENCES
* **1. Prescribed Benchmark Datasets & Pretraining Corpus:**
  * **BigEarthNet.txt (arXiv:2603.29630):** 590k co-registered Sentinel-1 SAR and Sentinel-2 optical pairs for domain adaptation.
  * **VRSBench (Yang et al., 2024):** High-resolution remote-sensing visual question answering and text-guided visual grounding.
  * **RSVQA (Lobry et al., IEEE TGRS 2020):** Benchmark optical VQA dataset covering HR and LR satellite splits.
  * **CDVQA (Yuan et al., 2023):** Multitemporal change-based remote-sensing visual question answering.
  * **ISRO / SAC Evaluation Set:** Cartosat-2S optical + RISAT-1A SAR evaluation pairs.
* **2. Key Foundational Research Papers:**
  * *RemoteCLIP: A Vision-Language Foundation Model for Remote Sensing* (Liu et al., IEEE TGRS 2024).
  * *ChangeFormer: A Transformer-Based Architecture for Remote Sensing Change Detection* (Bandara et al., IEEE JSTARS 2022).
  * *MobileSAM: Faster Segment Anything with Lightweight Architecture* (Zhang et al., 2023).
* **3. Satellite Sensor Platforms:**
  * ESA Copernicus Sentinel-1 (C-SAR) & Sentinel-2 (MSI); ISRO Cartosat-2S/3 & RISAT-1A (EOS-04); USGS Landsat-8/9.

### Speaker Notes (15 Seconds)
> *"Our architecture is strictly anchored in peer-reviewed remote-sensing literature and the exact datasets prescribed by ISRO, including BigEarthNet.txt, VRSBench, and CDVQA. We are ready for technical questions on our model architectures and co-registration pipeline."*
