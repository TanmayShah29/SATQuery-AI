#!/bin/zsh
# Waits for the overnight Groq reference run, then regenerates BASELINES.md and commits it (local only, no push).
cd /Users/tanmay/Projects/SIH-2026
D=results/router_ft/eval/gpt-oss-120b-12shot-b10
while [ "$(cat $D/probes/predictions.jsonl 2>/dev/null | wc -l | tr -d ' ')" -lt 20 ]; do
  pgrep -f "gpt-oss-120b-12shot-b10" >/dev/null || { echo "reference run exited before finishing"; exit 1; }
  sleep 60
done
cd ml/router_ft && uv run python eval.py report > /dev/null && cd ../..
git add docs/router-ft/BASELINES.md results/router_ft/eval
git commit -q -m "router-ft: Phase 3 reference baseline (gpt-oss-120b, batched) added to BASELINES.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && echo "committed $(git rev-parse --short HEAD)"
