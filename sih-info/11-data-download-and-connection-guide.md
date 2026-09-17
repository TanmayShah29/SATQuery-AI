# SatQuery AI: Master Data Download & Connection Guide
**Problem Statement ID:** SIH26167 (ISRO / Space Applications Centre)  
**Team:** Divya Drishti  
**Script Utility:** [`scripts/data_manager.py`](file:///Users/tanmay/SIH-2026/scripts/data_manager.py)  

---

## 1. The 3-Tier Data Architecture

Satellite Earth Observation datasets (especially BigEarthNet and Sentinel scenes) can easily exceed 200 GB. Attempting to download everything locally at once chokes disk storage and delays development. 

SatQuery AI uses a **3-Tier Ingestion Strategy**:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │ Tier 1: Dev Starter Pack (Local ~25 MB)                                │
 │ - Optical T1 & T2, Co-registered SAR Radar, Bitemporal pairs, VQA JSONs│
 │ - Run: python scripts/data_manager.py --download-sample               │
 └───────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ Tier 2: Live Cloud-Optimized Streaming (0 Local Storage)              │
 │ - Global Sentinel-2 L2A & Sentinel-1 SAR Cloud-Optimized GeoTIFFs      │
 │ - Streams via AWS Element84 STAC & Microsoft Planetary Computer        │
 │ - Run: python scripts/data_manager.py --test-stac                      │
 └───────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ Tier 3: Prescribed Benchmark Datasets (For Model Training & Fine-Tune) │
 │ - BigEarthNet.txt (Multimodal pretraining - 590k pairs)                │
 │ - VRSBench (Remote sensing VQA & region grounding - 37k QA pairs)      │
 │ - CDVQA (Bi-temporal change VQA splits)                                │
 │ - RSVQA (Sentinel-2 Low-Res & Aerial High-Res VQA)                    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Layout & Organization

All data files are isolated in the root [`data/`](file:///Users/tanmay/SIH-2026/data) directory (ignored by git to keep commits lightweight):

```
data/
├── sample/                               # Tier 1: Immediate Dev Starter Data
│   ├── optical/                          # Sentinel-2 MSI RGB & NIR samples
│   │   ├── sentinel2_ahmedabad_t1_20240327.jpg
│   │   └── sentinel2_ahmedabad_t2_20240501.jpg
│   ├── sar/                              # Sentinel-1 C-band SAR Radar samples
│   │   └── sentinel1_sar_ahmedabad_20240330.png
│   ├── bitemporal/                       # Paired pre/post change scenes
│   │   ├── pair1_pre_20240327.jpg
│   │   └── pair1_post_20240501.jpg
│   ├── vqa/                              # Sample QA and region grounding annotations
│   │   ├── sample_vrsbench_qa.json
│   │   └── sample_cdvqa_change_qa.json
│   └── sample_manifest.json              # Catalog metadata for dev pairs
├── benchmarks/                           # Tier 3: Evaluation Datasets
│   ├── vrsbench/                         # VRSBench_EVAL_vqa.json (37k QA pairs)
│   ├── cdvqa/                            # Test_questions.json, Test_answers.json
│   └── bigearthnet_txt/                  # BigEarthNet.txt.parquet metadata
└── cache/                                # Tier 2: Cached tiles and windowed COGs
```

---

## 3. Quick-Start: Automated Data Ingestion Utility

Use the built-in CLI utility [`scripts/data_manager.py`](file:///Users/tanmay/SIH-2026/scripts/data_manager.py):

### A. Inspect Current Data Status
```bash
.agents/venv/bin/python scripts/data_manager.py --status
```

### B. Download Dev Starter Pack (Run in 15 seconds)
```bash
.agents/venv/bin/python scripts/data_manager.py --download-sample
```
Downloads real Sentinel-2 optical imagery, co-registered Sentinel-1 SAR radar imagery, bi-temporal pairs over ISRO SAC Ahmedabad, and curated VQA question-answer samples.

### C. Test Live Satellite Streaming (Zero Disk Storage)
```bash
.agents/venv/bin/python scripts/data_manager.py --test-stac
```
Connects to live satellite catalogs for any coordinates (default: Ahmedabad / ISRO SAC; accepts `--lat` and `--lon`).

---

## 4. Connecting Every Data Source

### 1. BigEarthNet.txt (Primary Domain Adaptation Dataset)
* **What it is:** 590,326 co-registered Sentinel-1 SAR (VV, VH) + Sentinel-2 MSI (12 bands) image pairs with descriptive text captions.
* **Hugging Face Hub:** `BIFOLD-BigEarthNetv2-0/BigEarthNet.txt`
* **Download Metadata (Parquet, 445 MB):**
  ```bash
  .agents/venv/bin/python scripts/data_manager.py --download-benchmark bigearthnet-meta
  ```
* **Direct Python Loading:**
  ```python
  import pandas as pd
  df = pd.read_parquet("data/benchmarks/bigearthnet_txt/BigEarthNet.txt.parquet")
  print("Total captions:", len(df))
  print("Columns:", df.columns.tolist())
  ```

---

### 2. VRSBench (Single-Image VQA & Text-Guided Grounding)
* **What it is:** High-resolution optical satellite benchmark with 29,614 images, 126,141 VQA pairs, and 137,262 bounding-box grounding spans.
* **Hugging Face Hub:** `xiang709/VRSBench`
* **Download Annotations:**
  ```bash
  .agents/venv/bin/python scripts/data_manager.py --download-benchmark vrsbench
  ```
* **Sample Entry:**
  ```json
  {
    "image_id": "P0003_0002.png",
    "question": "What color are the large vehicles seen in the image?",
    "ground_truth": "Yellow",
    "type": "object color"
  }
  ```

---

### 3. CDVQA (Bi-temporal Change VQA)
* **What it is:** Bi-temporal change question answering ($t_1, t_2$) over multitemporal satellite imagery.
* **GitHub Repository:** `YZHJessica/CDVQA`
* **Download Complete Splits:**
  ```bash
  .agents/venv/bin/python scripts/data_manager.py --download-benchmark cdvqa
  ```
* **Files saved:** `Test_questions.json`, `Test_answers.json`, `Train_questions.json`, `Train_answers.json`.

---

### 4. RSVQA (Baseline Remote Sensing VQA)
* **Low-Resolution Split (Sentinel-2):** Zenodo Record `6344334`
  * Questions: `LR_split_train_questions.json` (11.9 MB)
  * Answers: `LR_split_val_answers.json` (2.7 MB)
* **High-Resolution Split (Aerial 0.15m):** Zenodo Record `6344367`
  * Questions & Answers: `USGS_split_test_phili_answers.json`
* **Direct Download via Curl:**
  ```bash
  curl -L -o data/benchmarks/rsvqa_lr_questions.json "https://zenodo.org/records/6344334/files/LR_split_train_questions.json?download=1"
  curl -L -o data/benchmarks/rsvqa_lr_answers.json "https://zenodo.org/records/6344334/files/LR_split_val_answers.json?download=1"
  ```

---

### 5. Live Satellite APIs: AWS Element84 STAC & Planetary Computer
* **Protocol:** SpatioTemporal Asset Catalog (STAC) REST API.
* **Cost:** 100% Free, Public, Open Access.
* **Optical Endpoint:** `https://earth-search.aws.element84.com/v1/search`
* **SAR Radar Endpoint:** `https://planetarycomputer.microsoft.com/api/stac/v1/search`
* **Example Query Function:**
  ```python
  import requests

  def query_sentinel2(lon: float, lat: float, date_range: str = "2024-01-01/2024-05-31"):
      url = "https://earth-search.aws.element84.com/v1/search"
      payload = {
          "collections": ["sentinel-2-l2a"],
          "bbox": [lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05],
          "datetime": date_range,
          "query": {"eo:cloud_cover": {"lt": 10}},
          "limit": 5
      }
      resp = requests.post(url, json=payload).json()
      return [feat["assets"]["visual"]["href"] for feat in resp.get("features", [])]
  ```

---

## 5. How the System Consumes the Data

1. **Python FastAPI Backend (`engine/`):**
   * Reads local GeoTIFFs or remote COG URLs using `rasterio.open()`.
   * Passes bounding box windows directly into PyTorch inference pipelines (`RemoteCLIP`, `ChangeFormer`, `MobileSAM`) without storing redundant rasters.
2. **Frontend MapLibre GL Canvas:**
   * Visualizes base optical satellite layers and SAR overlays.
   * `maplibre-gl-compare` swipe curtain displays $t_1$ vs $t_2$ bitemporal differences.
   * SAM and VQA bounding boxes rendered as glowing Cyan `#00E5FF` GeoJSON polygons.
