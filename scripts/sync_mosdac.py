#!/usr/bin/env python3
"""
SatQuery AI - ISRO MOSDAC Automated Synchronization Utility
Target: SIH26167 (ISRO / Space Applications Centre)

Wraps the official ISRO Space Applications Centre (SAC) MOSDAC Data Download API (mdapi.py),
synchronizes user credentials from backend/.env, and downloads SAC satellite products.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MOSDAC_DIR = BASE_DIR / "scripts" / "mosdac"
CONFIG_FILE = MOSDAC_DIR / "config.json"
MDAPI_SCRIPT = MOSDAC_DIR / "mdapi.py"
ENV_FILE = BASE_DIR / "backend" / ".env"
DATA_DIR = BASE_DIR / "data" / "sample" / "mosdac"

DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_env_credentials():
    """Extract MOSDAC_USERNAME and MOSDAC_PASSWORD from backend/.env."""
    username = os.getenv("MOSDAC_USERNAME", "")
    password = os.getenv("MOSDAC_PASSWORD", "")

    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip()
                    if k == "MOSDAC_USERNAME" and not username:
                        username = v
                    elif k == "MOSDAC_PASSWORD" and not password:
                        password = v

    return username, password


def update_config(dataset_id: str, start_time: str, end_time: str, count: str = "", bbox: str = "", skip_prompt: bool = True):
    """Updates scripts/mosdac/config.json with active credentials and search parameters."""
    username, password = load_env_credentials()

    if not (username and password):
        print("\n[!] Error: MOSDAC credentials not found in backend/.env!")
        print("    Please add your ISRO MOSDAC credentials in backend/.env:")
        print("      MOSDAC_USERNAME=your_email_or_username")
        print("      MOSDAC_PASSWORD=your_password\n")
        sys.exit(1)

    config_data = {
        "user_credentials": {
            "username/email": username,
            "password": password
        },
        "search_parameters": {
            "datasetId": dataset_id or "3RIMG_L2B_SST",
            "startTime": start_time or "2024-01-01",
            "endTime": end_time or "2024-01-01",
            "count": count or "",
            "boundingBox": bbox or "",
            "gId": ""
        },
        "download_settings": {
            "download_path": str(DATA_DIR),
            "organize_by_date": False,
            "skip_user_input": skip_prompt,
            "generate_error_logs": True,
            "error_logs_dir": str(DATA_DIR / "logs")
        }
    }

    (DATA_DIR / "logs").mkdir(parents=True, exist_ok=True)

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=4)

    print(f"[+] Updated MOSDAC config: dataset={config_data['search_parameters']['datasetId']}, dest={DATA_DIR}")
    return True


def run_download():
    """Executes the official SAC mdapi.py script."""
    if not MDAPI_SCRIPT.exists():
        print(f"[!] Error: {MDAPI_SCRIPT} not found!")
        sys.exit(1)

    print("[*] Launching ISRO SAC MOSDAC Data Download API (mdapi.py)...")
    python_bin = sys.executable
    # Run in MOSDAC_DIR so it finds config.json
    res = subprocess.run([python_bin, str(MDAPI_SCRIPT)], cwd=str(MOSDAC_DIR))
    return res.returncode


def main():
    parser = argparse.ArgumentParser(description="SatQuery AI - ISRO SAC MOSDAC Sync Tool")
    parser.add_argument("--datasetId", default="3RIMG_L2B_SST", help="MOSDAC Dataset ID (e.g., 3RIMG_L2B_SST, 3DIMG_L1B_STD)")
    parser.add_argument("--start", default="2024-01-01", help="Start Date (YYYY-MM-DD)")
    parser.add_argument("--end", default="2024-01-01", help="End Date (YYYY-MM-DD)")
    parser.add_argument("--count", default="1", help="Maximum scenes to download")
    parser.add_argument("--bbox", default="", help="Bounding Box (min_lon, min_lat, max_lon, max_lat)")
    parser.add_argument("--prompt", action="store_true", help="Prompt before downloading")
    args = parser.parse_args()

    print("==========================================================")
    print("      ISRO SAC MOSDAC Satellite Sync (SIH 26167)          ")
    print("==========================================================")
    
    update_config(
        dataset_id=args.datasetId,
        start_time=args.start,
        end_time=args.end,
        count=args.count,
        bbox=args.bbox,
        skip_prompt=not args.prompt
    )
    
    run_download()


if __name__ == "__main__":
    main()
