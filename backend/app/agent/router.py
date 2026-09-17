"""
SatQuery AI - Agentic Query Intent Router & Multi-Step Execution Planner
Target: SIH26167 (ISRO / Space Applications Centre)

Advanced agentic dispatcher that parses spatial bounds, sensor compatibility,
atmospheric cloud cover constraints, temporal epochs, and tool-chaining sequences.
"""

from dataclasses import dataclass, field
from enum import Enum
import re
from typing import Dict, Any, List, Optional, Tuple
from ..models.registry import MODEL_REGISTRY


class QueryIntent(str, Enum):
    BITEMPORAL_CHANGE = "bitemporal_change"
    CROSSMODAL_FUSION = "crossmodal_fusion"
    SAR_VQA = "sar_vqa"
    OPTICAL_VQA = "optical_vqa"
    VISUAL_GROUNDING = "visual_grounding"
    SCENE_CAPTIONING = "scene_captioning"


@dataclass
class AgentDispatchPlan:
    intent: QueryIntent
    modality: str
    primary_model: str
    grounding_tool: str
    required_inputs: List[str]
    output_type: str
    target_entities: List[str]
    temporal_interval: Optional[str]
    cloud_piercing_required: bool
    rationale: str
    dag_steps: List[Dict[str, Any]]


