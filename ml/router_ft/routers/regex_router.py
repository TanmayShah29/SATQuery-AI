"""Adapter: the existing regex AgentRouter as a `route(query, hints) -> decision` function.

It calls the real backend code (no re-implementation), then maps its output into
the schema.py shape. Only *formatting* is mapped, never meaning:

  * secondary intents are not a field on AgentDispatchPlan, so they are read
    back from the plan's first DAG node, which prints the exact list;
  * temporal strings like "Between March And June" are mapped to "March -> June"
    when both endpoints are mechanically recognisable. A greedy capture such as
    "Between March And June Near The Runway" is left as-is and so scores as wrong,
    because that is a real extraction error, not a formatting difference.
"""

import ast
import re
import sys
from pathlib import Path
from typing import Any, Dict

BACKEND = Path(__file__).resolve().parents[3] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.agent.router import AgentRouter  # noqa: E402

import schema  # noqa: E402

_SECONDARY_RE = re.compile(r"Secondary targets: (\[.*?\]|None)\.")
_MONTHS = {m.lower(): m for m in schema.MONTHS}


def _secondaries(plan) -> list:
    details = plan.dag_steps[0]["details"]
    m = _SECONDARY_RE.search(details)
    if m is None:
        raise RuntimeError(f"AgentRouter DAG text changed; cannot read secondaries from: {details!r}")
    return [] if m.group(1) == "None" else ast.literal_eval(m.group(1))


def _endpoint(text: str) -> str:
    """Map one lowercased endpoint to the grammar, or return it unchanged."""
    words = text.strip().split()
    if len(words) == 1 and words[0] in _MONTHS:
        return _MONTHS[words[0]]
    if len(words) == 1 and re.fullmatch(r"\d{4}", words[0]):
        return words[0]
    if len(words) == 2 and words[0] in _MONTHS and re.fullmatch(r"\d{4}", words[1]):
        return f"{_MONTHS[words[0]]} {words[1]}"
    return text.strip().title()


def _temporal(raw):
    if raw is None or schema.valid_temporal(raw):
        return raw
    m = re.fullmatch(r"between (.+?) and (.+)", raw.lower())
    if m:
        return f"{_endpoint(m.group(1))}{schema.SEPARATOR}{_endpoint(m.group(2))}"
    return raw


def route(query: str, hints: Dict[str, bool]) -> Dict[str, Any]:
    plan = AgentRouter.plan_execution(query, context_data=dict(hints))
    decision = {
        "intent": plan.intent.value,
        "secondary_intents": _secondaries(plan),
        "entities": list(plan.target_entities),
        "temporal": _temporal(plan.temporal_interval),
        "cloud_piercing_required": bool(plan.cloud_piercing_required),
    }
    # Sort lists canonically; the regex never emits values outside the schema's vocab.
    decision["secondary_intents"] = sorted(decision["secondary_intents"], key=schema.SECONDARY_INTENTS.index)
    decision["entities"] = sorted(decision["entities"], key=schema.ENTITIES.index)
    return decision
