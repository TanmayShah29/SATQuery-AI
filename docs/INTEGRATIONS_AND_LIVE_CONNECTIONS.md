# SatQuery AI — Integration Guide
## Project: Divya-Drishti / SIH26167

---

## Current Status (Honest — Updated September 2026)

This document supersedes all previous marketing claims. It reflects the actual implemented state of the system.

---

## What Actually Works

| Component | Status | Notes |
|-----------|--------|-------|
| Local PyTorch inference (ResNet18 + BigEarthNet adapter) | ✅ Working | Produces 512-d embeddings for image similarity |
| Otsu-based change detection | ✅ Working | Labels it "Siamese Change Transformer" in UI — that is incorrect; label corrected |
| Lee speckle filter for SAR | ✅ Working | 1980 algorithm (Lee, 1980), functional |
| GeoTIFF parsing with CRS/GSD extraction | ✅ Working | Real rasterio-based parsing |
| STAC search for Sentinel-2/Sentinel-1 | ✅ Working | Live, but not yet wired into the query response path |
| Ollama local LLM (Qwen2.5-3B) | ✅ Working | Requires `ollama serve` running locally |
| Upload + pixel inspection | ✅ Working | Path traversal and size limits in place |
| SQLite session persistence | ✅ Working | Uploads and query history stored in `data/satquery.db` |

---

## What Was Fabricated and Has Been Corrected

| Claim | Reality | Fix Applied |
|-------|---------|-------------|
| "Siamese Change Transformer" | Otsu thresholding (classical method) | Label corrected in UI |
| "89.2% F1 on LEVIR-CD" | Hardcoded JS constant, never computed | Removed; replaced with honest benchmark disclosure |
| "Official grand finale held-out dataset" | Does not exist | Relabelled as "Internal Validation Set" |
| "SHA-256 tamper-proof ledger" | Constant hash, not computed per-export | Changed to client-computed hash with disclosure note |
| "ISRO Bhuvan CONNECTED / MOSDAC READY" | Hardcoded pulsing green dots | Labels now reflect actual connection state |
| "InSAR Phase Coherence" | No InSAR code implemented | Replaced with "Multi-temporal SAR Change Detection" |
| `$VV/VH$` in UI text | Raw LaTeX not rendered | Changed to plain text `(VV/VH)` |
| Benchmark leaderboard table | All metrics hardcoded | Table removed; Benchmark Studio shows real results |

---

## External Connections (When Configured)

| Service | Purpose | Env Variable | Required? |
|---------|---------|--------------|-----------|
| ISRO Bhuvan | LULC data | `BHUVAN_API_KEY` | Optional |
| MOSDAC | Weather satellite data | `MOSDAC_USERNAME`, `MOSDAC_PASSWORD` | Optional |
| AWS Element84 STAC | Sentinel-2/1 imagery catalog | (open access) | Optional |
| Microsoft Planetary Computer | Additional Earth data | (open access) | Optional |
| Ollama | Local LLM text generation | `OLLAMA_HOST` | Required for query responses |
| Hugging Face | Model weight downloads | `HF_TOKEN` | Optional |

---

## Security Configuration

| Setting | Env Variable | Default | Notes |
|---------|-------------|---------|-------|
| API key auth (query/upload/benchmark) | `SATQUERY_API_KEY` | "" (disabled) | Set to non-empty string to enable |
| Allowed CORS origin | `FRONTEND_URL` | `http://localhost:5173` | Set to your frontend URL in production |
| Environment mode | `SATQUERY_ENV` | `development` | Set to `production` to disable Swagger docs |

---

## Setup Instructions

```bash
# 1. Copy environment template
cp backend/.env.example backend/.env

# 2. Fill in backend/.env (keep this file gitignored!)
# BHUVAN_API_KEY=<your-key>
# OLLAMA_HOST=http://127.0.0.1:11434

# 3. Start Ollama
ollama serve &
ollama pull qwen2.5:3b

# 4. Start backend
cd backend && uvicorn app.main:app --port 8080 --reload

# 5. Start frontend
cd frontend && npm run dev
```

---

> **Note for judges / evaluators:** The `.env` file is gitignored and must not be committed. 
> A `.env.example` template is provided with all variable names but no real secrets.
