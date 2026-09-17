"""
SatQuery AI - Grounded UI-Action Planner
Target: SIH26167 (ISRO / Space Applications Centre)

Turns the deterministic result of a query into a typed, closed-schema list of UI
actions ("UIAction") that the frontend may execute against real stores and the
real MapLibre map. This module never invents state in prose: every action it
emits is grounded in data that provably exists in the SAME response.

Grounding contract (enforced by `validate`):

  * fly_to_sector      -> sector id present in SECTOR_REGISTRY
  * fly_to_bbox        -> bounding box explicitly supplied with the request
  * set_modality       -> a modality in the shared modality union
  * set_sensor_band    -> a band in the shared SensorBand union
  * toggle_layer       -> a layer id in the frontend's DEFAULT_LAYERS
  * set_layer_opacity  -> a layer id in DEFAULT_LAYERS
  * toggle_projection  -> 'globe' | 'mercator'
  * toggle_basemap     -> 'dark' | 'satellite'
  * set_swipe_curtain  -> boolean only, emitted only when a real pair exists
  * open_panel         -> a deck tab in the shared panel union
  * open_studio        -> a route in the shared StudioRoute union
  * highlight_feature  -> a feature id present in THIS response's GeoJSON
  * toggle_live_stream -> emitted only when the live STAC stream is online here
  * run_benchmark      -> emitted only when a real benchmark id is supplied

If a signal is absent the action is NOT emitted. `ui_actions_source` reports how
the list was produced ("rule_based" today; "llm_planned" is reserved and only
used when an LLM-produced list has passed the same `validate` gate).
"""

import math
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ..engine.sector_assets import SECTOR_REGISTRY

# --- Closed schema -----------------------------------------------------------------
UI_ACTION_TYPES = frozenset(
    {
        "fly_to_sector",
        "fly_to_bbox",
        "set_modality",
        "set_sensor_band",
        "set_swipe_curtain",
        "toggle_layer",
        "set_layer_opacity",
        "toggle_projection",
        "toggle_basemap",
        "open_panel",
        "open_studio",
        "highlight_feature",
        "toggle_live_stream",
        "run_benchmark",
    }
)

# NOTE: no `set_time_range`. The dashboard's range control is preset-based
# (24h/7d/30d/1y/all), so an explicit T1->T2 acquisition pair has no real handler.
# The genuine dates stay visible in the evidence text/telemetry instead of being
# rounded to a preset and reported as if the exact range had been applied.

KNOWN_MODALITIES = frozenset({"single_image", "cross_modal", "bitemporal"})
KNOWN_SENSOR_BANDS = frozenset({"RGB", "NIR", "SAR"})
KNOWN_PANELS = frozenset({"evidence", "dag", "telemetry"})
KNOWN_PROJECTIONS = frozenset({"globe", "mercator"})
KNOWN_BASEMAPS = frozenset({"dark", "satellite"})
KNOWN_STUDIOS = frozenset(
    {"dashboard", "bitemporal", "crossmodal", "grounding", "benchmarks", "ingestion", "audit"}
)
# Mirrors frontend DEFAULT_LAYERS (src/config/tacticalData.ts).
KNOWN_LAYER_IDS = frozenset(
    {
        "intel-hotspots",
        "sentinel-optical",
        "sentinel-sar",
        "isro-ground-stations",
        "flood-inundation",
        "bitemporal-structural-change",
    }
)

# Confidence-bearing keys used to pick the most defensible highlight target.
_CONFIDENCE_KEYS = ("confidence", "probability", "score", "changeMagnitude", "areaKm2")


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


