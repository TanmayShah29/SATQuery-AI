# What to Connect Afterwards (Checklist for Later)

> **Note:** Everything in the app works right now out-of-the-box using 100% free, keyless open satellite streams (OpenFreeMap + AWS Sentinel-2 + MS Planetary Sentinel-1). You only need this checklist when you want to expand or fine-tune models later.

---

### 1. Optional API Keys & Portals

| Service | Why You Might Need It | Where to Register (All Free) | Where to Put It |
|---|---|---|---|
| **Hugging Face Token** | Download gated weights (Llama-3.2-Vision, Qwen2-VL) without rate limits | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | `HF_TOKEN=hf_...` in `backend/.env` |
| **Copernicus CDSE** | Download raw ESA `.SAFE` archives directly from European servers | [dataspace.copernicus.eu](https://dataspace.copernicus.eu) | `CDSE_USERNAME=...` in `backend/.env` |
| **ISRO Bhuvan / MOSDAC** | Sovereign Indian satellite layers (Cartosat, INSAT-3D weather) | [bhuvan.nrsc.gov.in](https://bhuvan.nrsc.gov.in) | `BHUVAN_API_KEY=...` in `backend/.env` |

> **Removed:** Gemini/Anthropic API key integration was removed from this project. The
> problem statement's Section 7 disqualification rule rules out any solution built on
> a generic LLM/VLM without remote-sensing adaptation — so these keys are intentionally
> not wired into the query pipeline anywhere.

---

### 2. How to Setup Your `.env` File
When you are ready to add any of these keys:
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and paste your keys. `.env` is automatically git-ignored so it will never leak.

**Security Note:** Never show or share your `.env` file. It contains live credentials.

---

*Detailed guide saved at: [`sih-info/14-api-and-manual-integrations-checklist.md`](file:///Users/tanmay/SIH-2026/sih-info/14-api-and-manual-integrations-checklist.md)*
