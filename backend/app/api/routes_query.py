"""
SatQuery AI - Main Query & VQA Execution Router
Receives natural language prompts, dispatches to specialist pipelines, and returns grounded evidence.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from ..agent.router import AgentRouter
from ..agent.evidence_builder import EvidenceBuilder
from ..agent.realtime_vlm_agent import RealTimeVLMAgent

router = APIRouter(prefix="/api", tags=["query"])


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Natural language question or instruction")
    bbox: Optional[List[float]] = Field(default=None, description="[min_lon, min_lat, max_lon, max_lat]")
    modality: Optional[str] = Field(default="cross_modal", description="single_image, cross_modal, or bitemporal")
    sector_id: Optional[str] = Field(default=None, description="Active sector or pin ID")
    uploaded_file: Optional[str] = Field(default=None, description="Active uploaded raster filename")
    confidence_threshold: Optional[float] = Field(default=0.75, description="Confidence threshold slider value")
    iou_threshold: Optional[float] = Field(default=0.50, description="IoU filter threshold")
    radar_threshold: Optional[float] = Field(default=0.65, description="SAR backscatter filter threshold")
    context_hints: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Context flags like pair presence")


class QueryResponse(BaseModel):
    query: str
    modality: str
    intent: str
    answer: str
    confidence: Optional[float] = None
    latency_ms: float
    audit_hash: Optional[str] = None
    benchmarkSource: Optional[str] = None
    geojson: Dict[str, Any]
    telemetry: Dict[str, Any]
    dagNodes: List[Dict[str, Any]]
    findings: Optional[Dict[str, Any]] = None
    live_satellite_stream: Optional[Dict[str, Any]] = None
    ai_engine_active: Optional[str] = None
    # Grounded UI actions the frontend may execute, + how the list was produced.
    # Declared explicitly: unknown keys on a pydantic response_model are dropped.
    ui_actions: List[Dict[str, Any]] = []
    ui_actions_source: Optional[str] = None


@router.post("/query", response_model=QueryResponse)
def process_query(req: QueryRequest):
    """
    Main Agentic Assistant endpoint:
    1. Classifies query intent.
    2. Selects specialist model execution path.
    3. Returns natural language answer + GeoJSON polygons + audit telemetry + DAG nodes + findings.
    """
    hints = req.context_hints or {}
    if req.modality == "bitemporal":
        hints["has_bitemporal_pair"] = True
    elif req.modality == "cross_modal":
        hints["has_sar_pair"] = True

    intent = AgentRouter.classify_intent(req.query, hints)
    
    ctx = dict(hints)
    ctx["modality"] = req.modality
    ctx["sector_id"] = req.sector_id
    ctx["uploaded_file"] = req.uploaded_file
    if req.confidence_threshold is not None:
        ctx["confidence_threshold"] = req.confidence_threshold
    if req.iou_threshold is not None:
        ctx["iou_threshold"] = req.iou_threshold
    if req.radar_threshold is not None:
        ctx["radar_threshold"] = req.radar_threshold

    evidence = EvidenceBuilder.build_evidence(
        query=req.query,
        intent=intent,
        bbox=req.bbox,
        context_data=ctx
    )
    return evidence


@router.get("/settings/ai-status")
def get_ai_status():
    """Returns the live AI provider status and active satellite data streams."""
    return RealTimeVLMAgent.get_ai_status()


