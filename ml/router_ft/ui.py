"""Local web UI for Phase 2: progress dashboard, test writing/labelling, freeze, review, re-label.

A front end over the same files and rules as test_writer.py / review.py / generate.py:
every label passes schema.validate, the frozen test set can't be edited, review is blind,
and the re-label opens 3 days after freezing. Standard library only; binds to 127.0.0.1.

Run from ml/router_ft:  uv run python ui.py   ->  http://127.0.0.1:8765
"""

import json
import os
import random
import subprocess
import sys
import threading
from collections import Counter
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import schema
from common import (ACTIVITY, GENERATED, GUIDE_EXAMPLES, HINT_CONFIGS, RESULTS, REVIEWED, SLICES, TEST,
                    TEST_FREEZE, TEST_RELABEL, TRAIN, VAL, append_jsonl, hint_config_name, log_activity,
                    read_jsonl, sha256, test_is_frozen, write_jsonl)
from generate import MODELS, SLICE_TARGETS
from review import REJECT_REASONS, load_candidates
from test_writer import (MIN_DAYS_BEFORE_RELABEL, RELABEL_N, RELABEL_SEED, TARGET_HINTS, TARGET_INTENTS,
                         TARGET_SLICES)

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("ROUTER_FT_UI_PORT", "8765"))
LOCK = threading.Lock()
JOBS = {}  # name -> {"proc": Popen, "log": Path, "started": iso}
SKIPPED = set()  # review items skipped in this server session


class ApiError(Exception):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ time tracking
IDLE_CAP_S = 300  # a gap longer than 5 min between two items counts as a break, not work


