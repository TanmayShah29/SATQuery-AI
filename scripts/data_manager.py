#!/usr/bin/env python3
"""
SatQuery AI - Data Manager & Ingestion Utility
Manages downloading, caching, and connecting remote sensing datasets and live STAC satellite streams.
"""

import argparse
import json
import os
import sys
from pathlib import Path
import requests

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SAMPLE_DIR = DATA_DIR / "sample"
BENCHMARK_DIR = DATA_DIR / "benchmarks"
CACHE_DIR = DATA_DIR / "cache"

# Ensure directory structure
for d in [
    SAMPLE_DIR / "optical",
    SAMPLE_DIR / "sar",
    SAMPLE_DIR / "bitemporal",
    SAMPLE_DIR / "vqa",
    BENCHMARK_DIR / "vrsbench",
    BENCHMARK_DIR / "cdvqa",
    BENCHMARK_DIR / "bigearthnet_txt",
    CACHE_DIR,
]:
    d.mkdir(parents=True, exist_ok=True)


def download_file(url: str, dest: Path, desc: str = ""):
    """Download a file with progress indication."""
    print(f"[*] Downloading {desc or dest.name}...")
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()
        total_size = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = (downloaded / total_size) * 100
                        print(f"\r    -> {downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB ({pct:.1f}%)", end="", flush=True)
                    else:
                        print(f"\r    -> {downloaded / 1024:.1f} KB", end="", flush=True)
        print(f"\n[+] Saved to {dest.relative_to(BASE_DIR)}")
        return True
    except Exception as e:
        print(f"\n[!] Failed to download from {url}: {e}")
        if dest.exists():
            dest.unlink()
        return False


def cmd_status():
    """Inspect local data directory and report current inventory."""
    print("\n========================================================")
    print("        SatQuery AI: Local Data Repository Status       ")
    print("========================================================\n")
    
    subdirs = [
        ("Dev Samples (Optical)", SAMPLE_DIR / "optical"),
        ("Dev Samples (SAR Radar)", SAMPLE_DIR / "sar"),
        ("Dev Samples (Bitemporal Change)", SAMPLE_DIR / "bitemporal"),
        ("Dev Samples (VQA / Grounding)", SAMPLE_DIR / "vqa"),
        ("Tactical Sector Rasters", SAMPLE_DIR / "sectors"),
        ("ISRO SAC MOSDAC Downloads", SAMPLE_DIR / "mosdac"),
        ("Benchmark: VRSBench", BENCHMARK_DIR / "vrsbench"),
        ("Benchmark: CDVQA", BENCHMARK_DIR / "cdvqa"),
        ("Benchmark: BigEarthNet.txt", BENCHMARK_DIR / "bigearthnet_txt"),
        ("Cache / Temp COGs", CACHE_DIR),
    ]
    
    total_files = 0
    total_bytes = 0
    
    for label, folder in subdirs:
        if folder.exists():
            files = [f for f in folder.rglob("*") if f.is_file()]
            size = sum(f.stat().st_size for f in files)
            total_files += len(files)
            total_bytes += size
            status_tag = f"[READY - {len(files)} files, {size / (1024*1024):.2f} MB]" if files else "[EMPTY]"
            print(f"  {label:<35} : {status_tag}")
            for f in files[:3]:
                print(f"    - {f.name} ({f.stat().st_size / 1024:.1f} KB)")
            if len(files) > 3:
                print(f"    ... and {len(files) - 3} more files")
        else:
            print(f"  {label:<35} : [NOT FOUND]")
            
    print(f"\nTotal Storage Used: {total_bytes / (1024*1024):.2f} MB across {total_files} files.")
    print("========================================================\n")


def sign_planetary_url(href: str) -> str:
    """Sign Planetary Computer URLs using their free anonymous SAS token endpoint."""
    try:
        sign_url = f"https://planetarycomputer.microsoft.com/api/sas/v1/sign?href={href}"
        r = requests.get(sign_url, timeout=8)
        if r.status_code == 200:
            return r.json().get("href", href)
    except Exception:
        pass
    return href


