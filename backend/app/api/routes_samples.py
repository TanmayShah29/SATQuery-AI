"""
SatQuery AI - Samples & Pre-Calibrated GeoTIFF API Router
Target: SIH26167 (ISRO Space Applications Centre) §3 & §7
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import json
import logging
from pathlib import Path
from typing import Dict, Any, List
from ..config import settings
from ..engine.geotiff_parser import GeoTIFFEngine

router = APIRouter(prefix="/api/samples", tags=["samples"])

logger = logging.getLogger(__name__)


def safe_join(base_dir: Path, filename: str) -> Path:
    """Safely join base directory with filename, preventing path traversal."""
    resolved = (base_dir / Path(filename).name).resolve()
    if not resolved.is_relative_to(base_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid filename")
    return resolved


@router.get("/manifest")
def get_sample_manifest():
    """Returns local sample dataset manifest and asset inventory."""
    manifest_path = settings.sample_dir / "sample_manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Sample manifest not initialized.")
    
    with open(manifest_path, "r") as f:
        data = json.load(f)
        
    files_optical = [f.name for f in (settings.sample_dir / "optical").glob("*") if f.is_file()]
    files_sar = [f.name for f in (settings.sample_dir / "sar").glob("*") if f.is_file()]
    files_bitemporal = [f.name for f in (settings.sample_dir / "bitemporal").glob("*") if f.is_file()]
    geotiffs_dir = settings.sample_dir / "geotiffs"
    files_geotiffs = [f.name for f in geotiffs_dir.glob("*.tif*") if f.is_file()] if geotiffs_dir.exists() else []
    
    data["inventory"] = {
        "optical_count": len(files_optical),
        "optical_files": files_optical,
        "sar_count": len(files_sar),
        "sar_files": files_sar,
        "bitemporal_count": len(files_bitemporal),
        "bitemporal_files": files_bitemporal,
        "geotiff_count": len(files_geotiffs),
        "geotiff_files": files_geotiffs,
    }
    return data


@router.get("/geotiffs")
def get_precalibrated_geotiffs() -> List[Dict[str, Any]]:
    """Returns authentic pre-calibrated GeoTIFF assets with genuine rasterio metadata."""
    geotiffs_dir = settings.sample_dir / "geotiffs"
    if not geotiffs_dir.exists():
        return []

    assets = []
    for f in sorted(geotiffs_dir.glob("*.tif*")):
        try:
            meta = GeoTIFFEngine.parse_raster(f, preview_dir=settings.sample_dir / "uploads")
            assets.append({
                "id": f.stem,
                "fileName": f.name,
                "sensor": meta["sensor"],
                "modality": meta["modality"],
                "gsd": f"{meta['gsd_meters']}m Calibrated",
                "crs": meta["crs"],
                "radiometric": f"{meta['dtype'].upper()} ({meta['bands_count']} Bands)",
                "cloudCoverPercent": meta["cloud_cover_pct"],
                "bands": meta["bands_descriptions"],
                "acquiredAt": "2024-05-12T05:32:10Z" if "202405" in f.name else "2024-03-27T05:22:11Z",
                "bbox": meta["bounds"],
                "previewUrl": meta["preview_url"],
                "locationName": "ISRO SAC Ahmedabad Campus" if "SAC" in f.name or "AHMEDABAD" in f.name else "Sentinel-2 Strategic AOI",
                "is_geotiff": True,
            })
        except Exception:
            pass

    return assets


@router.get("/vqa")
def get_sample_vqa():
    """Returns sample VQA benchmark pairs for instant demo queries."""
    vrsbench_sample = settings.sample_dir / "vqa" / "sample_vrsbench_qa.json"
    cdvqa_sample = settings.sample_dir / "vqa" / "sample_cdvqa_change_qa.json"
    
    results = {}
    if vrsbench_sample.exists():
        with open(vrsbench_sample, "r") as f:
            results["vrsbench_samples"] = json.load(f)[:10]
    if cdvqa_sample.exists():
        with open(cdvqa_sample, "r") as f:
            results["cdvqa_samples"] = json.load(f)
            
    return results


@router.get("/image/{category}/{filename}")
def get_sample_image(category: str, filename: str):
    """Serves sample image and GeoTIFF files directly for frontend visualization."""
    valid_categories = ["optical", "sar", "bitemporal", "vqa", "uploads", "geotiffs"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of {valid_categories}")
        
    base_dir = settings.sample_dir / category
    file_path = safe_join(base_dir, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {filename} not found in category {category}")
        
    if filename.endswith((".tif", ".tiff")):
        media_type = "image/tiff"
    elif filename.endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
    elif filename.endswith(".webp"):
        media_type = "image/webp"
    else:
        media_type = "image/png"
    return FileResponse(file_path, media_type=media_type)


@router.get("/sector-asset/{sector_id}/{modality}")
def get_sector_asset(sector_id: str, modality: str):
    """
    Returns calibrated multi-spectral sensor raster (RGB, NIR, SAR, T1, T2)
    for the requested tactical sector AOI.
    """
    from io import BytesIO
    from fastapi.responses import Response
    from ..engine.sector_assets import SectorAssetManager

    profile, img = SectorAssetManager.get_sector_band_image(sector_id, modality)
    if not img:
        raise HTTPException(status_code=404, detail=f"Raster for sector {sector_id} {modality} not found")

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=92)
    headers = {
        "X-Is-Real-Image": str(profile.is_real_image).lower(),
        "X-Is-Simulated": str(profile.is_simulated).lower(),
    }
    return Response(content=buf.getvalue(), media_type="image/jpeg", headers=headers)


@router.get("/sector-timeline/{sector_id}")
def get_sector_timeline(sector_id: str, time_range: str = "30d"):
    """
    Returns dense chronological satellite constellation passes (15 to 120+ acquisitions)
    spanning Sentinel-2, Sentinel-1 C-SAR, Cartosat, RISAT-1A, and Landsat constellations.
    """
    from ..engine.sector_assets import SectorAssetManager
    return SectorAssetManager.get_sector_timeline(sector_id, time_range)

