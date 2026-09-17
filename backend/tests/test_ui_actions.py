"""
Contract tests for the grounded UI-action planner.

The planner is the backend half of the "agent really controls the map" contract:
it may only emit actions whose target provably exists in the same response, and
the frontend is the only party allowed to report an action as executed. These
tests lock in the closed schema and the grounding gate so a future change cannot
silently start inventing sectors, layers, features, or benchmarks.
"""

import pytest

from app.agent.ui_action_planner import UIActionPlanner as P, UI_ACTION_TYPES
from app.engine.sector_assets import SECTOR_REGISTRY

PROFILE = SECTOR_REGISTRY["joshimath-subsidence"]

GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {"id": "change-feat-1", "properties": {"confidence": 0.61}},
        {"id": "change-feat-7", "properties": {"confidence": 0.94}},
        {"properties": {"confidence": 0.5}},  # unaddressable until normalized
    ],
}


def _plan(**overrides):
    kwargs = dict(
        query="q",
        intent="bitemporal_change",
        modality="bitemporal",
        profile=PROFILE,
        requested_bbox=None,
        geojson=GEOJSON,
        live_stream=None,
    )
    kwargs.update(overrides)
    return P.plan(**kwargs)


def _types(actions):
    return [a["type"] for a in actions]


class TestGroundingGate:
    def test_rejects_nonexistent_layer(self):
        ok, why = P.validate({"type": "toggle_layer", "params": {"layer_id": "no-such-layer", "visible": True}})
        assert ok is False
        assert "DEFAULT_LAYERS" in why

    def test_rejects_nonexistent_sector(self):
        ok, _ = P.validate({"type": "fly_to_sector", "params": {"sector_id": "atlantis", "lat": 1.0, "lon": 2.0}})
        assert ok is False

    def test_rejects_feature_absent_from_this_response(self):
        ok, why = P.validate({"type": "highlight_feature", "params": {"feature_id": "feature-999"}})
        assert ok is False
        assert "absent from this response" in why

    def test_never_invents_benchmark_without_real_catalog_id(self):
        ok, _ = P.validate({"type": "run_benchmark", "params": {"benchmark_id": "magic-bench"}})
        assert ok is False
        actions, _source = _plan(benchmark_id="magic-bench", benchmark_ids=["real-bench"])
        assert "run_benchmark" not in _types(actions)

    def test_rejects_reversed_bbox(self):
        assert P.valid_bbox([72.9, 30.2, 72.1, 30.8]) is False
        assert P.valid_bbox([72.1, 30.2, 72.9, 30.8]) is True

    def test_rejects_unknown_type_and_band(self):
        assert P.validate({"type": "hack_the_planet", "params": {}})[0] is False
        assert P.validate({"type": "set_sensor_band", "params": {"band": "X"}})[0] is False

    def test_accepts_known_targets(self):
        assert P.validate({"type": "toggle_layer", "params": {"layer_id": "sentinel-sar", "visible": True}})[0] is True
        assert P.validate({"type": "open_panel", "params": {"tab": "telemetry"}})[0] is True
        assert P.validate({"type": "fly_to_sector", "params": {"sector_id": "joshimath-subsidence", "lat": 1.0, "lon": 2.0}})[0] is True


class TestPlannerDistinctness:
    def test_bitemporal_and_crossmodal_differ_explainably(self):
        bitemporal, _ = _plan(intent="bitemporal_change", modality="bitemporal")
        crossmodal, _ = _plan(intent="crossmodal_fusion", modality="cross_modal")

        b, c = set(_types(bitemporal)), set(_types(crossmodal))
        assert b != c, "two genuinely different inputs must not produce identical action lists"
        # Each difference is a direct consequence of the pipeline that actually ran.
        assert "set_swipe_curtain" in b
        assert {"set_sensor_band", "toggle_layer"} <= c
        assert {a["params"]["layer_id"] for a in bitemporal if a["type"] == "toggle_layer"} == {
            "bitemporal-structural-change"
        }
        assert {a["params"]["layer_id"] for a in crossmodal if a["type"] == "toggle_layer"} == {"sentinel-sar"}
        assert [a["params"]["tab"] for a in crossmodal if a["type"] == "open_panel"] == ["telemetry"]

    def test_explicit_bbox_wins_over_sector_centroid(self):
        actions, _ = _plan(requested_bbox=[72.1, 30.2, 72.9, 30.8])
        assert _types(actions)[0] == "fly_to_bbox"
        assert "fly_to_sector" not in _types(actions)

    def test_invalid_bbox_falls_back_to_real_sector(self):
        actions, _ = _plan(requested_bbox=[72.9, 30.2, 72.1, 30.8])
        assert _types(actions)[0] == "fly_to_sector"

    def test_highlight_target_exists_in_this_response(self):
        actions, _ = _plan()
        highlights = [a for a in actions if a["type"] == "highlight_feature"]
        assert len(highlights) == 1
        # Highest-confidence addressable feature wins, and it is a real id.
        assert highlights[0]["params"]["feature_id"] == "change-feat-7"
        assert highlights[0]["params"]["feature_id"] in P.addressable_feature_ids(GEOJSON)

    def test_empty_response_emits_no_highlight_or_camera_move(self):
        actions, _ = _plan(geojson={"type": "FeatureCollection", "features": []})
        assert "highlight_feature" not in _types(actions)

    def test_live_stream_only_when_genuinely_online(self):
        assert "toggle_live_stream" not in _types(_plan(live_stream={"status": "unavailable"})[0])
        assert "toggle_live_stream" in _types(_plan(live_stream={"status": "online"})[0])

    def test_every_emitted_action_is_schema_valid_and_pending(self):
        actions, source = _plan(live_stream={"status": "online"})
        assert source == "rule_based"
        feature_ids = P.addressable_feature_ids(GEOJSON)
        for action in actions:
            assert set(action) == {"type", "params", "reason", "status"}
            assert action["type"] in UI_ACTION_TYPES
            assert action["status"] == "pending", "backend must not claim an unexecuted action"
            ok, why = P.validate(action, known_feature_ids=feature_ids)
            assert ok, f"planner emitted an ungrounded action {action['type']}: {why}"

    @pytest.mark.parametrize("intent,modality", [
        ("bitemporal_change", "bitemporal"),
        ("crossmodal_fusion", "cross_modal"),
        ("optical_vqa", "single_image"),
        ("visual_grounding", "single_image"),
        ("sar_vqa", "single_image"),
        ("scene_captioning", "single_image"),
    ])
    def test_every_intent_yields_at_least_one_grounded_action(self, intent, modality):
        actions, _ = _plan(intent=intent, modality=modality)
        assert actions, f"{intent} produced no actions"
