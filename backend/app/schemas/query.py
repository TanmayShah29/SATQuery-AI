"""Query API schemas — Agent B (B-3)."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Natural language query about satellite imagery")
    sector: Optional[str] = Field(None, description="Sector identifier (e.g. 'ahmedabad')")
    modality: str = Field("optical", description="Imaging modality: optical, sar, or fused")
    bbox: Optional[List[float]] = Field(None, description="Bounding box [west, south, east, north]")


class QueryResponse(BaseModel):
    status: str
    query: str
    answer: str
    evidence: Dict[str, Any]
    confidence: float
    processing_time_ms: float
    isro_sac_compliant: bool
