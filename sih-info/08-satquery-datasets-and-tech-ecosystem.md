# SatQuery AI: Master Datasets & Technology Ecosystem Directory

**Target Problem Statement:** SIH26167 (ISRO / Space Applications Centre)  
**Classification:** Multimodal Remote Sensing & Geospatial Intelligence  
**Scope:** Exhaustive catalog of all datasets, satellite sensors, APIs, machine learning foundation models, geospatial libraries, and rendering engines.

---

## 1. Official & Prescribed Benchmark Datasets

| Dataset | Modality & Bands | Size / Scope | Task in SatQuery AI | Access / Source |
| :--- | :--- | :--- | :--- | :--- |
| **BigEarthNet.txt**<br/>(ArXiv: 2603.29630) | Sentinel-1 SAR (VV, VH) + Sentinel-2 MSI (12 bands) | 590,326 co-registered image pairs with text captions | **Primary Pretraining & Domain Adaptation** for multisensor alignment | [Hugging Face Datasets](https://huggingface.co/datasets/bigearthnet) / [ArXiv](https://arxiv.org/abs/2603.29630) (Free, Open) |
| **VRSBench** | High-resolution optical aerial/satellite (0.5m–2m) | 29,614 images, 126,141 VQA pairs, 137,262 grounding spans | **Visual Question Answering & Text-Guided Bounding Box Grounding** | [GitHub / Hugging Face](https://github.com/ZhanYang-nwpu/VRSBench) (Free, Open) |
| **RSVQA**<br/>(HR & LR splits) | Optical satellite imagery (Sentinel-2 10m & Aerial 0.15m) | Over 1 million question-answer pairs | **Baseline Remote Sensing VQA** (counting, presence, comparisons) | [Zenodo / Sylvain Lobry](https://rsvqa.sylvainlobry.com/) (Free, Open) |
| **CDVQA** | Bi-temporal optical image pairs ($t_1, t_2$) | Thousands of bitemporal question-answer-change pairs | **Change-based Visual Question Answering** & temporal reasoning | [GitHub / Open Science Data](https://github.com/YuanZhibo/CDVQA) (Free, Open) |
| **ISRO / SAC Evaluation Set** | Cartosat-2S Optical (sub-meter) + RISAT-1A SAR (C-band) | Held-out evaluation pairs from SAC | **Grand Finale Scoring & National Jury Validation** | Provided by ISRO / SAC at Grand Finale |

---

## 2. Complementary & Specialized Domain Datasets

| Dataset | Description & Value Add | Primary Use Case | Format |
| :--- | :--- | :--- | :--- |
| **LEVIR-CD / LEVIR-CD+** | 637 ultra-high-resolution (0.5m) bitemporal image pairs (1024×1024) spanning 5–14 years. | Ground-truth benchmark for building construction & demolition change detection. | GeoTIFF / PNG with binary change masks. |
| **WHU Building Change (WHU-CD)** | Aerial dataset covering 20.5 km² before and after a 6.3 magnitude earthquake in Christchurch. | Disaster damage assessment and structural collapse identification. | High-res GeoTIFF with label masks. |
| **SEN12MS** | 180,662 patches of co-registered Sentinel-1 SAR and Sentinel-2 multispectral + MODIS land cover. | Training optical-SAR cross-attention fusion heads under heavy cloud cover. | 16-bit GeoTIFF (EPSG:4326). |
| **DOTA-v2.0** | 11,268 satellite images with 1.7 million oriented bounding boxes across 18 maritime & urban classes. | Ship detection, aircraft counting, container terminal grounding. | Oriented Bounding Boxes (OBB) GeoJSON. |
| **SpaceNet 8 (Flood)** | Pre- and post-disaster satellite imagery covering hurricane and flood inundation zones. | Rapid water masking and infrastructure wash-out detection. | Cloud-Optimized GeoTIFF (COG). |

---

## 3. Satellite Missions & Sensor Specifications

| Satellite Mission | Sensor Type | Key Spectral Bands / Polarizations | Spatial Resolution (GSD) | Operational Role |
| :--- | :--- | :--- | :--- | :--- |
| **Sentinel-2 (A/B)** | Multispectral Instrument (MSI) | B2 (Blue), B3 (Green), B4 (Red), B8 (NIR), B11/B12 (SWIR) | 10m (RGB/NIR), 20m (Red-Edge/SWIR), 60m (Atmospheric) | Spectral land-cover, vegetation index (NDVI), water index (MNDWI). |
| **Sentinel-1 (A/C)** | C-band Synthetic Aperture Radar (C-SAR) | VV (Vertical-Vertical), VH (Vertical-Horizontal) amplitude backscatter | 10m (Interferometric Wide Swath - IW GRD) | **All-weather day/night structural imaging; pierces clouds, fog, and smoke.** |
| **Cartosat-2S / 3** | High-Resolution Panchromatic & Multispectral | Panchromatic (0.6m–0.28m), Multispectral 4-band (1.6m–1.12m) | **Sub-meter tactical resolution** | High-detail facility, building, and road infrastructure monitoring. |
| **RISAT-1A (EOS-04)** | C-band Active SAR Radar | Hybrid Polarimetry (Circular transmit, Linear receive) | 1m to 50m depending on beam mode (FRS, MRS, CRS) | Indian sovereign radar data for monsoon flood tracking and border monitoring. |
| **Landsat 8 / 9** | OLI (Optical) & TIRS (Thermal Infrared) | Bands 1–9 (Visible, NIR, SWIR, Cirrus), Bands 10–11 (Thermal) | 15m (Panchromatic), 30m (Multispectral), 100m (Thermal) | Long-term multi-decadal historical trend comparison. |

---

## 4. Live Satellite Portals, APIs & Catalogs

1. **Copernicus Data Space Ecosystem (CDSE):**
   * *Endpoints:* Free STAC (SpatioTemporal Asset Catalog) API & OpenSearch.
   * *Protocol:* OData REST API for direct programmatic download of raw Sentinel-1/2 products.
2. **ISRO Bhuvan & MOSDAC:**
   * *Bhuvan (`bhuvan.nrsc.gov.in`):* WMS/WFS tile feeds for Indian national land use, water bodies, and Cartosat base layers.
   * *MOSDAC (`mosdac.gov.in`):* Oceansat-3, INSAT-3D/3DR meteorological and ocean color products.
3. **AWS Open Data Registry (`s3://sentinel-cogs`):**
   * Pre-tiled Cloud-Optimized GeoTIFFs (COGs) of Sentinel-2 globally. Accessible over standard HTTPS with byte-range HTTP GET requests (0 download latency).
4. **Element84 Earth Search STAC API:**
   * Queryable metadata API (`https://earth-search.aws.element84.com/v1`) to discover cloud-free scenes by latitude, longitude, and date range in under 150ms.

---

## 5. Machine Learning Foundation Models & Backbones

| Model / Architecture | Original Authors / Source | Function in SatQuery AI | Weights & Deployment |
| :--- | :--- | :--- | :--- |
| **RemoteCLIP** | ArXiv / Hugging Face | Pre-trained vision-language foundation model trained on 800k+ remote-sensing image-text pairs. | PyTorch / ONNX (`ViT-B/32`, `ViT-L/14`). Zero-shot retrieval and text-guided classification. |
| **GeoChat / Qwen2-VL** | MBZUAI / Alibaba | Multimodal Vision-Language Model adapted for grounded satellite reasoning. | 4-bit AWQ / GGUF quantized for laptop CPU & Apple Silicon Metal MPS execution. |
| **MobileSAM / FastSAM** | Faster Segment Anything | Ultra-fast (40ms) instance segmentation prompted by text-aligned bounding boxes. | Lightweight PyTorch model (~40MB weights). |
| **ChangeFormer-v2 / BIT** | Bitemporal Image Transformer | Siamese hierarchical transformer for pixel-level before/after difference mapping. | PyTorch tensor model (`bitemporal_diff.pt`). |

---

## 6. Geospatial Software & Library Ecosystem

### Python Backend & Processing Pipeline
* **`rasterio`:** High-performance C++ GDAL bindings for reading GeoTIFF metadata, affines, projection coordinates, and windowed block reads.
* **`rioxarray` & `xarray`:** Multi-dimensional raster manipulation for Sentinel-2 multispectral band stacking.
* **`geopandas` & `shapely`:** Vector spatial operations, polygon intersections, convex hulls, and GeoJSON serialization.
* **`pyproj`:** Coordinate reference system (CRS) transformations (e.g. converting UTM Zone 43N to WGS84 EPSG:4326).
* **`mercantile` & `supermercado`:** Slippy map tile calculations ($x, y, z$) from spatial bounding boxes.

### Frontend WebGL & Mapping Stack
* **`MapLibre GL JS`:** Open-source WebGL 60fps hardware-accelerated mapping engine (no proprietary Mapbox tokens required).
* **`maplibre-gl-compare`:** Draggable vertical/horizontal swipe curtain for real-time bi-temporal comparison.
* **`Deck.gl` (Uber / OpenJS):** High-performance WebGL layer visualization (supports `TileLayer`, `BitmapLayer`, `GeoJsonLayer`, and point clouds).
* **`geotiff.js`:** Client-side parsing and direct GPU shader rendering of floating-point GeoTIFF rasters in the browser.
* **`turf.js`:** Client-side spatial geometry calculations (area in km², line distances, bounding box envelopes).

---

## 7. Operational Data Flow & Pipeline Architecture

```
[Satellite Tile Ingestion: GeoTIFF / AWS COG / INCOIS]
                 │
                 ▼
     [rasterio: CRS & Band Validation]
                 │
        ┌────────┴────────┐
        ▼                 ▼
 [Optical Tensors]  [SAR Radar Tensors]
 (B4, B3, B2, B8)     (VV, VH backscatter)
        └────────┬────────┘
                 ▼
[Agentic Task Controller (FastAPI)] ───► [Query: "What changed after the floods?"]
                 │
  ┌──────────────┼──────────────┐
  ▼              ▼              ▼
[Tool 1: VQA]  [Tool 2: SAM]  [Tool 3: ChangeFormer]
(RemoteCLIP)   (Grounded Box) (Siamese Transformer)
  └──────────────┬──────────────┘
                 ▼
[Evidence Synthesis: GeoJSON Polygons + Pixel Change Mask]
                 │
                 ▼
[MapLibre GL Canvas: Cyan Glowing Flood Inundation Layer (60 FPS)]
                 │
                 ▼
[Auditable Trace Drawer: Model Name, Latency, Confidence Score]
```
