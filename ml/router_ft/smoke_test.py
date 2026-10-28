"""Phase 0 smoke test: one completion from MLX (local) and one from Ollama.

Run from ml/router_ft:  uv run python smoke_test.py
"""

import time

import httpx
from mlx_lm import generate, load

MLX_MODEL = "mlx-community/Qwen2.5-1.5B-Instruct-4bit"
OLLAMA_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:3b"
PROMPT = 'Classify this satellite query into one word (change, sar, optical): "did the runway get longer since March?"'


def smoke_mlx() -> None:
    model, tokenizer = load(MLX_MODEL)
    messages = [{"role": "user", "content": PROMPT}]
    prompt = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    t0 = time.perf_counter()
    out = generate(model, tokenizer, prompt=prompt, max_tokens=20)
    print(f"[mlx]    {MLX_MODEL}: {out!r} ({(time.perf_counter() - t0) * 1000:.0f} ms)")


def smoke_ollama() -> None:
    t0 = time.perf_counter()
    r = httpx.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": PROMPT, "stream": False, "options": {"temperature": 0}},
        timeout=120,
    )
    r.raise_for_status()
    print(f"[ollama] {OLLAMA_MODEL}: {r.json()['response']!r} ({(time.perf_counter() - t0) * 1000:.0f} ms)")


if __name__ == "__main__":
    smoke_mlx()
    smoke_ollama()