class UIActionPlanner:
    """Deterministic planner for grounded, executable UI actions."""

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _action(action_type: str, params: Dict[str, Any], reason: str) -> Dict[str, Any]:
        return {"type": action_type, "params": params, "reason": reason, "status": "pending"}

    @staticmethod
    def valid_bbox(bbox: Any) -> bool:
        """A bbox is usable only if it is 4 finite numbers forming a real extent."""
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            return False
        if not all(_is_finite_number(v) for v in bbox):
            return False
        min_lon, min_lat, max_lon, max_lat = (float(v) for v in bbox)
        if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
            return False
        if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
            return False
        return min_lon < max_lon and min_lat < max_lat

    @staticmethod
    def addressable_feature_ids(geojson: Optional[Dict[str, Any]]) -> List[str]:
        """Every GeoJSON feature id in this response that the UI can address."""
        ids: List[str] = []
        if not isinstance(geojson, dict):
            return ids
        for feat in geojson.get("features") or []:
            if not isinstance(feat, dict):
                continue
            fid = feat.get("id")
            if isinstance(fid, str) and fid.strip():
                ids.append(fid)
        return ids

    @classmethod
    def _best_highlight_id(cls, geojson: Optional[Dict[str, Any]]) -> Optional[str]:
        """Highest-confidence addressable feature, else the first addressable one."""
        if not isinstance(geojson, dict):
            return None
        best_id: Optional[str] = None
        best_score = float("-inf")
        for feat in geojson.get("features") or []:
            if not isinstance(feat, dict):
                continue
            fid = feat.get("id")
            if not (isinstance(fid, str) and fid.strip()):
                continue
            props = feat.get("properties") or {}
            score = float("-inf")
            if isinstance(props, dict):
                for key in _CONFIDENCE_KEYS:
                    val = props.get(key)
                    if _is_finite_number(val):
                        score = float(val)
                        break
            if best_id is None or score > best_score:
                best_id, best_score = fid, score
        return best_id

    # ----------------------------------------------------------------- validate
    @classmethod
    def validate(
        cls,
        action: Any,
        *,
        known_sector_ids: Optional[Iterable[str]] = None,
        known_feature_ids: Optional[Iterable[str]] = None,
        known_layer_ids: Optional[Iterable[str]] = None,
        known_benchmark_ids: Optional[Iterable[str]] = None,
    ) -> Tuple[bool, str]:
        """
        Closed-schema + grounding gate. Returns (ok, reason). Any action that is
        not provably executable must be dropped by the caller rather than shown
        as if it had happened.
        """
        if not isinstance(action, dict):
            return False, "action is not an object"

        action_type = action.get("type")
        if action_type not in UI_ACTION_TYPES:
            return False, f"unknown action type {action_type!r}"

        params = action.get("params")
        if not isinstance(params, dict):
            return False, "missing params object"

        sectors = set(known_sector_ids if known_sector_ids is not None else SECTOR_REGISTRY.keys())
        features = set(known_feature_ids or [])
        layers = set(known_layer_ids if known_layer_ids is not None else KNOWN_LAYER_IDS)
        benchmarks = set(known_benchmark_ids or [])

        if action_type == "fly_to_sector":
            sector_id = params.get("sector_id")
            if not isinstance(sector_id, str) or sector_id not in sectors:
                return False, f"sector_id {sector_id!r} is not a real sector"
            if not (_is_finite_number(params.get("lat")) and _is_finite_number(params.get("lon"))):
                return False, "fly_to_sector requires finite lat/lon"
            return True, "grounded in SECTOR_REGISTRY"

        if action_type == "fly_to_bbox":
            if not cls.valid_bbox(params.get("bbox")):
                return False, "bbox is not a valid extent"
            return True, "valid extent"

        if action_type == "set_modality":
            if params.get("modality") not in KNOWN_MODALITIES:
                return False, f"unknown modality {params.get('modality')!r}"
            return True, "known modality"

        if action_type == "set_sensor_band":
            if params.get("band") not in KNOWN_SENSOR_BANDS:
                return False, f"unknown sensor band {params.get('band')!r}"
            return True, "known sensor band"

        if action_type == "set_swipe_curtain":
            if not isinstance(params.get("active"), bool):
                return False, "set_swipe_curtain requires boolean active"
            return True, "boolean state"

        if action_type in {"toggle_layer", "set_layer_opacity"}:
            layer_id = params.get("layer_id")
            if layer_id not in layers:
                return False, f"layer_id {layer_id!r} does not exist in DEFAULT_LAYERS"
            if action_type == "toggle_layer":
                if not isinstance(params.get("visible"), bool):
                    return False, "toggle_layer requires boolean visible"
                return True, "known layer id"
            opacity = params.get("opacity")
            if not _is_finite_number(opacity) or not (0.0 <= float(opacity) <= 100.0):
                return False, "opacity must be within 0..100"
            return True, "known layer id"

        if action_type == "toggle_projection":
            if params.get("mode") not in KNOWN_PROJECTIONS:
                return False, f"unknown projection {params.get('mode')!r}"
            return True, "known projection"

        if action_type == "toggle_basemap":
            if params.get("mode") not in KNOWN_BASEMAPS:
                return False, f"unknown basemap {params.get('mode')!r}"
            return True, "known basemap"

        if action_type == "open_panel":
            if params.get("tab") not in KNOWN_PANELS:
                return False, f"unknown panel tab {params.get('tab')!r}"
            return True, "known deck tab"

        if action_type == "open_studio":
            if params.get("studio") not in KNOWN_STUDIOS:
                return False, f"unknown studio route {params.get('studio')!r}"
            return True, "known studio route"

        if action_type == "highlight_feature":
            feature_id = params.get("feature_id")
            if not isinstance(feature_id, str) or not feature_id.strip():
                return False, "missing feature_id"
            if feature_id not in features:
                return False, f"feature_id {feature_id!r} is absent from this response"
            return True, "present in this response GeoJSON"

        if action_type == "toggle_live_stream":
            if not isinstance(params.get("enabled"), bool):
                return False, "toggle_live_stream requires boolean enabled"
            return True, "boolean state"

        if action_type == "run_benchmark":
            benchmark_id = params.get("benchmark_id")
            if not isinstance(benchmark_id, str) or benchmark_id not in benchmarks:
                return False, f"benchmark_id {benchmark_id!r} is not in the real catalog"
            return True, "known benchmark id"

        return False, "unhandled action type"

    # --------------------------------------------------------------------- plan
    @classmethod
    def plan(
        cls,
        *,
        query: str,
        intent: Any,
        modality: Optional[str],
        profile: Any,
        requested_bbox: Optional[List[float]],
        geojson: Optional[Dict[str, Any]],
        live_stream: Optional[Dict[str, Any]] = None,
        benchmark_id: Optional[str] = None,
        benchmark_ids: Optional[Iterable[str]] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Produce a deterministic, grounded action list for one query result.

        Returns (actions, source). `source` is "rule_based" for this planner; an
        LLM-proposed list must run through `validate` and be reported as
        "llm_planned" only when it passed.
        """
        intent_value = str(getattr(intent, "value", intent))
        actions: List[Dict[str, Any]] = []

        known_sector_ids = set(SECTOR_REGISTRY.keys())
        feature_ids = cls.addressable_feature_ids(geojson)

        # 1) Camera: an explicit request bbox is the most specific real input, so
        #    it wins over the resolved sector centroid.
        flew = False
        if cls.valid_bbox(requested_bbox):
            actions.append(
                cls._action(
                    "fly_to_bbox",
                    {"bbox": [float(v) for v in requested_bbox]},
                    "Request supplied an explicit bounding box; frame that authored extent.",
                )
            )
            flew = True

        if not flew and profile is not None and getattr(profile, "id", None) in known_sector_ids:
            lat, lon = getattr(profile, "lat", None), getattr(profile, "lon", None)
            if _is_finite_number(lat) and _is_finite_number(lon):
                actions.append(
                    cls._action(
                        "fly_to_sector",
                        {
                            "sector_id": profile.id,
                            "name": getattr(profile, "name", profile.id),
                            "lat": float(lat),
                            "lon": float(lon),
                        },
                        f"Query resolved to real sector '{profile.id}' in SECTOR_REGISTRY.",
                    )
                )

        # 2) Modality the pipeline actually ran under.
        if modality in KNOWN_MODALITIES:
            actions.append(
                cls._action(
                    "set_modality",
                    {"modality": modality},
                    f"Pipeline executed in '{modality}' modality; sync the UI switch.",
                )
            )

        # 3) Intent-specific view state, each grounded in the executed pipeline.
        if intent_value == "bitemporal_change":
            actions.append(
                cls._action(
                    "set_swipe_curtain",
                    {"active": True},
                    "Bi-temporal differencing ran over a real T1/T2 pair; expose the comparison curtain.",
                )
            )
            actions.append(
                cls._action(
                    "toggle_layer",
                    {"layer_id": "bitemporal-structural-change", "visible": True},
                    "Change polygons exist for this response; show the change layer.",
                )
            )
            actions.append(
                cls._action(
                    "open_panel",
                    {"tab": "evidence"},
                    "Surface the change evidence that was just computed.",
                )
            )

        elif intent_value == "crossmodal_fusion":
            actions.append(
                cls._action(
                    "set_sensor_band",
                    {"band": "SAR"},
                    "SAR fusion ran; switch the sensor filter to the radar band that was processed.",
                )
            )
            actions.append(
                cls._action(
                    "toggle_layer",
                    {"layer_id": "sentinel-sar", "visible": True},
                    "Dual-pol SAR backscatter was processed; show the SAR layer.",
                )
            )
            actions.append(
                cls._action(
                    "open_panel",
                    {"tab": "telemetry"},
                    "Expose sensor/band telemetry for the fusion that ran.",
                )
            )

        elif intent_value in ("optical_vqa", "scene_captioning"):
            actions.append(
                cls._action(
                    "set_sensor_band",
                    {"band": "RGB"},
                    "Optical multispectral inference ran; switch to the visible band composite.",
                )
            )
            actions.append(
                cls._action(
                    "toggle_layer",
                    {"layer_id": "sentinel-optical", "visible": True},
                    "Optical scene was classified; show the optical layer.",
                )
            )
            actions.append(
                cls._action(
                    "open_panel",
                    {"tab": "evidence"},
                    "Surface the classification evidence that was just computed.",
                )
            )

        elif intent_value == "visual_grounding":
            actions.append(
                cls._action(
                    "toggle_layer",
                    {"layer_id": "intel-hotspots", "visible": True},
                    "Grounding targets are strategic sites; show the tactical vector layer.",
                )
            )
            actions.append(
                cls._action(
                    "open_panel",
                    {"tab": "evidence"},
                    "Surface the grounded polygons that were just vectorized.",
                )
            )

        else:  # sar_vqa / anything else that still produced evidence
            if intent_value == "sar_vqa":
                actions.append(
                    cls._action(
                        "set_sensor_band",
                        {"band": "SAR"},
                        "SAR VQA ran against radar amplitude; switch to the radar band.",
                    )
                )
            actions.append(
                cls._action(
                    "open_panel",
                    {"tab": "evidence"},
                    "Surface the evidence produced for this query.",
                )
            )

        # 4) Highlight only a feature id that exists in THIS response.
        highlight_id = cls._best_highlight_id(geojson)
        if highlight_id and intent_value != "scene_captioning":
            actions.append(
                cls._action(
                    "highlight_feature",
                    {"feature_id": highlight_id},
                    f"'{highlight_id}' is present in this response's GeoJSON; highlight it on the map.",
                )
            )

        # 5) Live stream: only when the stream is genuinely online for this response.
        if isinstance(live_stream, dict) and live_stream.get("status") == "online":
            actions.append(
                cls._action(
                    "toggle_live_stream",
                    {"enabled": True},
                    "Live STAC stream is online for this query; enable the live layer.",
                )
            )

        # 6) Benchmarks: only when a real catalog id was supplied.
        if benchmark_id and benchmark_id in set(benchmark_ids or []):
            actions.append(
                cls._action(
                    "run_benchmark",
                    {"benchmark_id": benchmark_id},
                    f"Benchmark '{benchmark_id}' exists in the real catalog.",
                )
            )

        # Final gate: nothing leaves this planner unvalidated.
        validated: List[Dict[str, Any]] = []
        for action in actions:
            ok, _reason = cls.validate(action, known_feature_ids=feature_ids)
            if ok:
                validated.append(action)

        return validated, "rule_based"
