# SatQuery AI — Geospatial Intelligence & Remote Sensing VLM Studio

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://sih.gov.in)
[![Challenge](https://img.shields.io/badge/Challenge-PS%2026167-blue.svg)](sih-info/selected-problem-statement-26167.md)
[![Organization](https://img.shields.io/badge/Sponsor-ISRO%20%2F%20SAC-green.svg)](https://www.isro.gov.in)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB.svg)](https://vitejs.dev)

> **Team Name:** Divya Drishti (दिव्य दृष्टि)  
> **Target Challenge:** Problem Statement 26167 — **SatQuery AI**  
> **Sponsoring Agency:** Indian Space Research Organisation (ISRO) — Space Applications Centre (SAC)  
> **Team Leader:** Tanmay Shah (`230020107079`)

---

## 🛰️ Overview

**SatQuery AI** is an operational-grade Geospatial Intelligence & Remote Sensing Vision-Language Studio. Designed to move beyond generic LLM chatbots and "AI wrappers," SatQuery AI provides an interactive, map-centric workbench with native raster ingestion, multi-spectral band processing, and pixel-grounded geospatial reasoning.

### Key Capabilities
- **Map-Centric Studio Canvas**: 60fps MapLibre GL vector and satellite globe with multi-layer overlays (optical, SAR, thermal, and ND-indices).
- **Native Geospatial Ingestion**: Parses Cloud-Optimized GeoTIFFs (COGs), Sentinel-2 MSI, Sentinel-1 SAR (GRD), and Cartosat imagery with preserved UTM/WGS84 geotransforms.
- **Vision-Language Reasoning**: Specialist VLM pipeline for earth observation using RemoteCLIP, VRSBench evaluation, and CDVQA benchmarks.
- **Automated Change Detection**: Multi-temporal change analysis with pixel-level difference masks and sector timeline tracking.
- **Auditable Execution Trace**: Transparent inspection drawer displaying model routing, confidence metrics, latency, and tensor dimensions.
- **Operational Intelligence Export**: Export detected AOIs, vector footprints, and mission reports directly into GeoJSON, Shapefile, and PDF briefings.

---

## 📁 Repository Structure

```
├── backend/                   # FastAPI high-performance backend
│   ├── app/
│   │   ├── agent/             # VLM agent router, action planner & evidence builder
│   │   ├── api/               # REST & WebSocket endpoints (query, STAC, benchmark, upload)
│   │   ├── engine/            # GeoTIFF parser, SAR fusion, change detector
│   │   └── models/            # RemoteCLIP, BigEarthNet adapters, model registry
│   └── tests/                 # Comprehensive test suite & API contracts
├── frontend/                  # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        # MapCanvas, OperationalPanels, SwipeCurtain, Globe
│   │   ├── pages/             # Studio, AuditStudio, Benchmarks
│   │   └── stores/            # Zustand state stores (query, UI, layers)
├── data/
│   ├── benchmarks/            # CDVQA and VRSBench benchmark ground truths
│   ├── sample/                # Sample GeoTIFFs, SAR products, and sector assets
│   └── weights/               # Model weights & adapters (large weights git-ignored)
├── sih-info/                  # Comprehensive SIH 2026 Master Dossier & slides
│   ├── README.md              # Master dossier quick start & index
│   ├── 07-satquery-production-architecture.md
│   ├── 08-satquery-datasets-and-tech-ecosystem.md
│   ├── 09-ui-ux-design-specification.md
│   └── 12-complete-application-build-plan.md
├── Dockerfile                 # Containerized deployment
└── nginx.conf                 # Reverse proxy & static serving config
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and `npm`
- GDAL / Rasterio runtime libraries (for GeoTIFF operations)

### 2. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the FastAPI server on port 8000
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API docs will be available at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The application will launch at `http://localhost:3000`.

---

## 📚 Documentation & Hackathon Dossier

Full technical documentation, architectural specifications, and presentation slide decks are available in the [`sih-info/`](sih-info/README.md) directory:

- [Master Dossier Index](sih-info/README.md)
- [Official Problem Statement 26167 Details](sih-info/selected-problem-statement-26167.md)
- [System Architecture Specification](sih-info/07-satquery-production-architecture.md)
- [UI/UX & Map Experience Design](sih-info/09-ui-ux-design-specification.md)
- [Datasets & Remote Sensing Models](sih-info/08-satquery-datasets-and-tech-ecosystem.md)
- [Team Roster & Compliance](sih-info/team.md)

---

## 🛡️ License

Developed for the Smart India Hackathon (SIH) 2026 under the ISRO / SAC challenge. All rights reserved by Team Divya Drishti.