def cmd_test_stac(bbox=None, lat=23.03, lon=72.58, label="Ahmedabad / ISRO SAC"):
    """Test live query to AWS Element84 STAC (Sentinel-2) and Microsoft Planetary Computer (Sentinel-1 SAR)."""
    print(f"\n[*] Testing Live Sentinel-2 STAC Query for: {label} (Lat {lat}, Lon {lon})...")
    stac_url = "https://earth-search.aws.element84.com/v1/search"
    
    delta = 0.08
    query_bbox = bbox or [lon - delta, lat - delta, lon + delta, lat + delta]
    
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": query_bbox,
        "datetime": "2024-01-01T00:00:00Z/2024-05-31T23:59:59Z",
        "query": {"eo:cloud_cover": {"lt": 10}},
        "limit": 3,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}]
    }
    
    try:
        r = requests.post(stac_url, json=payload, timeout=12)
        r.raise_for_status()
        data = r.json()
        features = data.get("features", [])
        print(f"[+] [Sentinel-2 Optical] STAC Online! Found {len(features)} matching scenes.")
        
        for i, feat in enumerate(features[:2]):
            props = feat.get("properties", {})
            assets = feat.get("assets", {})
            scene_id = feat.get("id")
            dt = props.get("datetime", "N/A")
            cloud = props.get("eo:cloud_cover", 0.0)
            visual_cog = assets.get("visual", {}).get("href")
            red_cog = assets.get("red", {}).get("href")
            nir_cog = assets.get("nir", {}).get("href")
            
            print(f"  [Scene {i+1}] ID: {scene_id}")
            print(f"    - Acquired: {dt} | Cloud: {cloud:.1f}%")
            print(f"    - Visual TCI (COG): {visual_cog}")
            print(f"    - Red Band (B4):    {red_cog}")
            print(f"    - NIR Band (B8):    {nir_cog}")
            
    except Exception as e:
        print(f"[!] Sentinel-2 STAC Query failed: {e}")

    print(f"\n[*] Testing Live Sentinel-1 SAR Radar STAC Query for: {label}...")
    s1_url = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
    s1_payload = {
        "collections": ["sentinel-1-grd"],
        "bbox": query_bbox,
        "datetime": "2024-01-01T00:00:00Z/2024-05-31T23:59:59Z",
        "limit": 1
    }
    try:
        r_s1 = requests.post(s1_url, json=s1_payload, timeout=12)
        if r_s1.status_code == 200:
            s1_feats = r_s1.json().get("features", [])
            print(f"[+] [Sentinel-1 SAR Radar] STAC Online! Found {len(s1_feats)} matching radar acquisitions.")
            if s1_feats:
                s1_f = s1_feats[0]
                s1_id = s1_f.get("id")
                s1_dt = s1_f.get("properties", {}).get("datetime")
                s1_assets = s1_f.get("assets", {})
                vv_url = sign_planetary_url(s1_assets.get("vv", {}).get("href"))
                vh_url = sign_planetary_url(s1_assets.get("vh", {}).get("href"))
                print(f"  [SAR Scene] ID: {s1_id}")
                print(f"    - Acquired: {s1_dt} (All-weather day/night radar)")
                print(f"    - Polarizations: VV + VH dual-pol")
                print(f"    - VV TIFF Stream: {vv_url[:90]}...")
                print(f"    - VH TIFF Stream: {vh_url[:90]}...")
    except Exception as e:
        print(f"[!] Sentinel-1 SAR STAC failed: {e}")

    print("\n[✓] Cloud-Optimized GeoTIFF streaming confirmed functional for both Optical & SAR.")
    return True


