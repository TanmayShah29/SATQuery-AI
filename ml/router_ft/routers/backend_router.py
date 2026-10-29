"""Adapter: the deployed router, i.e. the backend's AgentRouter.decide with ROUTER_BACKEND=llm.

That is the fine-tuned model behind mlx_lm.server (backend/app/agent/llm_router.py) plus the regex
fallback for errors, timeouts and invalid output. Scoring this measures what users would get,
not just the model. Start the server first (see docs/router-ft/SERVING.md).
"""

import os
import sys
import time
from pathlib import Path

os.environ["ROUTER_BACKEND"] = "llm"  # read when app.config is first imported
BACKEND = Path(__file__).resolve().parents[3] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.agent.router import AgentRouter  # noqa: E402
from app.config import settings  # noqa: E402

import schema  # noqa: E402
from routers.regex_router import _temporal as regex_temporal  # noqa: E402

assert settings.router_backend == "llm", "app.config was imported before ROUTER_BACKEND was set"


def route(query, hints):
    t0 = time.perf_counter()
    d = AgentRouter.decide(query, dict(hints))
    # Fallback rows get the same formatting map as the regex baseline (routers/regex_router.py), no more.
    temporal = d["temporal"] if d["source"] == "llm" else regex_temporal(d["temporal"])
    pred = schema.canonicalize({"intent": d["intent"].value, "secondary_intents": [s.value for s in d["secondary_intents"]],
                                "entities": d["entities"], "temporal": temporal,
                                "cloud_piercing_required": d["cloud_piercing_required"]})
    return pred, {"latency_ms": round((time.perf_counter() - t0) * 1000, 1), "source": d["source"],
                  "fallback_reason": d["fallback_reason"]}