def _timing(stamps, done, target):
    """Active time from item timestamps (gaps capped at IDLE_CAP_S), pace and a time-left estimate."""
    ts = sorted(datetime.fromisoformat(s) for s in stamps)
    gaps = [(b - a).total_seconds() for a, b in zip(ts, ts[1:])]
    work = sorted(g for g in gaps if g <= IDLE_CAP_S)
    pace = work[len(work) // 2] if work else None  # median seconds per item
    active = sum(work) + (pace or 0)  # the first item of each sitting is credited at the median pace
    active += (pace or 0) * sum(1 for g in gaps if g > IDLE_CAP_S)
    remaining = max(0, target - done)
    return {"active_s": round(active), "pace_s": pace, "eta_s": round(remaining * pace) if pace else None,
            "first": ts[0].isoformat() if ts else None, "last": ts[-1].isoformat() if ts else None,
            "series": [t.isoformat() for t in ts]}


# ------------------------------------------------------------------ state
def _test_stats(rows):
    labelled = [r for r in rows if r["label"]]
    cloud = [r for r in labelled if r["label"]["cloud_piercing_required"]]
    ents = Counter(e for r in labelled for e in r["label"]["entities"])
    coverage = [
        ("temporal not null", sum(1 for r in labelled if r["label"]["temporal"]), 35),
        ("cloud true", len(cloud), 20),
        ("cloud true, non-fusion primary", sum(1 for r in cloud if r["label"]["intent"] != "crossmodal_fusion"), 8),
        ("secondary non-empty", sum(1 for r in labelled if r["label"]["secondary_intents"]), 25),
        ("no entities", sum(1 for r in labelled if not r["label"]["entities"]), 20),
    ] + [(f"entity: {e}", ents.get(e, 0), 10) for e in schema.ENTITIES]

    def table(counts, targets):
        return [{"name": k, "n": counts.get(k, 0), "target": t} for k, t in targets.items()]

    return {
        "rows": len(rows), "labelled": len(labelled),
        "intents": table(Counter(r["label"]["intent"] for r in labelled), TARGET_INTENTS),
        "slices": table(Counter(s for r in rows for s in r["slices"]), TARGET_SLICES),
        "modes": table(Counter(hint_config_name(r["hints"]) for r in rows), TARGET_HINTS),
        "coverage": [{"name": n, "n": v, "target": t} for n, v, t in coverage],
    }


def _relabel_info(rows):
    if not TEST_FREEZE.exists():
        return {"available": False, "opens_at": None, "done": 0, "total": RELABEL_N}
    frozen_at = datetime.fromisoformat(json.loads(TEST_FREEZE.read_text())["frozen_at"])
    opens = frozen_at + timedelta(days=MIN_DAYS_BEFORE_RELABEL)
    return {"available": datetime.now(timezone.utc) >= opens and test_is_frozen(), "opens_at": opens.isoformat(),
            "done": len(read_jsonl(TEST_RELABEL)), "total": min(RELABEL_N, len(rows))}


def _review_stats():
    rows = read_jsonl(REVIEWED)
    out = {}
    for key in ["ALL", *MODELS]:
        sel = [r for r in rows if key == "ALL" or r["model"] == key]
        c = Counter(r["decision"] for r in sel)
        out[key] = {"n": len(sel), **{d: c.get(d, 0) for d in ("accept", "edit", "reject")}}
    return out


def _job_status():
    out = {}
    for name, job in JOBS.items():
        code = job["proc"].poll()
        if code is not None and "ended" not in job:
            job["ended"] = _now()
        tail = job["log"].read_text(errors="replace").splitlines()[-12:] if job["log"].exists() else []
        end = datetime.fromisoformat(job.get("ended") or _now())
        out[name] = {"running": code is None, "exit_code": code, "started": job["started"], "ended": job.get("ended"),
                     "elapsed_s": round((end - datetime.fromisoformat(job["started"])).total_seconds()),
                     "log_tail": tail}
    return out


def state():
    rows = read_jsonl(TEST)
    frozen = test_is_frozen()
    tampered = TEST_FREEZE.exists() and not frozen
    cands = load_candidates()
    reviewed = read_jsonl(REVIEWED)
    relabel = _relabel_info(rows)
    split = RESULTS / "split_report.json"
    agreement = RESULTS / "agreement.json"
    gen_target = sum(SLICE_TARGETS.values())
    labelled = sum(1 for r in rows if r["label"])
    activity = read_jsonl(ACTIVITY)
    relabels = read_jsonl(TEST_RELABEL)
    timing = {
        "write": _timing([a["at"] for a in activity if a["task"] == "write"], len(rows), 160),
        "label": _timing([a["at"] for a in activity if a["task"] == "label"], labelled, len(rows) or 160),
        "generate": _timing([c["generated_at"] for c in cands], len(cands), gen_target),
        "review": _timing([r["reviewed_at"] for r in reviewed], len(reviewed), len(cands) or gen_target),
        "relabel": _timing([r["relabelled_at"] for r in relabels], len(relabels), relabel["total"]),
    }
    steps = [
        {"key": "write", "title": "Write ~160 test queries", "who": "you", "n": len(rows), "target": 160,
         "done": len(rows) >= 150 or frozen},
        {"key": "label", "title": "Label every test query", "who": "you", "n": labelled, "target": len(rows) or None,
         "done": (rows and labelled == len(rows)) or frozen},
        {"key": "freeze", "title": "Freeze the test set", "who": "you", "done": frozen},
        {"key": "generate", "title": "Generate training candidates (Groq)", "who": "button", "n": len(cands),
         "target": gen_target, "done": len(cands) >= gen_target * 0.9},
        {"key": "review", "title": "Review every candidate", "who": "you", "n": len(reviewed),
         "target": len(cands) or None, "done": bool(cands) and len(reviewed) >= len(cands)},
        {"key": "splits", "title": "Leakage check + train/val split", "who": "button", "done": TRAIN.exists() and VAL.exists()},
        {"key": "relabel", "title": "Blind re-label of 50 (3+ days after freezing)", "who": "you",
         "n": relabel["done"], "target": relabel["total"], "done": relabel["done"] >= relabel["total"] > 0},
        {"key": "agreement", "title": "Compute agreement (kappa)", "who": "button", "done": agreement.exists()},
    ]
    for s in steps:
        s["timing"] = timing.get(s["key"])
    return {
        "steps": steps, "frozen": frozen, "tampered": tampered, "now": _now(), "idle_cap_s": IDLE_CAP_S,
        "freeze_info": json.loads(TEST_FREEZE.read_text()) if TEST_FREEZE.exists() else None,
        "test_stats": _test_stats(rows),
        "test_rows": [{"id": r["id"], "query": r["query"], "mode": hint_config_name(r["hints"]),
                       "slices": r["slices"], "notes": r["notes"], "label": r["label"]} for r in rows],
        "relabel": relabel, "review": {"candidates": len(cands), "reviewed": len(reviewed), "stats": _review_stats()},
        "split_report": json.loads(split.read_text()) if split.exists() else None,
        "agreement": json.loads(agreement.read_text()) if agreement.exists() else None,
        "jobs": _job_status(),
        "vocab": {"intents": schema.INTENTS, "secondary": schema.SECONDARY_INTENTS, "entities": schema.ENTITIES,
                  "slices": SLICES, "modes": list(HINT_CONFIGS), "reject_reasons": REJECT_REASONS,
                  "months": schema.MONTHS, "named_endpoints": schema.NAMED_ENDPOINTS},
        "data_dir": str(TEST.parent),
    }


# ------------------------------------------------------------------ test set
def _require_unfrozen():
    if TEST_FREEZE.exists():
        raise ApiError("The test set is frozen and can't be edited. Log corrections in LOG.md instead.")


def _check_slices(slices):
    if not slices or any(s not in SLICES for s in slices):
        raise ApiError("Pick at least one valid slice.")
    return [s for s in SLICES if s in slices]


def _check_label(label):
    ok, errors = schema.validate(label)
    if not ok:
        raise ApiError("Label is invalid: " + "; ".join(errors))
    return schema.canonicalize(label)


def test_add(body):
    _require_unfrozen()
    q = (body.get("query") or "").strip()
    if not q:
        raise ApiError("Query is empty.")
    if body.get("mode") not in HINT_CONFIGS:
        raise ApiError("Pick a UI mode.")
    rows = read_jsonl(TEST)
    if any(r["query"].strip().lower() == q.lower() for r in rows):
        raise ApiError("You already wrote exactly this query.")
    next_n = max([int(r["id"].split("-")[1]) for r in rows] + [0]) + 1
    row = {"id": f"test-{next_n:04d}", "query": q, "hints": dict(HINT_CONFIGS[body["mode"]]), "label": None,
           "slices": _check_slices(body.get("slices")), "notes": (body.get("notes") or "").strip()}
    rows.append(row)
    write_jsonl(TEST, rows)
    log_activity("write", row["id"])
    return {"id": row["id"]}


def _find(rows, rid):
    for r in rows:
        if r["id"] == rid:
            return r
    raise ApiError(f"No row {rid}.")


def test_update(body):
    _require_unfrozen()
    rows = read_jsonl(TEST)
    r = _find(rows, body.get("id"))
    if "query" in body:
        q = body["query"].strip()
        if not q or any(o["id"] != r["id"] and o["query"].strip().lower() == q.lower() for o in rows):
            raise ApiError("Query is empty or duplicates another row.")
        r["query"] = q
    if "mode" in body:
        if body["mode"] not in HINT_CONFIGS:
            raise ApiError("Unknown UI mode.")
        r["hints"] = dict(HINT_CONFIGS[body["mode"]])
    if "slices" in body:
        r["slices"] = _check_slices(body["slices"])
    if "notes" in body:
        r["notes"] = body["notes"].strip()
    if "label" in body:
        r["label"] = None if body["label"] is None else _check_label(body["label"])
    write_jsonl(TEST, rows)
    if body.get("label") is not None:
        log_activity("label", r["id"])
    return {"ok": True}


def test_delete(body):
    _require_unfrozen()
    rows = read_jsonl(TEST)
    _find(rows, body.get("id"))
    write_jsonl(TEST, [r for r in rows if r["id"] != body["id"]])
    return {"ok": True}


def test_freeze(body):
    _require_unfrozen()
    if body.get("confirm") != "freeze":
        raise ApiError("Type 'freeze' to confirm.")
    rows = read_jsonl(TEST)
    problems = [r["id"] for r in rows if r["label"] is None or not schema.validate(r["label"])[0]
                or not schema.validate_hints(r["hints"]) or not r["slices"]]
    if not rows or problems:
        raise ApiError(f"Can't freeze: unlabelled or invalid rows: {', '.join(problems) or 'file is empty'}")
    TEST_FREEZE.write_text(json.dumps({"sha256": sha256(TEST), "rows": len(rows), "frozen_at": _now()}, indent=2) + "\n")
    return {"ok": True, "rows": len(rows)}


# ------------------------------------------------------------------ review
def review_next(_):
    decided = {d["id"] for d in read_jsonl(REVIEWED)}
    cands = load_candidates()
    todo = [c for c in cands if c["id"] not in decided and c["id"] not in SKIPPED]
    if not todo:
        todo = [c for c in cands if c["id"] not in decided]  # come back to skipped ones last
        SKIPPED.clear()
    if not todo:
        return {"item": None, "reviewed": len(decided), "total": len(cands)}
    c = todo[0]
    return {"reviewed": len(decided), "total": len(cands),
            "item": {"id": c["id"], "query": c["query"], "mode": hint_config_name(c["hints"]),
                     "slice": c["cell"]["slice"], "proposed_label": c["proposed_label"],
                     "proposal_valid": c["proposal_valid"], "proposal_errors": c["proposal_errors"]}}


def review_decide(body):
    c = next((x for x in load_candidates() if x["id"] == body.get("id")), None)
    if c is None:
        raise ApiError("Unknown candidate.")
    if any(d["id"] == c["id"] for d in read_jsonl(REVIEWED)):
        raise ApiError("Already reviewed.")
    decision = body.get("decision")
    if decision == "skip":
        SKIPPED.add(c["id"])
        return {"ok": True}
    record = {"id": c["id"], "model": c["model"], "query": c["query"], "hints": c["hints"],
              "proposed_label": c["proposed_label"], "proposal_valid": c["proposal_valid"], "reviewed_at": _now()}
    if decision == "accept":
        if not c["proposal_valid"]:
            raise ApiError("An invalid proposal can't be accepted as-is; edit or reject it.")
        record.update(decision="accept", query_final=c["query"], label=c["proposed_label"], slices=[c["cell"]["slice"]])
    elif decision == "edit":
        q = (body.get("query") or "").strip() or c["query"]
        label = _check_label(body.get("label"))
        record.update(decision="edit", query_final=q, label=label, slices=_check_slices(body.get("slices")),
                      query_edited=q != c["query"], label_edited=label != c["proposed_label"])
        if not record["query_edited"] and not record["label_edited"] and record["slices"] == [c["cell"]["slice"]]:
            record["decision"] = "accept"  # nothing changed: count it honestly as an accept
            if not c["proposal_valid"]:
                raise ApiError("Nothing changed, and the proposal is invalid.")
    elif decision == "reject":
        record.update(decision="reject", reject_reason=REJECT_REASONS.get(str(body.get("reason")), "other"))
    else:
        raise ApiError("Unknown decision.")
    append_jsonl(REVIEWED, record)
    return {"ok": True, "decision": record["decision"]}


def review_undo(_):
    rows = read_jsonl(REVIEWED)
    if not rows:
        raise ApiError("Nothing to undo.")
    write_jsonl(REVIEWED, rows[:-1])
    return {"ok": True, "undone": rows[-1]["id"]}


# ------------------------------------------------------------------ re-label
def _relabel_sample():
    rows = read_jsonl(TEST)
    idx = sorted(random.Random(RELABEL_SEED).sample(range(len(rows)), min(RELABEL_N, len(rows))))
    return [rows[i] for i in idx]


def relabel_next(_):
    info = _relabel_info(read_jsonl(TEST))
    if not info["available"]:
        raise ApiError(f"The blind re-label opens at {info['opens_at'] or 'freeze + 3 days'}.")
    done = {r["id"] for r in read_jsonl(TEST_RELABEL)}
    todo = [r for r in _relabel_sample() if r["id"] not in done]
    item = ({"id": todo[0]["id"], "query": todo[0]["query"], "mode": hint_config_name(todo[0]["hints"])}
            if todo else None)  # the earlier label is deliberately not sent
    return {"item": item, "done": len(done), "total": info["total"]}


def relabel_save(body):
    if not _relabel_info(read_jsonl(TEST))["available"]:
        raise ApiError("The blind re-label is not open yet.")
    sample_ids = {r["id"] for r in _relabel_sample()}
    done = {r["id"] for r in read_jsonl(TEST_RELABEL)}
    if body.get("id") not in sample_ids or body["id"] in done:
        raise ApiError("Not in the re-label sample, or already done.")
    append_jsonl(TEST_RELABEL, {"id": body["id"], "label": _check_label(body.get("label")), "relabelled_at": _now()})
    return {"ok": True}


# ------------------------------------------------------------------ jobs
JOB_COMMANDS = {
    "generate": [[sys.executable, "generate.py", "--model", m] for m in MODELS],
    "splits": [[sys.executable, "build_splits.py"]],
    "agreement": [[sys.executable, "agreement.py"]],
}


def run_job(body):
    name = body.get("job")
    if name not in JOB_COMMANDS:
        raise ApiError("Unknown job.")
    if not test_is_frozen():
        raise ApiError("Freeze the test set first.")
    started = []
    for k, cmd in enumerate(JOB_COMMANDS[name]):
        key = name if len(JOB_COMMANDS[name]) == 1 else f"{name}:{MODELS[k].split('/')[-1]}"
        if key in JOBS and JOBS[key]["proc"].poll() is None:
            continue
        log = RESULTS / "logs" / f"{key.replace(':', '_')}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        fh = open(log, "a")
        fh.write(f"\n=== {_now()} {' '.join(cmd[1:])}\n")
        fh.flush()
        proc = subprocess.Popen(cmd, cwd=HERE, stdout=fh, stderr=subprocess.STDOUT, env={**os.environ, "PYTHONUNBUFFERED": "1"})
        JOBS[key] = {"proc": proc, "log": log, "started": _now()}
        started.append(key)
    return {"started": started}


def validate_label(body):
    ok, errors = schema.validate(body.get("label"))
    return {"ok": ok, "errors": errors}


ROUTES = {
    ("GET", "/api/state"): lambda _: state(),
    ("GET", "/api/review/next"): review_next,
    ("GET", "/api/relabel/next"): relabel_next,
    ("POST", "/api/validate"): validate_label,
    ("POST", "/api/test/add"): test_add,
    ("POST", "/api/test/update"): test_update,
    ("POST", "/api/test/delete"): test_delete,
    ("POST", "/api/test/freeze"): test_freeze,
    ("POST", "/api/review/decide"): review_decide,
    ("POST", "/api/review/undo"): review_undo,
    ("POST", "/api/relabel/save"): relabel_save,
    ("POST", "/api/jobs/run"): run_job,
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def _send(self, code, payload, ctype="application/json"):
        data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _handle(self, method):
        path = self.path.split("?")[0]
        if method == "GET" and path in ("/", "/index.html"):
            return self._send(200, (HERE / "ui.html").read_bytes(), "text/html; charset=utf-8")
        fn = ROUTES.get((method, path))
        if fn is None:
            return self._send(404, {"error": "not found"})
        try:
            body = {}
            if method == "POST":
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}")
            with LOCK:
                return self._send(200, fn(body))
        except ApiError as exc:
            return self._send(400, {"error": str(exc)})
        except Exception as exc:  # surface bugs in the page instead of a silent 500
            return self._send(500, {"error": f"{type(exc).__name__}: {exc}"})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")


def main():
    GENERATED.mkdir(parents=True, exist_ok=True)
    assert GUIDE_EXAMPLES.exists(), "run from a checkout with data/router_ft/guideline_examples.jsonl"
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Router-FT UI on http://127.0.0.1:{PORT}  (data: {TEST.parent})")
    server.serve_forever()


if __name__ == "__main__":
    main()