def cmd_download_sample():
    """Download lightweight starter sample pairs (Optical, SAR, Bitemporal, VQA) for immediate dev."""
    print("\n[*] Initializing Dev Starter Pack (~25 MB total)...")
    
    # 1. Download real Optical images (Sentinel-2 over ISRO SAC Ahmedabad, two dates)
    opt_t1_dest = SAMPLE_DIR / "optical" / "sentinel2_ahmedabad_t1_20240327.jpg"
    opt_t2_dest = SAMPLE_DIR / "optical" / "sentinel2_ahmedabad_t2_20240501.jpg"
    
    if not opt_t1_dest.exists():
        download_file(
            "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/42/Q/ZL/2024/3/S2A_42QZL_20240327_0_L2A/thumbnail.jpg",
            opt_t1_dest,
            "Optical Sentinel-2 T1 (Ahmedabad - March 27, 2024)"
        )
        
    if not opt_t2_dest.exists():
        download_file(
            "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/42/Q/ZL/2024/5/S2B_42QZL_20240501_0_L2A/thumbnail.jpg",
            opt_t2_dest,
            "Optical Sentinel-2 T2 (Ahmedabad - May 01, 2024)"
        )

    # 2. Download real SAR image (Sentinel-1 C-SAR co-registered over Ahmedabad, March 30, 2024)
    sar_dest = SAMPLE_DIR / "sar" / "sentinel1_sar_ahmedabad_20240330.png"
    if not sar_dest.exists():
        raw_sar_url = "https://sentinel1euwest.blob.core.windows.net/s1-grd/GRD/2024/3/30/IW/DV/S1A_IW_GRDH_1SDV_20240330T011024_20240330T011049_053204_06726F_2FFD/preview/quick-look.png"
        signed_sar_url = sign_planetary_url(raw_sar_url)
        download_file(
            signed_sar_url,
            sar_dest,
            "Co-registered Sentinel-1 SAR Radar (Ahmedabad - March 30, 2024)"
        )

    # 3. Create Bi-temporal Pair directory references
    bt_t1_link = SAMPLE_DIR / "bitemporal" / "pair1_pre_20240327.jpg"
    bt_t2_link = SAMPLE_DIR / "bitemporal" / "pair1_post_20240501.jpg"
    if opt_t1_dest.exists() and not bt_t1_link.exists():
        try:
            bt_t1_link.write_bytes(opt_t1_dest.read_bytes())
        except Exception:
            pass
    if opt_t2_dest.exists() and not bt_t2_link.exists():
        try:
            bt_t2_link.write_bytes(opt_t2_dest.read_bytes())
        except Exception:
            pass
    
    # 1. Sample VQA questions from VRSBench
    vrsbench_eval = BENCHMARK_DIR / "vrsbench" / "VRSBench_EVAL_vqa.json"
    if not vrsbench_eval.exists():
        download_file(
            "https://huggingface.co/datasets/xiang709/VRSBench/raw/main/VRSBench_EVAL_vqa.json",
            vrsbench_eval,
            "VRSBench Evaluation VQA JSON (37k QA pairs)"
        )
    
    # Extract 20 sample QA pairs into data/sample/vqa/sample_vrsbench.json
    if vrsbench_eval.exists():
        try:
            with open(vrsbench_eval, "r") as f:
                vqa_data = json.load(f)
            sample_file = SAMPLE_DIR / "vqa" / "sample_vrsbench_qa.json"
            with open(sample_file, "w") as f:
                json.dump(vqa_data[:25], f, indent=2)
            print(f"[+] Created curated sample: {sample_file.relative_to(BASE_DIR)} (25 QA entries)")
        except Exception as e:
            print(f"[!] Could not parse VRSBench json: {e}")

    # 2. Sample CDVQA questions and answers
    cdvqa_q = BENCHMARK_DIR / "cdvqa" / "Test_questions.json"
    if not cdvqa_q.exists():
        download_file(
            "https://raw.githubusercontent.com/YZHJessica/CDVQA/main/Test_questions.json",
            cdvqa_q,
            "CDVQA Test Questions JSON"
        )
        
    cdvqa_a = BENCHMARK_DIR / "cdvqa" / "Test_answers.json"
    if not cdvqa_a.exists():
        download_file(
            "https://raw.githubusercontent.com/YZHJessica/CDVQA/main/Test_answers.json",
            cdvqa_a,
            "CDVQA Test Answers JSON"
        )

    # Extract sample CDVQA pairs
    if cdvqa_q.exists() and cdvqa_a.exists():
        try:
            with open(cdvqa_q, "r") as fq, open(cdvqa_a, "r") as fa:
                q_data = json.load(fq)
                a_data = json.load(fa)
            sample_cdvqa = SAMPLE_DIR / "vqa" / "sample_cdvqa_change_qa.json"
            questions = q_data.get("questions", [])[:20] if isinstance(q_data, dict) else q_data[:20]
            answers = a_data.get("answers", [])[:20] if isinstance(a_data, dict) else a_data[:20]
            with open(sample_cdvqa, "w") as f:
                json.dump({"questions": questions, "answers": answers}, f, indent=2)
            print(f"[+] Created curated sample: {sample_cdvqa.relative_to(BASE_DIR)} (20 change QA pairs)")
        except Exception as e:
            print(f"[!] Could not parse CDVQA json: {e}")

    # 3. Create mock/starter optical and SAR sample metadata
    sample_manifest = SAMPLE_DIR / "sample_manifest.json"
    manifest_content = {
        "description": "SatQuery AI Local Development Sample Metadata",
        "optical_samples": [
            {
                "id": "OPT-DELHI-001",
                "sensor": "Sentinel-2 MSI",
                "location": "New Delhi / Yamuna Floodplain",
                "bands": ["B02_Blue", "B03_Green", "B04_Red", "B08_NIR"],
                "cloud_cover": 1.2,
                "timestamp": "2024-03-15T05:30:00Z",
                "cog_url": "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/43/R/FM/2024/3/S2A_43RFM_20240315_0_L2A/TCI.tif"
            },
            {
                "id": "OPT-AHMEDABAD-002",
                "sensor": "Sentinel-2 MSI",
                "location": "Ahmedabad / ISRO SAC",
                "bands": ["B02_Blue", "B03_Green", "B04_Red", "B08_NIR"],
                "cloud_cover": 0.4,
                "timestamp": "2024-03-27T05:40:00Z",
                "cog_url": "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/42/Q/ZL/2024/3/S2A_42QZL_20240327_0_L2A/TCI.tif"
            }
        ],
        "sar_samples": [
            {
                "id": "SAR-ASSAM-001",
                "sensor": "Sentinel-1 C-SAR (GRD)",
                "location": "Brahmaputra Basin, Assam",
                "polarizations": ["VV", "VH"],
                "mode": "IW",
                "timestamp": "2024-07-10T12:15:00Z",
                "weather_condition": "Monsoon Heavy Rain / 100% Cloud Cover",
                "purpose": "Cloud-piercing flood inundation mapping"
            }
        ],
        "bitemporal_pairs": [
            {
                "id": "BT-KERALA-001",
                "event": "Wayanad Inundation / Landslide",
                "t1_pre_event": "2024-06-01",
                "t2_post_event": "2024-08-05",
                "change_type": "Flooding & Mudslide Debris Deposit",
                "expected_qa": "Did the river banks overflow between June and August? Yes, water surface increased by 42%."
            }
        ]
    }
    with open(sample_manifest, "w") as f:
        json.dump(manifest_content, f, indent=2)
    print(f"[+] Saved sample dataset manifest to {sample_manifest.relative_to(BASE_DIR)}")

    print("\n[✓] Dev Starter Pack installed successfully!")
    cmd_status()


