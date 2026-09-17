"""Upload API schemas — Agent B (B-3)."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class UploadResponse(BaseModel):
    status: str
    file_type: str
    filename: str
    size_bytes: int
    message: str


class RasterMetadata(BaseModel):
    format: str
    is_geotiff: bool
    crs: str
    bounds: List[float]
    width: int
    height: int
    bands_count: int
    gsd_meters: float
    sensor: str
    modality: str


class PixelInspectRequest(BaseModel):
    lat: float
    lon: float
    bbox: Optional[List[float]] = None
    filename: Optional[str] = None


class PixelInspectResponse(BaseModel):
    lat: float
    lon: float
    rgb_values: Optional[List[int]] = None
    ndvi: Optional[float] = None
    land_cover_class: Optional[str] = None
