"""
Optional LLM routing backend (ROUTER_BACKEND=llm).

Calls the fine-tuned router model (Qwen2.5-1.5B + LoRA, see docs/router-ft/) behind an
OpenAI-compatible chat endpoint: `mlx_lm.server` by default, but Ollama or llama-server work too.
The regex AgentRouter stays the default and the fallback: any error, timeout or invalid decision
returns None here and the caller uses regex. Every call is counted in ROUTER_STATS (/api/health).

The prompt must match the one the model was trained with (ml/router_ft/prepare_sft.py);
tests/test_llm_router.py checks that.
"""

import json
import logging
import re
import threading
import time
from collections import OrderedDict, deque
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = "You route queries for a satellite-imagery assistant. Reply with only the JSON routing decision."

# --- decision schema (mirrors ml/router_ft/schema.py v1.0) ---------------------------------
INTENTS = ("bitemporal_change", "crossmodal_fusion", "sar_vqa", "visual_grounding", "scene_captioning", "optical_vqa")
SECONDARY_INTENTS = ("crossmodal_fusion", "visual_grounding", "scene_captioning")
ENTITIES = ("runway", "launchpad", "building", "maritime", "flood", "excavation", "vegetation")
LABEL_KEYS = ("intent", "secondary_intents", "entities", "temporal", "cloud_piercing_required")
_MONTH = "January|February|March|April|May|June|July|August|September|October|November|December"
_UNITS = r"(?:Day|Week|Month|Year)"
_ENDPOINT_RE = re.compile(
    r"^(?:Pre-Event|Post-Event|Epoch T1|Epoch T2|Now|Monsoon"
    rf"|(?:{_MONTH})(?: \d{{4}})?|\d{{4}}|\d{{4}}-\d{{2}}-\d{{2}}"
    rf"|1 {_UNITS} Ago|(?:[2-9]|[1-9]\d+) {_UNITS}s Ago)$"
)


def user_turn(query: str, hints: Dict[str, bool]) -> str:
    return f"Hints: {json.dumps(hints)}\nQuery: {query}\nReturn only the JSON label."


def validate_decision(obj: Any) -> List[str]:
    """Problems with one decision; empty list means valid (same rules as the eval's schema.validate)."""
    if not isinstance(obj, dict) or set(obj) != set(LABEL_KEYS):
        return ["not an object with exactly the five decision keys"]
    errors = []
    intent, sec, ents, temporal, cloud = (obj[k] for k in LABEL_KEYS)
    if intent not in INTENTS:
        errors.append(f"unknown intent {intent!r}")
    if not isinstance(sec, list) or any(s not in SECONDARY_INTENTS for s in sec) or len(set(sec)) != len(sec) or intent in sec:
        errors.append("bad secondary_intents")
    if not isinstance(ents, list) or any(e not in ENTITIES for e in ents) or len(set(ents)) != len(ents):
        errors.append("bad entities")
    if temporal is not None:
        parts = temporal.split(" -> ") if isinstance(temporal, str) else []
        if len(parts) != 2 or not all(_ENDPOINT_RE.match(p) for p in parts):
            errors.append("bad temporal")
    if not isinstance(cloud, bool):
        errors.append("bad cloud_piercing_required")
    elif cloud and intent != "crossmodal_fusion" and isinstance(sec, list) and "crossmodal_fusion" not in sec:
        errors.append("cloud piercing without crossmodal_fusion")
    return errors


def parse_reply(text: str) -> Tuple[Optional[Dict[str, Any]], str]:
    if not text or "{" not in text:
        return None, "no JSON in reply"
    try:
        obj = json.loads(text[text.find("{"): text.rfind("}") + 1])
    except ValueError:
        return None, "invalid JSON"
    errors = validate_decision(obj)
    return (None, "; ".join(errors)) if errors else (obj, "")


# --- telemetry -------------------------------------------------------------------------------
class _Stats:
    def __init__(self):
        self._lock = threading.Lock()
        self.counts: Dict[str, int] = {"llm_calls": 0, "llm_ok": 0, "cache_hits": 0}
        self.fallbacks: Dict[str, int] = {}
        self._latency = deque(maxlen=500)

    def record(self, ok: bool, latency_ms: float, reason: str = "") -> None:
        with self._lock:
            self.counts["llm_calls"] += 1
            self._latency.append(latency_ms)
            if ok:
                self.counts["llm_ok"] += 1
            else:
                self.fallbacks[reason] = self.fallbacks.get(reason, 0) + 1

    def hit(self) -> None:
        with self._lock:
            self.counts["cache_hits"] += 1

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            lat = sorted(self._latency)
            return {**self.counts, "fallbacks": dict(self.fallbacks),
                    "latency_ms_p50": lat[len(lat) // 2] if lat else None,
                    "latency_ms_p95": lat[int(len(lat) * 0.95)] if lat else None}


ROUTER_STATS = _Stats()


# --- client ----------------------------------------------------------------------------------
class LLMRouterClient:
    """decide(query, hints) -> (decision | None, fallback_reason). Successful decisions are cached,
    because one request classifies the same query twice (query_service, then plan_execution)."""

    CACHE_SIZE = 512

    def __init__(self, url: str, model: str, timeout_s: float):
        self.url, self.model, self.timeout_s = url, model, timeout_s
        self._cache: "OrderedDict[tuple, Dict[str, Any]]" = OrderedDict()
        self._lock = threading.Lock()

    def decide(self, query: str, hints: Dict[str, bool]) -> Tuple[Optional[Dict[str, Any]], str]:
        key = (query, hints["has_bitemporal_pair"], hints["has_sar_pair"])
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                ROUTER_STATS.hit()
                return self._cache[key], ""
        t0 = time.perf_counter()
        try:
            resp = httpx.post(self.url, timeout=self.timeout_s, json={
                "model": self.model, "temperature": 0, "max_tokens": 200,
                "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                             {"role": "user", "content": user_turn(query, hints)}]})
            resp.raise_for_status()
            decision, reason = parse_reply(resp.json()["choices"][0]["message"]["content"])
        except httpx.TimeoutException:
            decision, reason = None, "timeout"
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            decision, reason = None, f"unavailable ({type(exc).__name__})"
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        bucket = reason if reason in ("", "timeout") or reason.startswith("unavailable") else "invalid output"
        ROUTER_STATS.record(decision is not None, latency_ms, bucket)
        logger.info("router decision", extra={"router_source": "llm" if decision else "regex_fallback",
                                              "fallback_reason": reason or None, "latency_ms": latency_ms})
        if decision is not None:
            with self._lock:
                self._cache[key] = decision
                while len(self._cache) > self.CACHE_SIZE:
                    self._cache.popitem(last=False)
        return decision, reason


_client: Optional[LLMRouterClient] = None


def get_client(url: str, model: str, timeout_s: float) -> LLMRouterClient:
    global _client
    if _client is None or (_client.url, _client.model, _client.timeout_s) != (url, model, timeout_s):
        _client = LLMRouterClient(url, model, timeout_s)
    return _client
