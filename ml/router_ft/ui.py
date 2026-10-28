"""Local dashboard for the automatic Phase 2 pipeline: one Start button, live progress and timing.

Start runs auto_dataset.py in the background (resumable; Start again after a stop or failure).
Standard library only; binds to 127.0.0.1.

Run from ml/router_ft:  uv run python ui.py   ->  http://127.0.0.1:8765
"""

import json
import os
import signal
import subprocess
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import auto_dataset
import generate
from common import PIPELINE_STATUS, RESULTS, REVIEWED, TEST_FREEZE, read_jsonl

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("ROUTER_FT_UI_PORT", "8765"))
PID_FILE = RESULTS / "pipeline.pid"
LOG_FILE = RESULTS / "logs" / "pipeline.log"

# Planning estimates per stage, in seconds, from the call counts and the free-tier pace.
_TEST_CALLS = len(generate.build_plan(auto_dataset.TEST_SLICE_TARGETS, auto_dataset.TEST_INTENT_WEIGHTS, seed=101))
_TRAIN_CALLS = len(generate.build_plan())
EXPECTED_S = {
    "test_generate": _TEST_CALLS * generate.PACE_S,
    "test_label": _TEST_CALLS * generate.PACE_S,  # two labellers in parallel, one batch per generated call
    "test_freeze": 2,
    "train_generate": _TRAIN_CALLS * generate.PACE_S,
    "train_check": 60,  # runs alongside generation; only the tail adds time
    "splits": 15,
}


# Groq free tier: each model allows 200K tokens/day, refilled gradually. Once a model hits it, this sets the pace.
GROQ_TPD = 200_000
TOKENS_PER_STEP = {"train_generate": 3000 / generate.BATCH}  # per item, measured; the checker is on OpenRouter now


def _now():
    return datetime.now(timezone.utc)


def _pid_alive():
    if not PID_FILE.exists():
        return None
    try:
        pid = int(PID_FILE.read_text().strip())
        try:
            if os.waitpid(pid, os.WNOHANG)[0] == pid:
                return None  # our child exited; reap it so it doesn't linger as a zombie
        except ChildProcessError:
            pass  # started by an earlier dashboard; fall back to the signal check
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError):
        return None


def _stage_timing(s):
    start = datetime.fromisoformat(s["started"]) if s.get("started") else None
    end = datetime.fromisoformat(s["ended"]) if s.get("ended") else None
    elapsed = ((end or _now()) - start).total_seconds() if start else 0
    eta = None
    if s["status"] == "running" and s.get("target") and s["samples"]:
        # Rate since this run of the stage began (samples restart counting on resume).
        t0, n0 = datetime.fromisoformat(s["samples"][0][0]), s["samples"][0][1]
        progressed, span = s["done"] - n0, (_now() - t0).total_seconds()
        if progressed > 0 and span > 0:
            eta = max(0, (s["target"] - s["done"]) * span / progressed)
    if s["status"] == "running" and s.get("target") and s["key"] in TOKENS_PER_STEP:
        capped = (s["target"] - s["done"]) * TOKENS_PER_STEP[s["key"]] / (GROQ_TPD / 86400)
        eta = max(eta or 0, capped)  # never promise faster than the daily token cap allows
    if eta is None and s["status"] in ("pending", "running", "failed"):
        eta = max(0, EXPECTED_S[s["key"]] - (elapsed if s["status"] == "running" else 0))
    return {"elapsed_s": round(elapsed), "eta_s": round(eta) if eta is not None else None}


def state():
    status = json.loads(PIPELINE_STATUS.read_text()) if PIPELINE_STATUS.exists() else None
    stages = status["stages"] if status else [
        {"key": k, "title": t, "by": by, "status": "pending", "done": 0, "target": None, "samples": [],
         "started": None, "ended": None} for k, t, by in auto_dataset.Status.STAGES]
    for s in stages:
        s.update(_stage_timing(s), expected_s=EXPECTED_S[s["key"]])
    running = _pid_alive() is not None
    state_name = "running" if running else (status or {}).get("state", "idle")
    if state_name == "running" and not running:
        state_name = "stopped"  # the process is gone but never wrote a final state
    reviewed = read_jsonl(REVIEWED)
    load = lambda p: json.loads(p.read_text()) if p.exists() else None
    return {
        "state": state_name, "error": (status or {}).get("error"), "log": (status or {}).get("log", [])[-8:],
        "waits": {m: t for m, t in ((status or {}).get("waits") or {}).items() if t > _now().isoformat()},
        "started": (status or {}).get("started"), "finished": (status or {}).get("finished"),
        "stages": stages, "now": _now().isoformat(),
        "results": {
            "freeze": load(TEST_FREEZE), "agreement": load(RESULTS / "agreement.json"),
            "splits": load(RESULTS / "split_report.json"),
            "train_checked": len(reviewed), "train_kept": sum(1 for r in reviewed if r["decision"] == "accept"),
        },
    }


def start(_):
    if _pid_alive():
        return {"ok": True, "note": "already running"}
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOG_FILE, "a")
    proc = subprocess.Popen([sys.executable, "auto_dataset.py"], cwd=HERE, stdout=fh, stderr=subprocess.STDOUT,
                            env={**os.environ, "PYTHONUNBUFFERED": "1"}, start_new_session=True)
    PID_FILE.write_text(str(proc.pid))
    return {"ok": True}


def stop(_):
    pid = _pid_alive()
    if pid:
        os.killpg(pid, signal.SIGTERM)
    return {"ok": True}


ROUTES = {("GET", "/api/state"): lambda _: state(), ("POST", "/api/start"): start, ("POST", "/api/stop"): stop}


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
            return self._send(200, fn(None))
        except Exception as exc:  # surface problems in the page instead of a silent 500
            return self._send(500, {"error": f"{type(exc).__name__}: {exc}"})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Router-FT dashboard on http://127.0.0.1:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
