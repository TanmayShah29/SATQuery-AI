"""ROUTER_BACKEND: regex stays the default; the LLM backend falls back to regex on any failure.

The model server is mocked; nothing here needs mlx_lm.server or Ollama running.
"""

import ast
import json
import random
import re
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.agent import llm_router
from app.agent.router import AgentRouter, QueryIntent
from app.config import settings
from app.main import app

ROOT = Path(__file__).resolve().parents[2]
ML = ROOT / "ml" / "router_ft"
SAR = {"has_sar_pair": True}
GOOD = {"intent": "visual_grounding", "secondary_intents": ["scene_captioning"], "entities": ["maritime"],
        "temporal": None, "cloud_piercing_required": False}


class Calls(list):
    """HTTP requests the fake model server received; .reply(content) sets what it answers."""


class FakeResponse:
    def __init__(self, content):
        self._content = content

    def raise_for_status(self):
        pass

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


@pytest.fixture
def llm(monkeypatch):
    """Switch to the LLM backend with a fresh client and stats; returns the list of HTTP calls made."""
    monkeypatch.setattr(settings, "router_backend", "llm")
    monkeypatch.setattr(llm_router, "_client", None)
    monkeypatch.setattr(llm_router, "ROUTER_STATS", llm_router._Stats())
    calls = Calls()

    def reply(content):
        def fake_post(url, timeout, json):
            calls.append(json)
            if isinstance(content, Exception):
                raise content
            return FakeResponse(content)
        monkeypatch.setattr(llm_router.httpx, "post", fake_post)

    calls.reply = reply
    return calls


def test_default_backend_is_regex_and_makes_no_http_call(monkeypatch):
    assert settings.router_backend == "regex"
    monkeypatch.setattr(llm_router.httpx, "post", lambda *a, **k: pytest.fail("regex backend must not call the LLM"))
    plan = AgentRouter.plan_execution("Draw boxes around the ships in the harbour", context_data=SAR)
    assert plan.routing_source == "regex"
    assert plan.intent == QueryIntent.VISUAL_GROUNDING
    assert plan.dag_steps[0]["modelUsed"] == "AgentRouter (Semantic Remote Sensing Dispatcher)"


def test_llm_decision_drives_the_plan(llm):
    llm.reply(json.dumps(GOOD))
    plan = AgentRouter.plan_execution("Describe the port and box every tanker", context_data=SAR)
    assert plan.routing_source == "llm"
    assert plan.intent == QueryIntent.VISUAL_GROUNDING
    assert plan.target_entities == ["maritime"]
    assert plan.temporal_interval is None and plan.cloud_piercing_required is False
    assert "fine-tuned" in plan.dag_steps[0]["modelUsed"]
    assert any(s["id"] == "node-5-bounding-grounding" for s in plan.dag_steps)
    # the request uses the trained prompt, with only the two hint keys
    user = llm[0]["messages"][1]["content"]
    assert llm[0]["messages"][0]["content"] == llm_router.SYSTEM_PROMPT
    assert user.startswith('Hints: {"has_bitemporal_pair": false, "has_sar_pair": true}\nQuery: Describe the port')


@pytest.mark.parametrize("reply, reason", [
    ('{"intent": "visual-qa", "secondary_intents": [], "entities": [], "temporal": null, "cloud_piercing_required": false}',
     "invalid output"),
    ('{"intent": "sar_vqa", "secondary_intents": [], "entities": ["sar"], "temporal": null, "cloud_piercing_required": false}',
     "invalid output"),
    ('{"intent": "sar_vqa", "secondary_intents": [], "entities": [], "temporal": null, "cloud_piercing_required": true}',
     "invalid output"),  # cloud piercing without crossmodal_fusion
    ("sorry, I can't help with that", "invalid output"),
    (httpx.ReadTimeout("slow"), "timeout"),
    (httpx.ConnectError("refused"), "unavailable (ConnectError)"),
])
def test_any_failure_falls_back_to_regex(llm, reply, reason):
    llm.reply(reply)
    query = "Using radar, outline the flooded villages"
    plan = AgentRouter.plan_execution(query, context_data=SAR)
    regex = AgentRouter._regex_decision(query, SAR)
    assert plan.routing_source == "regex_fallback"
    assert (plan.intent, plan.target_entities, plan.temporal_interval, plan.cloud_piercing_required) == (
        regex["intent"], regex["entities"], regex["temporal"], regex["cloud_piercing_required"])
    assert "fallback" in plan.dag_steps[0]["modelUsed"]
    assert llm_router.ROUTER_STATS.snapshot()["fallbacks"] == {reason: 1}


