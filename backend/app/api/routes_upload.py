"""
SatQuery AI - File & Raster Upload API Router
Target: SIH26167 (ISRO Space Applications Centre) §3 & §7

Handles genuine ingestion of GeoTIFFs, satellite rasters, and GeoJSON files
using rasterio to extract true projection CRS, GSD, bands, and bounds.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
import json
import re
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from ..config import settings
from ..engine.geotiff_parser import GeoTIFFEngine

router = APIRouter(prefix="/api", tags=["upload"])

UPLOAD_DIR = settings.sample_dir / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory session registry of active uploaded rasters
ACTIVE_UPLOADED_RASTERS: Dict[str, Dict[str, Any]] = {}

# Allowed file extensions for upload
ALLOWED_EXTENSIONS = {'.tif', '.tiff', '.png', '.jpg', '.jpeg', '.geojson', '.json'}
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB

logger = logging.getLogger(__name__)


def sanitize_filename(raw_name: str) -> str:
    """Sanitize filename to prevent path traversal attacks."""
    safe_stem = re.sub(r'[^\w\-.]', '_', Path(raw_name).stem)[:100]
    safe_ext = Path(raw_name).suffix.lower()
    if safe_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {safe_ext} not allowed. Accepted: {ALLOWED_EXTENSIONS}")
    return f"{safe_stem}_{uuid.uuid4().hex[:8]}{safe_ext}"


def safe_join(base_dir: Path, filename: str) -> Path:
    """Safely join base directory with filename, preventing path traversal."""
    resolved = (base_dir / Path(filename).name).resolve()
    if not resolved.is_relative_to(base_dir.resolve()):
        raise HTTPException(status_code=400, detail="Invalid filename")
    return resolved


def _validate_raster_content(content: bytes, ext: str) -> None:
    """Reject declared-type/content mismatches and minuscule garbage files."""
    min_len = 32
    if ext in (".tif", ".tiff"):
        if content[:2] not in (b"II", b"MM") or content[2:4] not in (b"*\x00", b"\x00*", b"+\x00", b"\x00+"):
            raise HTTPException(status_code=400, detail="Declared .tif/.tiff file does not match TIFF magic bytes.")
    elif ext == ".png":
        if content[:8] != b"\x89PNG\r\n\x1a\n":
            raise HTTPException(status_code=400, detail="Declared .png file does not match PNG magic bytes.")
    elif ext in (".jpg", ".jpeg"):
        if content[:3] != b"\xff\xd8\xff":
            raise HTTPException(status_code=400, detail="Declared .jpg/.jpeg file does not match JPEG magic bytes.")
    if len(content) < min_len:
        raise HTTPException(status_code=400, detail=f"File too small to be a valid raster ({len(content)} bytes).")


@router.post("/upload")
async def upload_dataset_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Ingests real satellite datasets, GeoTIFF rasters, and vector GeoJSON files.
    Extracts authentic CRS, GSD, bands, and bounding box with zero simulation.
    """
    raw_name = file.filename or "uploaded_asset"
    filename = sanitize_filename(raw_name)
    ext = Path(filename).suffix.lower()  # derive ext from sanitized filename

    content = bytearray()
    while chunk := await file.read(8192):
        content.extend(chunk)
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File exceeds maximum size of {MAX_UPLOAD_SIZE // (1024*1024)}MB")
    content = bytes(content)

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if ext not in (".geojson", ".json"):
        _validate_raster_content(content, ext)

    # 1. Handle GeoJSON files (validate BEFORE persisting so a 400 leaves no orphan)
    if ext in [".geojson", ".json"]:
        try:
            data = json.loads(content.decode("utf-8"))
            if "type" in data and (data["type"] in ["FeatureCollection", "Feature"]):
                features = data.get("features", [data] if data["type"] == "Feature" else [])
                lons = []
                lats = []
                for feat in features:
                    geom = feat.get("geometry", {})
                    coords = geom.get("coordinates", [])
                    def extract_pts(c):
                        if isinstance(c, list):
                            if len(c) >= 2 and isinstance(c[0], (int, float)) and isinstance(c[1], (int, float)):
                                lons.append(c[0])
                                lats.append(c[1])
                            else:
                                for sub in c:
                                    extract_pts(sub)
                    extract_pts(coords)

                bbox = [min(lons), min(lats), max(lons), max(lats)] if (lons and lats) else None

                dest_file = safe_join(UPLOAD_DIR, filename)
                with open(dest_file, "wb") as f:
                    f.write(content)

                res = {
                    "status": "success",
                    "file_type": "geojson",
                    "filename": filename,
                    "size_bytes": len(content),
                    "features_count": len(features),
                    "bbox": bbox,
                    "geojson": data,
                    "message": f"Successfully parsed GeoJSON vector asset with {len(features)} features." + ("" if bbox else " Note: no bounding coordinates found in geometry.")
                }
                return res
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid GeoJSON/JSON file: {e}")
    # 2. Handle Raster / GeoTIFF Files (.tif, .tiff, .png, .jpg, .jpeg)
    dest_file = safe_join(UPLOAD_DIR, filename)
    thumb_file = UPLOAD_DIR / f"{dest_file.stem}_thumb.jpg"

    def _reject_raster(reason: str) -> None:
        """Remove the just-written raster + any preview so a rejection leaves no orphan."""
        dest_file.unlink(missing_ok=True)
        thumb_file.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=reason)

    with open(dest_file, "wb") as f:
        f.write(content)
    try:
        meta = GeoTIFFEngine.parse_raster(dest_file, preview_dir=UPLOAD_DIR)
    except Exception as e:
        logger.error("Raster parse failed", exc_info=True)
        _reject_raster(
            f"Failed to parse geospatial raster ({file.filename or filename}): {str(e)}. "
            "Please check format and projection."
        )

    # A file with a valid magic byte can still be unreadable (truncated, corrupt IFD,
    # unsupported compression). parse_raster reports that as validation_passed=False;
    # accepting it would persist a file that can never be inspected.
    if not meta.get("validation_passed", True):
        notes = " ".join(meta.get("validation_notes", [])) or "unreadable image data"
        _reject_raster(f"Uploaded raster could not be read as an image: {notes}")

    ACTIVE_UPLOADED_RASTERS[filename] = meta
    ACTIVE_UPLOADED_RASTERS[filename]["local_path"] = str(dest_file)

    return {
        "status": "success",
        "file_type": "raster",
        "filename": filename,
        "format": meta["format"],
        "is_geotiff": meta["is_geotiff"],
        "crs": meta["crs"],
        "bbox": meta["bounds"],
        "width": meta["width"],
        "height": meta["height"],
        "bands_count": meta["bands_count"],
        "bands_descriptions": meta["bands_descriptions"],
        "gsd": f"{meta['gsd_meters']}m Calibrated" if meta.get("gsd_meters") is not None else "N/A (Unprojected)",
        "gsd_meters": meta.get("gsd_meters"),
        "sensor": meta["sensor"],
        "modality": meta["modality"],
        "size_bytes": len(content),
        "preview_url": meta["preview_url"],
        "validation_notes": meta.get("validation_notes", []),
        "validation_passed": meta.get("validation_passed", True),
        "message": f"Successfully ingested {filename} ({meta['width']}x{meta['height']}px, {meta['bands_count']} bands, CRS: {meta['crs']})."
    }


