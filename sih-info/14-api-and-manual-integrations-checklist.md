# SatQuery AI: API & Manual Integrations Checklist
**Target Problem Statement:** SIH26167 (ISRO / Space Applications Centre)  
**File Location:** [`sih-info/14-api-and-manual-integrations-checklist.md`](file:///Users/tanmay/SIH-2026/sih-info/14-api-and-manual-integrations-checklist.md)  
**Config Template:** [`backend/.env.example`](file:///Users/tanmay/SIH-2026/backend/.env.example)  

---

## 1. Executive Summary: What Works Now vs What Needs Keys

You do **NOT** need any API keys to run the prototype right now. We engineered the entire baseline on open-access, zero-credential infrastructure:

```
┌────────────────────────────────────────────────────────────────────────┐
│ STATUS: WORKING OUT-OF-THE-BOX (ZERO KEYS REQUIRED)                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Vector Globe Basemap: OpenFreeMap Dark (No Mapbox token needed)     │
│ 2. Optical Satellite Stream: AWS Open Data Element84 STAC (Sentinel-2) │
│ 3. SAR Radar Satellite Stream: Microsoft Planetary Computer STAC (S1)  │
│ 4. Local Benchmark Data: VRSBench, CDVQA, Ahmedabad sample pairs       │
└────────────────────────────────────────────────────────────────────────┘
```

Below is the exhaustive checklist of **optional external accounts & manual API keys** you may want to register for as the team advances toward model fine-tuning and the Grand Finale.

---

## 2. Manual Integration Checklist

### 1. Hugging Face Access Token (`HF_TOKEN`)
* **When you need it:** If downloading gated vision-language model weights (e.g. Llama-3.2-Vision, Qwen2-VL checkpoints) or if Hugging Face rate-limits anonymous IP requests during heavy data downloads.
* **Cost:** 100% Free.
* **How to obtain:**
  1. Go to [https://huggingface.co/join](https://huggingface.co/join) and create a free account.
  2. Navigate to **Settings** → **Access Tokens** ([https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).
  3. Click **Create new token**, select type **Read**, and copy the token (`hf_...`).
* **Where to paste:**
  In `backend/.env`:
  ```bash
  HF_TOKEN=hf_your_token_here
  ```
  Or in your terminal session:
  ```bash
  export HF_TOKEN=hf_your_token_here
  ```

---

### 2. Copernicus Data Space Ecosystem (CDSE)
* **When you need it:** If you want to download official European Space Agency raw `.SAFE` Sentinel-1/2 products directly from Europe rather than the AWS Open Data mirror.
* **Cost:** 100% Free (Public European Union program).
* **How to obtain:**
  1. Register at [https://dataspace.copernicus.eu](https://dataspace.copernicus.eu).
  2. Complete email verification.
* **Where to paste:**
  In `backend/.env`:
  ```bash
  CDSE_USERNAME=your_email@example.com
  CDSE_PASSWORD=your_password
  ```

---

### 3. ISRO Bhuvan & MOSDAC Portals
* **When you need it:** To access sovereign Indian satellite WMS/WFS map layers (Cartosat, Resourcesat, Oceansat-3, INSAT-3D weather products).
* **Cost:** 100% Free for Indian nationals and academic institutions.
* **How to obtain:**
  1. **Bhuvan:** Register at [https://bhuvan.nrsc.gov.in](https://bhuvan.nrsc.gov.in).
  2. **MOSDAC:** Register at [https://mosdac.gov.in](https://mosdac.gov.in) (Space Applications Centre meteorological and oceanographic archive).
* **Hackathon Note:** For the SIH Grand Finale, the ISRO/SAC evaluation panel will provide held-out Cartosat-2S and RISAT-1A image pairs directly to finalists on USB drives or local network shares.

---

### 4. Cloud LLM Inference Keys (Optional Comparative Evaluation)
* **When you need it:** If you want to compare your local specialized RemoteCLIP/MobileSAM model results side-by-side with commercial frontier models (Google Gemini or Anthropic Claude) in front of the judges.
* **Providers:**
  - **Google AI Studio (Gemini):** Get free API key at [https://aistudio.google.com](https://aistudio.google.com).
  - **Anthropic (Claude):** Get API key at [https://console.anthropic.com](https://console.anthropic.com).
* **Where to paste:**
  In `backend/.env`:
  ```bash
  GEMINI_API_KEY=AIzaSy...
  ANTHROPIC_API_KEY=sk-ant-...
  ```

---

### 5. Mapbox GL Token (Optional Proprietary Basemap)
* **Status:** **NOT NEEDED**.
* We intentionally use **OpenFreeMap Dark** (`https://tiles.openfreemap.org/styles/dark`) which has zero cost and zero rate limits.
* If you ever specifically want Mapbox's proprietary satellite aerial basemap:
  1. Create account at [https://account.mapbox.com](https://account.mapbox.com).
  2. Copy public token (`pk.eyJ1...`).
  3. Paste in `frontend/.env`: `VITE_MAPBOX_TOKEN=pk.eyJ1...`

---

## 3. Security Rule: Never Commit API Keys to Git!

Our project has automated security hooks (`git secrets --scan` and `.agents/test-runner.sh`) that will block git commits if any real secret or API key is detected in source code.

* Always keep your actual keys inside `backend/.env` or `frontend/.env`.
* `.env` is already added to `.gitignore`.
* Use [`backend/.env.example`](file:///Users/tanmay/SIH-2026/backend/.env.example) as your reference template.