def test_one_model_call_per_query(llm):
    """query_service classifies, then plan_execution plans: the second must come from the cache."""
    llm.reply(json.dumps(GOOD))
    intent = AgentRouter.classify_intent("Box every tanker", SAR)
    plan = AgentRouter.plan_execution("Box every tanker", context_data={**SAR, "modality": "cross_modal"})
    assert intent == plan.intent == QueryIntent.VISUAL_GROUNDING
    assert len(llm) == 1
    assert llm_router.ROUTER_STATS.snapshot()["cache_hits"] == 1


def test_failures_are_not_cached(llm):
    llm.reply(httpx.ReadTimeout("slow"))
    AgentRouter.classify_intent("Box every tanker", SAR)
    llm.reply(json.dumps(GOOD))
    assert AgentRouter.plan_execution("Box every tanker", context_data=SAR).routing_source == "llm"
    assert len(llm) == 2


def test_health_reports_the_router(monkeypatch):
    body = TestClient(app).get("/api/health").json()
    assert body["router"] == {"backend": "regex"}


# --- parity with the training side (ml/router_ft), so the served prompt and checks match the eval ---------
pytestmark_ml = pytest.mark.skipif(not ML.exists(), reason="ml/router_ft not present")


@pytestmark_ml
def test_prompt_matches_the_one_the_model_was_trained_with():
    tree = ast.parse((ML / "prepare_sft.py").read_text())
    system = next(n.value.value for n in tree.body if isinstance(n, ast.Assign) and n.targets[0].id == "SYSTEM")
    assert llm_router.SYSTEM_PROMPT == system
    src = (ML / "routers" / "llm_router.py").read_text()
    assert re.search(r'return f"Hints: \{json\.dumps\(hints\)\}\\nQuery: \{query\}\\nReturn only the JSON label\."', src)
    assert llm_router.user_turn("q", {"has_bitemporal_pair": False, "has_sar_pair": True}) == \
        'Hints: {"has_bitemporal_pair": false, "has_sar_pair": true}\nQuery: q\nReturn only the JSON label.'


@pytestmark_ml
def test_validator_agrees_with_the_eval_schema():
    """Same verdict as ml/router_ft/schema.validate on every train/val label and on random corruptions of them."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("ml_schema", ML / "schema.py")
    ml_schema = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ml_schema)
    labels = [json.loads(line)["label"] for f in ("train", "val")
              for line in (ROOT / "data" / "router_ft" / f"{f}.jsonl").read_text().splitlines() if line.strip()]
    rng = random.Random(0)
    corrupt = [
        lambda d: d.update(intent="visual-qa"),
        lambda d: d.update(entities=d["entities"] + ["sar"]),
        lambda d: d.update(entities=d["entities"] * 2),
        lambda d: d.update(secondary_intents=[d["intent"]]),
        lambda d: d.update(secondary_intents=["sar_vqa"]),
        lambda d: d.update(temporal="This Quarter"),
        lambda d: d.update(temporal="March 2024 -> Now"),
        lambda d: d.update(temporal="Post-Event"),
        lambda d: d.update(cloud_piercing_required=True),
        lambda d: d.update(cloud_piercing_required="yes"),
        lambda d: d.pop("temporal"),
        lambda d: d.update(extra=1),
    ]
    cases = list(labels)
    for _ in range(3000):
        d = json.loads(json.dumps(rng.choice(labels)))
        rng.choice(corrupt)(d)
        cases.append(d)
    for d in cases:
        assert ml_schema.validate(d)[0] == (not llm_router.validate_decision(d)), d
