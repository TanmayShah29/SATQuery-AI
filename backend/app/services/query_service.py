"""Query business logic — separated from HTTP layer — Agent B (B-4)."""
import asyncio
import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class QueryService:
    """Encapsulates query processing logic as a thin wrapper over the agent pipeline."""

    async def process_query(
        self,
        query: str,
        sector_id: Optional[str] = None,
        modality: str = "cross_modal",
        bbox: Optional[list] = None,
        uploaded_file: Optional[str] = None,
        confidence_threshold: float = 0.75,
        iou_threshold: float = 0.50,
        radar_threshold: float = 0.65,
        context_hints: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process a natural language query against satellite imagery.

        Offloads blocking ML work to a thread pool so the event loop stays free.
        """
        start_time = time.time()
        hints = dict(context_hints or {})

        if modality == "bitemporal":
            hints["has_bitemporal_pair"] = True
        elif modality == "cross_modal":
            hints["has_sar_pair"] = True

        ctx = {
            **hints,
            "modality": modality,
            "sector_id": sector_id,
            "uploaded_file": uploaded_file,
            "confidence_threshold": confidence_threshold,
            "iou_threshold": iou_threshold,
            "radar_threshold": radar_threshold,
        }

        try:
            # Import lazily to avoid circular dependencies
            from ..agent.router import AgentRouter
            from ..agent.evidence_builder import EvidenceBuilder

            intent = await asyncio.to_thread(AgentRouter.classify_intent, query, hints)
            ctx["intent"] = intent

            evidence = await asyncio.to_thread(
                EvidenceBuilder.build_evidence,
                query=query,
                intent=intent,
                bbox=bbox,
                context_data=ctx,
            )

            logger.info(
                "Query processed",
                extra={"query": query[:80], "intent": str(intent), "latency_ms": round((time.time() - start_time) * 1000, 1)},
            )
            return evidence  # type: ignore[return-value]

        except Exception:
            logger.error("Query processing failed", exc_info=True)
            return {
                "status": "error",
                "query": query,
                "answer": "I'm sorry, I couldn't process that query. Please try again.",
                "evidence": {},
                "confidence": 0.0,
                "processing_time_ms": round((time.time() - start_time) * 1000, 1),
                "isro_sac_compliant": False,
            }