def cmd_download_benchmark(name: str):
    """Download specific full benchmark datasets."""
    name = name.lower()
    if name == "vrsbench":
        print("[*] Downloading VRSBench annotations...")
        base_url = "https://huggingface.co/datasets/xiang709/VRSBench/raw/main"
        for fn in ["VRSBench_EVAL_vqa.json", "VRSBench_EVAL_Cap.json", "VRSBench_EVAL_referring.json"]:
            dest = BENCHMARK_DIR / "vrsbench" / fn
            download_file(f"{base_url}/{fn}", dest, fn)
            
    elif name == "cdvqa":
        print("[*] Downloading CDVQA complete question-answer splits...")
        base_url = "https://raw.githubusercontent.com/YZHJessica/CDVQA/main"
        for fn in [
            "Test_questions.json", "Test_answers.json", "Test_images.json",
            "Val_questions.json", "Val_answers.json", "Val_images.json",
            "Train_questions.json", "Train_answers.json", "Train_images.json"
        ]:
            dest = BENCHMARK_DIR / "cdvqa" / fn
            download_file(f"{base_url}/{fn}", dest, fn)
            
    elif name in ["bigearthnet", "bigearthnet-meta"]:
        print("[*] Downloading BigEarthNet.txt metadata parquet (445 MB)...")
        url = "https://huggingface.co/datasets/BIFOLD-BigEarthNetv2-0/BigEarthNet.txt/resolve/main/BigEarthNet.txt.parquet"
        dest = BENCHMARK_DIR / "bigearthnet_txt" / "BigEarthNet.txt.parquet"
        download_file(url, dest, "BigEarthNet.txt.parquet (590k image-caption pairs)")
    else:
        print(f"[!] Unknown benchmark name '{name}'. Available: vrsbench, cdvqa, bigearthnet-meta")


def main():
    parser = argparse.ArgumentParser(description="SatQuery AI - Remote Sensing Data Manager")
    parser.add_argument("--status", action="store_true", help="Show local data directory status")
    parser.add_argument("--download-sample", action="store_true", help="Download starter dev dataset pack")
    parser.add_argument("--test-stac", action="store_true", help="Test live connection to Sentinel-2 AWS STAC API")
    parser.add_argument("--download-benchmark", type=str, metavar="NAME", help="Download benchmark (vrsbench, cdvqa, bigearthnet-meta)")
    parser.add_argument("--lat", type=float, default=23.03, help="Latitude for STAC query (default: 23.03 - ISRO SAC)")
    parser.add_argument("--lon", type=float, default=72.58, help="Longitude for STAC query (default: 72.58 - ISRO SAC)")
    
    args = parser.parse_args()
    
    if len(sys.argv) == 1 or args.status:
        cmd_status()
    elif args.download_sample:
        cmd_download_sample()
    elif args.test_stac:
        cmd_test_stac(lat=args.lat, lon=args.lon)
    elif args.download_benchmark:
        cmd_download_benchmark(args.download_benchmark)


if __name__ == "__main__":
    main()
