"""The routing-decision schema, pinned in code. GUIDELINES.md is the prose version.

Every router (regex, zero-shot, few-shot, fine-tuned) is scored against labels in
this exact shape, and `validate` is what "valid JSON rate" means in the eval.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_VERSION = "1.0"

# Order matters: it is the canonical order for list fields and the primary-intent
# precedence for compound queries (earlier wins). See GUIDELINES.md §4.
INTENTS = (
    "bitemporal_change",
    "crossmodal_fusion",
    "sar_vqa",
    "visual_grounding",
    "scene_captioning",
    "optical_vqa",
)

# Only these three are consumed as secondaries by AgentRouter.plan_execution.
SECONDARY_INTENTS = ("crossmodal_fusion", "visual_grounding", "scene_captioning")

# Same keys and order as AgentRouter.ENTITY_MAP.
ENTITIES = ("runway", "launchpad", "building", "maritime", "flood", "excavation", "vegetation")

HINT_KEYS = ("has_bitemporal_pair", "has_sar_pair")

LABEL_KEYS = ("intent", "secondary_intents", "entities", "temporal", "cloud_piercing_required")

# --- temporal grammar ---------------------------------------------------------------
# temporal is null or "<endpoint> -> <endpoint>".
MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)
NAMED_ENDPOINTS = ("Pre-Event", "Post-Event", "Epoch T1", "Epoch T2", "Now", "Monsoon")
_MONTH = "|".join(MONTHS)
_UNITS = r"(?:Day|Week|Month|Year)"
ENDPOINT_RE = re.compile(
    rf"^(?:{'|'.join(re.escape(n) for n in NAMED_ENDPOINTS)}"
    rf"|(?:{_MONTH})(?: \d{{4}})?"            # March | March 2024
    rf"|\d{{4}}"                               # 2024
    rf"|\d{{4}}-\d{{2}}-\d{{2}}"               # 2024-03-15
    rf"|1 {_UNITS} Ago|(?:[2-9]|[1-9]\d+) {_UNITS}s Ago"  # 1 Year Ago | 6 Months Ago
    rf")$"
)
SEPARATOR = " -> "


def valid_temporal(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, str) or value.count(SEPARATOR) != 1:
        return False
    start, end = value.split(SEPARATOR)
    return bool(ENDPOINT_RE.match(start) and ENDPOINT_RE.match(end))


def validate(obj: Any) -> Tuple[bool, List[str]]:
    """Strict check of one routing decision. Returns (ok, list of problems)."""
    errors: List[str] = []
    if not isinstance(obj, dict):
        return False, ["not a JSON object"]
    if set(obj) != set(LABEL_KEYS):
        errors.append(f"keys must be exactly {list(LABEL_KEYS)}, got {sorted(obj)}")
        return False, errors

    intent = obj["intent"]
    if intent not in INTENTS:
        errors.append(f"unknown intent {intent!r}")

    sec = obj["secondary_intents"]
    if not isinstance(sec, list) or not all(isinstance(s, str) for s in sec):
        errors.append("secondary_intents must be a list of strings")
    else:
        if any(s not in SECONDARY_INTENTS for s in sec):
            errors.append(f"secondary_intents may only contain {list(SECONDARY_INTENTS)}")
        if len(set(sec)) != len(sec):
            errors.append("secondary_intents has duplicates")
        if intent in sec:
            errors.append("primary intent repeated in secondary_intents")

    ents = obj["entities"]
    if not isinstance(ents, list) or not all(isinstance(e, str) for e in ents):
        errors.append("entities must be a list of strings")
    else:
        if any(e not in ENTITIES for e in ents):
            errors.append(f"entities may only contain {list(ENTITIES)}")
        if len(set(ents)) != len(ents):
            errors.append("entities has duplicates")

    if not valid_temporal(obj["temporal"]):
        errors.append(f"temporal {obj['temporal']!r} does not match the grammar")

    cloud = obj["cloud_piercing_required"]
    if not isinstance(cloud, bool):
        errors.append("cloud_piercing_required must be a boolean")
    # Coupling rule (GUIDELINES.md §5): cloud piercing on a non-fusion primary
    # is carried as a crossmodal_fusion secondary.
    elif cloud and intent != "crossmodal_fusion" and isinstance(sec, list) and "crossmodal_fusion" not in sec:
        errors.append("cloud_piercing_required is true but crossmodal_fusion is neither primary nor secondary")

    return not errors, errors


def canonicalize(obj: Dict[str, Any]) -> Dict[str, Any]:
    """Sort list fields into canonical order so equal decisions serialize identically."""
    return {
        "intent": obj["intent"],
        "secondary_intents": sorted(obj["secondary_intents"], key=SECONDARY_INTENTS.index),
        "entities": sorted(obj["entities"], key=ENTITIES.index),
        "temporal": obj["temporal"],
        "cloud_piercing_required": obj["cloud_piercing_required"],
    }


def parse(text: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """Parse model output text into a validated, canonical decision (or None + errors)."""
    try:
        obj = json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        return None, [f"invalid JSON: {exc}"]
    ok, errors = validate(obj)
    return (canonicalize(obj), []) if ok else (None, errors)


def validate_hints(hints: Any) -> bool:
    return isinstance(hints, dict) and set(hints) == set(HINT_KEYS) and all(
        isinstance(hints[k], bool) for k in HINT_KEYS
    )