@router.get("/upload/active/{filename}")
def get_active_raster(filename: str):
    """Returns cached parsed metadata for an active uploaded raster."""
    if filename in ACTIVE_UPLOADED_RASTERS:
        return ACTIVE_UPLOADED_RASTERS[filename]
    dest_file = safe_join(UPLOAD_DIR, filename)
    if dest_file.exists():
        meta = GeoTIFFEngine.parse_raster(dest_file, preview_dir=UPLOAD_DIR)
        ACTIVE_UPLOADED_RASTERS[filename] = meta
        return meta
    raise HTTPException(status_code=404, detail=f"Uploaded raster {filename} not found")


class PixelInspectRequest(BaseModel):
    lat: float
    lon: float
    bbox: Optional[list[float]] = None
    filename: Optional[str] = None


@router.post("/inspect-pixel")
def inspect_pixel_point(req: PixelInspectRequest):
    """
    Returns pixel inspection metadata (coordinates, RGB values, NDVI, NDWI, NDBI, SAR dB, land-cover class)
    at exact clicked latitude and longitude.
    """
    if req.bbox is not None and len(req.bbox) == 4:
        bbox = list(req.bbox)
        file_path = safe_join(UPLOAD_DIR, req.filename) if req.filename else None
    elif req.filename:
        file_path = safe_join(UPLOAD_DIR, req.filename)
        try:
            meta = GeoTIFFEngine.parse_raster(file_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not resolve raster for pixel inspection: {e}")
        bounds = meta.get("bounds")
        crs_str = str(meta.get("crs") or "")
        if not meta.get("is_geotiff") or bounds is None or "unprojected" in crs_str.lower() or "non-georeferenced" in crs_str.lower():
            raise HTTPException(status_code=400, detail="Pixel inspection requires geographic coordinates; the uploaded raster is not georeferenced.")
        bbox = bounds
    else:
        raise HTTPException(status_code=400, detail="A bbox is required for pixel inspection.")
    return GeoTIFFEngine.inspect_pixel(
        lat=req.lat,
        lon=req.lon,
        bbox=bbox,
        file_path=file_path,
    )