class AgentRouter:
    """Agentic decision engine routing natural-language prompts to models and tools."""

    CHANGE_PATTERNS = [
        r"\b(change|changed|changes|difference|differencing|delta)\b",
        r"\b(between|before\s+and\s+after|pre\s+and\s+post|t1\s+and\s+t2)\b",
        r"\b(new\s+construction|demolition|expanded|expansion|growth|cleared)\b",
        r"\b(temporal|multi-temporal|bi-temporal|bitemporal)\b",
        r"\b(encroachment|sprawl|urbanization|deforestation)\b",
    ]

    CROSSMODAL_PATTERNS = [
        r"\b(cloud|clouds|cloudy|overcast|haze|smoke|fog)\b",
        r"\b(pierce|penetrate|penetration|see\s+through|beneath\s+the\s+cloud)\b",
        r"\b(optical\s+and\s+sar|sar\s+and\s+optical|cross-modal|crossmodal|fusion)\b",
        r"\b(all-weather|monsoon\s+obscuration|heavy\s+cover)\b",
    ]

    SAR_PATTERNS = [
        r"\b(sar|radar|backscatter|dielectric|polarization|polarimetric)\b",
        r"\b(vv|vh|c-band|l-band|x-band|synthetic\s+aperture)\b",
        r"\b(roughness|double-bounce|corner\s+reflector|sentinel-1|risat)\b",
        r"\b(metallic\s+target|ship\s+detection|water\s+specular)\b",
    ]

    GROUNDING_PATTERNS = [
        r"\b(highlight|ground|locate|outline|draw|box|segment|mark|delineate|find\s+where)\b",
        r"\b(bounding\s+box|polygon|spatial\s+mask|region\s+grounding)\b",
    ]

    CAPTIONING_PATTERNS = [
        r"\b(describe|caption|summary|summarize|overview|land-cover\s+breakdown|scene\s+description)\b",
    ]

    ENTITY_MAP = {
        "runway": ["runway", "tarmac", "airstrip", "taxiway", "hangar"],
        "launchpad": ["launchpad", "launch pad", "launch complex", "flp", "slp", "propellant tank", "umbilical"],
        "building": ["building", "buildings", "facility", "footprint", "infrastructure", "campus", "structures"],
        "maritime": ["vessel", "vessels", "ship", "ships", "tanker", "boat", "convoy", "port", "anchorage"],
        "flood": ["flood", "flooding", "flooded", "inundation", "water body", "riverbank", "reservoir"],
        "excavation": ["excavation", "trench", "subterranean", "shaft", "spoil pile", "perimeter fence"],
        "vegetation": ["vegetation", "canopy", "forest", "agriculture", "crops", "paddy", "clearing"],
    }

    @classmethod
    def extract_entities(cls, query: str) -> List[str]:
        q_lower = query.lower()
        detected = []
        for category, terms in cls.ENTITY_MAP.items():
            if any(re.search(rf"\b{re.escape(t)}\b", q_lower) for t in terms):
                detected.append(category)
        return detected

    @classmethod
    def extract_temporal(cls, query: str) -> Optional[str]:
        q_lower = query.lower()
        m = re.search(r"\b(between\s+[a-z0-9\s,]+and\s+[a-z0-9\s,]+)\b", q_lower)
        if m:
            return m.group(1).title()
        if "t1" in q_lower and "t2" in q_lower:
            return "Epoch T1 -> Epoch T2"
        if "before" in q_lower and "after" in q_lower:
            return "Pre-Event -> Post-Event"
        return None

    @classmethod
    def classify_intent(cls, query: str, context_hints: Optional[Dict[str, Any]] = None) -> QueryIntent:
        """
        Classifies query into operational path based on linguistic markers and context.
        """
        q_lower = query.lower()
        hints = context_hints or {}

        # 1. Context overrides
        if hints.get("has_bitemporal_pair"):
            return QueryIntent.BITEMPORAL_CHANGE
        if hints.get("has_sar_pair") and any(re.search(p, q_lower) for p in cls.CROSSMODAL_PATTERNS):
            return QueryIntent.CROSSMODAL_FUSION

        # 2. Cross-modal / cloud piercing
        if any(re.search(p, q_lower) for p in cls.CROSSMODAL_PATTERNS):
            return QueryIntent.CROSSMODAL_FUSION

        # 3. Bi-temporal change detection
        if any(re.search(p, q_lower) for p in cls.CHANGE_PATTERNS):
            return QueryIntent.BITEMPORAL_CHANGE

        # 4. Pure SAR VQA
        if any(re.search(p, q_lower) for p in cls.SAR_PATTERNS):
            return QueryIntent.SAR_VQA

        # 5. Text-Guided Region Grounding
        if any(re.search(p, q_lower) for p in cls.GROUNDING_PATTERNS):
            return QueryIntent.VISUAL_GROUNDING

        # 6. Scene Captioning & Land-Cover Description
        if any(re.search(p, q_lower) for p in cls.CAPTIONING_PATTERNS):
            return QueryIntent.SCENE_CAPTIONING

        # 7. Default single-image optical VQA
        return QueryIntent.OPTICAL_VQA

    @classmethod
    def plan_execution(
        cls,
        query: str,
        bbox: Optional[List[float]] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> AgentDispatchPlan:
        """
        Synthesizes a structured agentic execution plan with sensor dispatch and DAG steps.
        """
        ctx = context_data or {}
        intent = cls.classify_intent(query, ctx)
        entities = cls.extract_entities(query)
        temporal = cls.extract_temporal(query)
        cloud_required = intent == QueryIntent.CROSSMODAL_FUSION or any(
            re.search(p, query.lower()) for p in cls.CROSSMODAL_PATTERNS
        )

        # Detect secondary intents for compound queries
        secondary_intents: List[QueryIntent] = []
        q_lower = query.lower()
        if intent != QueryIntent.VISUAL_GROUNDING and any(re.search(p, q_lower) for p in cls.GROUNDING_PATTERNS):
            secondary_intents.append(QueryIntent.VISUAL_GROUNDING)
        if intent != QueryIntent.SCENE_CAPTIONING and any(re.search(p, q_lower) for p in cls.CAPTIONING_PATTERNS):
            secondary_intents.append(QueryIntent.SCENE_CAPTIONING)
        if intent != QueryIntent.CROSSMODAL_FUSION and any(re.search(p, q_lower) for p in cls.CROSSMODAL_PATTERNS):
            secondary_intents.append(QueryIntent.CROSSMODAL_FUSION)

        if intent == QueryIntent.BITEMPORAL_CHANGE:
            modality = "bitemporal"
            reg = MODEL_REGISTRY["bitemporal_change"]
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["optical_msi_t1", "optical_msi_t2"]
            output_type = "bitemporal_change_mask_and_description"
            rationale = (
                "Query requests multi-temporal analysis or structural differential. "
                "Co-registering T1 and T2 epochs to compute radiometric shift and Otsu cluster boundaries."
            )
        elif intent == QueryIntent.CROSSMODAL_FUSION:
            modality = "cross_modal"
            reg = MODEL_REGISTRY["crossmodal_fusion"]
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["optical_msi", "sar_grd_dual_pol"]
            output_type = "cloud_pierced_fused_evidence"
            rationale = (
                "Query identifies cloud obscuration or requests cross-modal penetration. "
                "Dispatching Sentinel-1 C-SAR dual-pol (VV/VH) radar to pierce obscuration and isolate dielectric scatterers."
            )
        elif intent == QueryIntent.SAR_VQA:
            modality = "cross_modal"
            reg = MODEL_REGISTRY["sar_vqa"]
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["sar_grd_dual_pol"]
            output_type = "radar_structural_vqa_response"
            rationale = (
                "Query interrogates radar backscatter, surface dielectric properties, or all-weather targets. "
                "Executing polarimetric microwave analysis."
            )
        elif intent == QueryIntent.VISUAL_GROUNDING:
            modality = "single_image"
            reg = MODEL_REGISTRY.get("visual_grounding", MODEL_REGISTRY["optical_vqa"])
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["optical_msi"]
            output_type = "text_guided_bounding_boxes_and_polygons"
            rationale = (
                "Query explicitly requests spatial localization or feature grounding. "
                "Extracting cross-attention heatmaps and constructing Shapely topological boundary polygons."
            )
        elif intent == QueryIntent.SCENE_CAPTIONING:
            modality = "single_image"
            reg = MODEL_REGISTRY.get("scene_captioning", MODEL_REGISTRY["optical_vqa"])
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["optical_msi"]
            output_type = "multispectral_scene_caption_and_landcover_breakdown"
            rationale = (
                "Query requests comprehensive scene description or land-cover breakdown. "
                "Synthesizing generative visual-text description with spectral index statistics."
            )
        else:
            modality = "single_image"
            reg = MODEL_REGISTRY["optical_vqa"]
            primary_model = reg["canonical_name"]
            grounding_tool = reg["grounding_tool"]
            required_inputs = ["optical_msi"]
            output_type = "single_scene_vqa_and_grounded_polygons"
            rationale = (
                "Query requests optical land-cover identification or spatial feature grounding. "
                "Running vision-language cross-attention over normalized multispectral visual tokens."
            )

        if secondary_intents:
            sec_names = ", ".join(s.value.upper() for s in secondary_intents)
            rationale += f" Multi-intent decomposition active: chained secondary targets [{sec_names}] into execution pipeline."

        # Build dynamic DAG steps
        dag_steps = [
            {
                "id": "node-1-intent",
                "label": "Agentic Query & Entity Classifier",
                "type": "intent_parser",
                "status": "completed",
                "modelUsed": "AgentRouter (Semantic Remote Sensing Dispatcher)",
                "latencyMs": None,  # Measured dynamically at execution time by EvidenceBuilder
                "details": f"Classified primary intent as \"{intent.value.upper()}\". Secondary targets: {[s.value for s in secondary_intents] or 'None'}. Target categories: {entities or ['general_scene']}.",
                "outputPayload": f"Intent: {intent.value} | Entities: {entities} | Temporal: {temporal or 'None'}",
            },
            {
                "id": "node-2-dispatcher",
                "label": "Sensor & Atmospheric Band Dispatcher",
                "type": "band_dispatcher",
                "status": "pending",
                "modelUsed": "AgentRouter.plan_execution (Spectral Registry)",
                "latencyMs": None,  # Measured dynamically at execution time by EvidenceBuilder
                "details": f"Allocated required input bands: {required_inputs}. Cloud piercing: {cloud_required}.",
                "outputPayload": f"Inputs: {', '.join(required_inputs)} | Modality: {modality}",
            },
            {
                "id": "node-3-specialist",
                "label": "Remote-Sensing Specialist Inference Head",
                "type": "specialist_model",
                "status": "pending",
                "modelUsed": primary_model,
                "latencyMs": None,  # Measured dynamically at execution time by EvidenceBuilder
                "details": f"Executed inference head on PyTorch MPS/CPU tensor pipeline. Evaluated features across bounds {bbox}.",
                "outputPayload": f"Model: {primary_model} | Output: {output_type}",
            },
            {
                "id": "node-4-vectorizer",
                "label": "Spatial Mask & Polygon Vectorizer",
                "type": "spatial_vectorizer",
                "status": "pending",
                "modelUsed": grounding_tool,
                "latencyMs": None,  # Measured dynamically at execution time by EvidenceBuilder
                "details": "Extracted georeferenced non-convex boundary contours and projected to EPSG:4326.",
                "outputPayload": "Format: GeoJSON FeatureCollection (WGS84)",
            },
        ]

        if QueryIntent.VISUAL_GROUNDING in secondary_intents or intent == QueryIntent.VISUAL_GROUNDING:
            dag_steps.append({
                "id": "node-5-bounding-grounding",
                "label": "Text-Guided Bounding Box & Polygon Grounding",
                "type": "visual_grounding",
                "status": "pending",
                "modelUsed": "RemoteCLIP + Shapely Polygon Vectorizer",
                "latencyMs": None,
                "details": "Extracted precise spatial bounding boxes and non-convex boundary contours for query entities.",
                "outputPayload": "Shapely GeoJSON Bounding Polygons",
            })

        if intent == QueryIntent.CROSSMODAL_FUSION:
            dag_steps.insert(2, {
                "id": "node-2b-sar-filter",
                "label": "SAR Speckle Suppression & Dual-Pol Isolation",
                "type": "sar_filter",
                "status": "pending",
                "modelUsed": "5x5 Adaptive Lee Speckle Filter + VV/VH Ratio",
                "latencyMs": None,  # Measured dynamically at execution time by EvidenceBuilder
                "details": "Suppressed multiplicative speckle noise while preserving high-dielectric hard targets.",
                "outputPayload": "Filtered Radar Tensor (dB)",
            })

        return AgentDispatchPlan(
            intent=intent,
            modality=modality,
            primary_model=primary_model,
            grounding_tool=grounding_tool,
            required_inputs=required_inputs,
            output_type=output_type,
            target_entities=entities,
            temporal_interval=temporal,
            cloud_piercing_required=cloud_required,
            rationale=rationale,
            dag_steps=dag_steps,
        )

    @classmethod
    def get_execution_plan(cls, intent: QueryIntent) -> Dict[str, Any]:
        """Backwards-compatible wrapper returning dictionary representation of plan."""
        plan = cls.plan_execution("", context_data={"intent": intent})
        return {
            "intent": intent.value,
            "primary_model": plan.primary_model,
            "grounding_tool": plan.grounding_tool,
            "required_inputs": plan.required_inputs,
            "output_type": plan.output_type,
        }
