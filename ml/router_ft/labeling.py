"""Interactive prompts for entering or editing one routing label (stdin/stdout only).

Used by test_writer.py (labelling, re-labelling) and review.py (editing a proposal).
Every finished label passes schema.validate before it is returned.
"""

from typing import Any, Dict, List, Optional, Sequence

import schema
from common import SLICES


def _pick_one(title: str, options: Sequence[str], default: Optional[str]) -> str:
    menu = "  ".join(f"{i}={o}" for i, o in enumerate(options, 1))
    while True:
        hint = f" [enter={default}]" if default is not None else ""
        raw = input(f"{title}{hint}\n  {menu}\n> ").strip()
        if not raw and default is not None:
            return default
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        print("  ! type one number from the menu")


def _pick_many(title: str, options: Sequence[str], default: Optional[List[str]]) -> List[str]:
    menu = "  ".join(f"{i}={o}" for i, o in enumerate(options, 1))
    while True:
        shown = ",".join(default) if default else "none"
        hint = f" [enter={shown}, -=none]" if default is not None else " [enter=none]"
        raw = input(f"{title}{hint}\n  {menu}\n> ").strip()
        if not raw:
            return list(default or [])
        if raw == "-":
            return []
        parts = [p.strip() for p in raw.replace(" ", ",").split(",") if p.strip()]
        if all(p.isdigit() and 1 <= int(p) <= len(options) for p in parts):
            picked = {options[int(p) - 1] for p in parts}
            return [o for o in options if o in picked]
        print("  ! type numbers separated by commas, e.g. 1,3")


def _ask_temporal(default: Any) -> Optional[str]:
    while True:
        shown = "null" if default is None else default
        raw = input(f"temporal  e.g. 'March -> Now', '2019 -> 2023', '1 Year Ago -> Now'  [enter={shown}, -=null]\n> ").strip()
        if not raw:
            return default
        if raw == "-":
            return None
        if schema.valid_temporal(raw):
            return raw
        print("  ! not in the grammar (GUIDELINES.md §8). Capitalised months, ' -> ' with spaces.")


def _ask_bool(title: str, default: Optional[bool]) -> bool:
    while True:
        hint = f" [enter={'y' if default else 'n'}]" if default is not None else ""
        raw = input(f"{title} (y/n){hint}\n> ").strip().lower()
        if not raw and default is not None:
            return default
        if raw in ("y", "n"):
            return raw == "y"
        print("  ! y or n")


def ask_label(default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Prompt field by field; `default` pre-fills every field (used when editing)."""
    d = default or {}
    while True:
        label = {
            "intent": _pick_one("intent", schema.INTENTS, d.get("intent")),
        }
        label["secondary_intents"] = _pick_many(
            "secondary_intents",
            [s for s in schema.SECONDARY_INTENTS if s != label["intent"]],
            [s for s in d.get("secondary_intents", []) if s != label["intent"]] if default else None,
        )
        label["entities"] = _pick_many("entities", schema.ENTITIES, d.get("entities") if default else None)
        label["temporal"] = _ask_temporal(d.get("temporal"))
        label["cloud_piercing_required"] = _ask_bool("cloud_piercing_required", d.get("cloud_piercing_required"))
        ok, errors = schema.validate(label)
        if ok:
            return schema.canonicalize(label)
        print("  ! label is invalid: " + "; ".join(errors) + "\n  Let's redo it.")
        default = d = label


def ask_slices(default: Optional[List[str]] = None) -> List[str]:
    while True:
        picked = _pick_many("slices (one or more)", SLICES, default)
        if picked:
            return picked
        print("  ! pick at least one slice")


def show_label(label: Dict[str, Any]) -> str:
    return (
        f"  intent:     {label['intent']}\n"
        f"  secondary:  {', '.join(label['secondary_intents']) or '-'}\n"
        f"  entities:   {', '.join(label['entities']) or '-'}\n"
        f"  temporal:   {label['temporal']}\n"
        f"  cloud:      {label['cloud_piercing_required']}"
    )
