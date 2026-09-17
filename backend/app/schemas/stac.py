"""STAC API schemas — Agent B (B-3)."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class STACSearchRequest(BaseModel):
    bbox: List[float] = Field(..., description="Bounding box [west, south, east, north]")
    collections: List[str] = Field(default=["sentinel-2-l2a"], description="STAC collection IDs")
    date_range: str = Field("2024-01-01/2024-12-31", description="Date range in ISO 8601 interval format")
    cloud_cover: Optional[float] = Field(30.0, ge=0, le=100, description="Max cloud cover %")
    limit: int = Field(10, ge=1, le=100, description="Max results to return")


class STACSearchResponse(BaseModel):
    type: str
    features: List[Dict[str, Any]]
    numberMatched: Optional[int] = None
    numberReturned: Optional[int] = None
