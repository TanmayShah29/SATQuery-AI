"""Render the example tables in GUIDELINES.md from data/router_ft/guideline_examples.jsonl.

The JSONL is the source of truth (it is validated against schema.py); the doc's
tables are regenerated between <!-- BEGIN examples:<section> --> / <!-- END --> markers.

Run from ml/router_ft:  uv run python render_guidelines.py
"""

import json
import re
from pathlib import Path

import schema

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "data" / "router_ft" / "guideline_examples.jsonl"
DOC = ROOT / "docs" / "router-ft" / "GUIDELINES.md"
DEFAULT_HINTS = {"has_bitemporal_pair": False, "has_sar_pair": True}


def _hints(h):
    if h == DEFAULT_HINTS:
        return "default"
    return ", ".join(f"{k}={str(v).lower()}" for k, v in h.items())


def _label(lab):
    return "`" + json.dumps(lab, ensure_ascii=False) + "`"


def _table(rows):
    lines = ["| Kind | Query | Hints | Label | Why |", "|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['kind']} | {r['query']} | {_hints(r['hints'])} | {_label(r['label'])} | {r['why']} |")
    return "\n".join(lines)


def main():
    rows = [json.loads(line) for line in EXAMPLES.read_text().splitlines() if line.strip()]
    for r in rows:
        ok, errors = schema.validate(r["label"])
        assert ok and schema.canonicalize(r["label"]) == r["label"], (r["id"], errors)
        assert schema.validate_hints(r["hints"]), r["id"]

    doc = DOC.read_text()
    # The body may be empty and must never span into the next BEGIN marker.
    pattern = re.compile(r"(<!-- BEGIN examples:(\w+) -->\n)(?:(?!<!-- BEGIN ).)*?(<!-- END -->)", re.S)

    def fill(m):
        section_rows = [r for r in rows if r["section"] == m.group(2)]
        assert section_rows, f"no examples for section {m.group(2)}"
        return m.group(1) + _table(section_rows) + "\n" + m.group(3)

    rendered, n = pattern.subn(fill, doc)
    expected = doc.count("<!-- BEGIN examples:")
    assert n == expected, f"filled {n} of {expected} example blocks"
    shown = {r["id"] for r in rows if r["query"] in rendered}
    assert len(shown) == len(rows), f"examples missing from doc: {sorted({r['id'] for r in rows} - shown)}"
    DOC.write_text(rendered)
    print(f"rendered {len(rows)} examples into {DOC.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
